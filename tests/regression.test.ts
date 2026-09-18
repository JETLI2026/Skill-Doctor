import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fixture, validEntry } from './helpers.ts';
import { parseSkill } from '../src/parser/index.ts';
import { caseSchema, parseCases, type RegressionCase } from '../src/regression/schema.ts';
import { gradeCase } from '../src/regression/grader.ts';
import { evaluateOutputs, runBenchmark } from '../src/regression/benchmark.ts';
import { generateCases, loadCases, writeCases } from '../src/regression/cases.ts';
import { TextTaskRunner } from '../src/regression/runner.ts';
import type { CompletionRequest } from '../src/semantic/provider.ts';

export const regressionCase: RegressionCase = {
  schemaVersion: '1.0', id: 'zero-value', title: '零值不能丢失', category: 'regression-cases', status: 'ready', input: 'Normalize {"quantity":0}', context: '字段 quantity 为非负整数。', expected_behavior: ['保留 quantity=0'], forbidden_behavior: ['返回默认值 1'], assertions: [{ id: 'zero', type: 'json_path_equals', path: '/quantity', value: 0 }], source_rule: [{ file: 'SKILL.md', startLine: 7, endLine: 7, quote: 'Return the normalized record.' }], sourceFingerprint: 'fixture',
};
test('grading detects historical zero-value error and keeps JSON key order irrelevant', async () => {
  const bad = await gradeCase(regressionCase, { caseId: 'zero-value', variant: 'with_skill', repeat: 1, output: '{"quantity":1}' });
  assert.equal(bad.status, 'failed');
  const good = await gradeCase(regressionCase, { caseId: 'zero-value', variant: 'with_skill', repeat: 1, output: '{"quantity":0}' });
  assert.equal(good.status, 'passed');
  const unordered = { ...regressionCase, assertions: [{ id: 'object', type: 'json_equals' as const, value: { a: 1, b: 2 } }] };
  assert.equal((await gradeCase(unordered, { caseId: 'zero-value', variant: 'with_skill', repeat: 1, output: '{"b":2,"a":1}' })).status, 'passed');
});
test('draft, missing output, missing judge and execution errors never pass', async () => {
  const output = { caseId: 'zero-value', variant: 'with_skill' as const, repeat: 1, output: '{"quantity":0}' };
  assert.equal((await gradeCase({ ...regressionCase, status: 'draft' }, output)).status, 'not_evaluated');
  assert.equal((await gradeCase(regressionCase)).status, 'not_evaluated');
  assert.equal((await gradeCase({ ...regressionCase, assertions: [{ id: 'semantic', type: 'rubric', rubric: '正确解释零值含义' }] }, output)).status, 'not_evaluated');
  assert.equal((await gradeCase(regressionCase, { caseId: 'zero-value', variant: 'with_skill', repeat: 1, error: 'runtime failure' })).status, 'failed');
  assert.throws(() => caseSchema.parse({ ...regressionCase, assertions: [] }));
});
test('JSON pointer distinguishes missing keys from null and supports escaping', async () => {
  const c = { ...regressionCase, assertions: [{ id: 'null', type: 'json_path_equals' as const, path: '/a~1b/~0key', value: null }] };
  assert.equal((await gradeCase(c, { caseId: c.id, variant: 'with_skill', repeat: 1, output: '{"a/b":{"~key":null}}' })).status, 'passed');
  assert.equal((await gradeCase(c, { caseId: c.id, variant: 'with_skill', repeat: 1, output: '{}' })).status, 'failed');
});
test('benchmark includes missing runs in denominator and identifies regressions', async () => {
  const result = await evaluateOutputs([regressionCase], [
    { caseId: regressionCase.id, variant: 'with_skill', repeat: 1, output: '{"quantity":1}' },
    { caseId: regressionCase.id, variant: 'without_skill', repeat: 1, output: '{"quantity":0}' },
  ], { repeats: 2 });
  assert.equal(result.summary.with_skill!.failed, 1);
  assert.equal(result.summary.with_skill!.notEvaluated, 1);
  assert.equal(result.summary.without_skill!.passRate, 0.5);
  assert.deepEqual(result.comparisons[0]!.regressions, ['zero-value#1']);
  assert.deepEqual(result.comparisons[0]!.notComparable, ['zero-value#2']);
  assert.equal(result.comparisons[0]!.passRateDelta, null);
  await assert.rejects(evaluateOutputs([regressionCase], [{ caseId: 'unknown', variant: 'with_skill', repeat: 1, output: 'x' }]), /未知/);
});
test('runner gets only input/context, old baseline is isolated and repeats are tracked', async t => {
  const skill = await parseSkill(await fixture(t, { 'SKILL.md': validEntry, 'tests/regression-cases/answers.json': JSON.stringify(regressionCase) }));
  const baseline = await parseSkill(await fixture(t, { 'SKILL.md': `${validEntry}\nOld default is 1.` }));
  const calls: (string | undefined)[] = [];
  const benchmark = await runBenchmark([regressionCase], { identity: 'test-runner', run: async (input, selectedSkill) => {
    assert.deepEqual(Object.keys(input).sort(), ['context', 'input']);
    assert.ok(!selectedSkill?.files.some(f => f.kind === 'tests'));
    if (selectedSkill) {
      assert.equal(selectedSkill.name, 'test-skill');
      selectedSkill.name = 'mutated-by-runner';
    }
    calls.push(selectedSkill?.fingerprint);
    return { output: selectedSkill?.fingerprint === skill.fingerprint ? '{"quantity":0}' : '{"quantity":1}', durationMs: 2, usage: { promptTokens: 4, completionTokens: 2 } };
  } }, skill, { baseline, repeats: 2 });
  assert.equal(calls.length, 6);
  assert.ok(calls.includes(undefined));
  assert.ok(calls.includes(baseline.fingerprint));
  assert.equal(benchmark.summary.with_skill!.passed, 2);
  assert.equal(benchmark.summary.baseline!.failed, 2);
  assert.equal(benchmark.summary.with_skill!.meanTokens, 6);
});
test('text runner never exposes assertion answers and enforces context limit', async t => {
  const skill = await parseSkill(await fixture(t, { 'SKILL.md': validEntry }));
  let request: CompletionRequest | undefined;
  const provider = { identity: 'fake', complete: async (req: CompletionRequest) => { request = req; return { text: '{}', durationMs: 1 }; } };
  const runner = new TextTaskRunner(provider);
  await runner.run({ input: regressionCase.input, context: regressionCase.context });
  assert.ok(!request!.user.includes('assertions'));
  assert.ok(!request!.system.includes('SKILL.md'));
  await assert.rejects(new TextTaskRunner(provider, 1).run(regressionCase, skill), /上下文/);
});
test('generator validates sources and creates three real draft case categories', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const skill = await parseSkill(root);
  const rawCases = ['golden-cases', 'edge-cases', 'regression-cases'].map((category, index) => {
    const { sourceFingerprint: _, ...c } = regressionCase;
    return { ...c, id: `case-${index}`, category };
  });
  const cases = await generateCases(skill, { identity: 'generator', complete: async () => ({ text: JSON.stringify({ cases: rawCases }), durationMs: 1 }) });
  assert.equal(cases.length, 3);
  assert.ok(cases.every(c => c.status === 'draft' && c.sourceFingerprint === skill.fingerprint));
  await writeCases(cases, join(root, 'generated'));
  assert.deepEqual((await loadCases(join(root, 'generated'))).map(c => c.id).sort(), cases.map(c => c.id).sort());
  await assert.rejects(writeCases(cases, join(root, 'generated')), /EEXIST/);
});
test('duplicate cases and unknown assertion types are rejected', () => {
  assert.throws(() => parseCases([regressionCase, regressionCase]), /重复/);
  assert.throws(() => caseSchema.parse({ ...regressionCase, assertions: [{ id: 'x', type: 'execute_shell', command: 'echo pass' }] }));
});
