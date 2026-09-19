import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { main } from '../src/cli.ts';
import { fixture, validEntry } from './helpers.ts';
import { auditSkill } from '../src/audit.ts';
import { renderHtml } from '../src/reporting/html.ts';
import { renderMarkdown } from '../src/reporting/markdown.ts';
import { compareReports } from '../src/reporting/compare.ts';
import { parseSkill } from '../src/parser/index.ts';
import { diffSkills } from '../src/refactor/diff.ts';

function capture() { let stdout = '', stderr = ''; return { io: { stdout: (text: string) => { stdout += text; }, stderr: (text: string) => { stderr += text; } }, result: () => ({ stdout, stderr }) }; }
test('CLI audit can generate reports while error findings remain, without changing the input', async t => {
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n[missing](references/gone.md)` });
  const original = await readFile(join(root, 'SKILL.md'), 'utf8');
  const stream = capture();
  assert.equal(await main(['audit', root, '--static'], stream.io), 1);
  const report = JSON.parse(stream.result().stdout);
  const relaxed = capture();
  assert.equal(await main(['audit', root, '--static', '--fail-on', 'none'], relaxed.io), 0);
  const relaxedReport = JSON.parse(relaxed.result().stdout);
  assert.ok(relaxedReport.findings.some((f: { severity: string }) => f.severity === 'error'));
  assert.deepEqual(relaxedReport.findings, report.findings);
  assert.equal(relaxedReport.semantic.status, 'not_requested');
  const target = join(root, 'reports', 'audit.html');
  assert.equal(await main(['audit', root, '--static', '--format', 'html', '--out', target, '--fail-on', 'none'], capture().io), 0);
  assert.ok((await readFile(target, 'utf8')).startsWith('<!doctype html>'));
  assert.equal(await main(['audit', root, '--static', '--format', 'html', '--out', target], capture().io), 2);
  assert.equal(await readFile(join(root, 'SKILL.md'), 'utf8'), original);
});
test('configured models stay unused offline; a failed semantic review retains a report but exits 2', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const env = { SKILL_DOCTOR_ENDPOINT: 'https://example.test/v1/chat/completions', SKILL_DOCTOR_MODEL: 'test-only', SKILL_DOCTOR_API_KEY: 'test-key' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  Object.assign(process.env, env);
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: 'invalid review JSON' } }] }));
  assert.equal(await main(['audit', root, '--static', '--fail-on', 'none'], capture().io), 0);
  assert.equal(fetch.mock.callCount(), 0);
  const target = join(root, 'reports', 'failed-review.json');
  assert.equal(await main(['audit', root, '--semantic', '--fail-on', 'none', '--out', target], capture().io), 2);
  assert.equal(fetch.mock.callCount(), 1);
  const report = JSON.parse(await readFile(target, 'utf8'));
  assert.equal(report.semantic.status, 'failed');
  assert.ok(report.findings.some((f: { ruleId: string }) => f.ruleId === 'tests.missing'));
  assert.ok(report.scores.every((s: { status: string }) => s.status !== 'assessed'));
});
test('CLI rejects typo flags and commands instead of silently changing the workflow', async () => {
  assert.equal(await main(['audit', '.', '--semantics'], capture().io), 2);
  assert.equal(await main(['audit', '.', '--live'], capture().io), 2);
  assert.equal(await main(['audit', '.', '--static', '--semantic'], capture().io), 2);
  assert.equal(await main(['generate', '.', '--out', 'ignored'], capture().io), 2);
  assert.equal(await main(['unknown'], capture().io), 2);
  assert.equal(await main(['--format', 'md'], capture().io), 2);
  assert.equal(await main(['--help'], capture().io), 0);
});
test('unspecified audit mode preserves the static report but marks a full review incomplete', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const stream = capture();
  assert.equal(await main(['audit', root, '--fail-on', 'none'], stream.io), 3);
  const report = JSON.parse(stream.result().stdout);
  assert.equal(report.semantic.status, 'not_requested');
  assert.ok(stream.result().stderr.includes('完整审查尚未完成'));
});
test('HTML escapes source HTML/scripts and Markdown contains traceable evidence', async t => {
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n不要执行 <script>alert("x")</script>。\n\n[missing](missing.md)` });
  const report = await auditSkill(root);
  const html = renderHtml(report);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Content-Security-Policy'));
  assert.ok(html.includes("script-src 'sha256-"));
  assert.ok(renderMarkdown(report).includes('SKILL.md:'));
});
test('comparisons refuse score deltas when configuration or semantic coverage changes', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const before = await auditSkill(root);
  const after = await auditSkill(root, { config: { maxLines: 1 } });
  const diff = compareReports(before, after);
  assert.equal(diff.comparable, false);
  assert.ok(diff.scores.every(s => s.delta === null));
  assert.equal(diff.introduced.length, 1);
  const same = compareReports(before, before);
  assert.equal(same.comparable, true);
  assert.equal(same.introduced.length, 0);
  assert.throws(() => compareReports({ ...before, scores: [...before.scores, before.scores[0]] }, before), /唯一/);
  await writeFile(join(root, 'SKILL.md'), `${validEntry}\nExtra content.`);
  const changed = compareReports(before, await auditSkill(root));
  assert.equal(changed.comparable, true);
  assert.notEqual(changed.before.fingerprint, changed.after.fingerprint);
});
test('diff shows additions, removals and resource changes', async t => {
  const before = await parseSkill(await fixture(t, { 'SKILL.md': validEntry, 'references/old.md': '# Old' }));
  const after = await parseSkill(await fixture(t, { 'SKILL.md': `${validEntry}\nUse the script.`, 'scripts/new.mjs': 'export const x = 1;' }));
  const diff = diffSkills(before, after);
  assert.ok(diff.includes('+Use the script.'));
  assert.ok(diff.includes('-# Old'));
  assert.ok(diff.includes('+export const x = 1;'));
});
test('sample captured outputs can be graded through CLI without a provider', async () => {
  const output = capture();
  const code = await main(['eval', '--cases', resolve('examples/record-normalizer/tests'), '--outputs', resolve('examples/captured-outputs.json')], output.io);
  assert.equal(code, 0, output.result().stderr);
  const parsed = JSON.parse(output.result().stdout) as { mode: string; summary: { with_skill: { passed: number }; without_skill: { failed: number } } };
  assert.equal(parsed.mode, 'import');
  assert.equal(parsed.summary.with_skill.passed, 3);
  assert.equal(parsed.summary.without_skill.failed, 3);
});
