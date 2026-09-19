import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { loadCases } from '../src/regression/cases.ts';
import { gradeCase } from '../src/regression/grader.ts';

function runScript(input: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = execFile(process.execPath, [resolve('examples/record-normalizer/scripts/normalize.mjs')], { timeout: 5000 }, (error, stdout) => error ? reject(error) : resolveOutput(stdout));
    child.stdin!.end(input);
  });
}
test('real deterministic example script passes normal, edge and historical cases', async () => {
  const cases = await loadCases('examples/record-normalizer/tests');
  for (const c of cases) {
    const output = await runScript(c.input);
    const grade = await gradeCase(c, { caseId: c.id, variant: 'with_skill', repeat: 1, output });
    assert.equal(grade.status, 'passed', `${c.id}: ${JSON.stringify(grade)}`);
  }
  assert.deepEqual(JSON.parse(await runScript('{"sku":"A"}')), { sku: 'A', quantity: 1 });
  assert.deepEqual(JSON.parse(await runScript('{"sku":"A","quantity":null}')), { error: 'INVALID_QUANTITY' });
  assert.deepEqual(JSON.parse(await runScript('[]')), { error: 'INVALID_INPUT' });
});
