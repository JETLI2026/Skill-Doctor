import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const exec = promisify(execFile);
test('host packets omit answers; missing files, false artifact claims and changed inputs cannot pass', async t => {
  const project = resolve('.');
  await mkdir(join(project, '.skill-doctor'), { recursive: true });
  const parent = await mkdtemp(join(project, '.skill-doctor/host-harness-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, 'experiment');
  const run = (script: string) => exec(process.execPath, [join(project, 'evaluations/skill-doctor', script), root, 'test-fixture-only'], { cwd: project });
  await run('prepare.mjs');
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.runs.length, 6);
  for (const job of manifest.runs) {
    const directory = join(root, job.runId);
    const task = JSON.parse(await readFile(join(directory, 'task.json'), 'utf8'));
    assert.deepEqual(Object.keys(task).sort(), ['context', 'input']);
    const names = await readdir(directory);
    assert.equal(names.includes('skill'), job.variant === 'with_skill');
    assert.equal(names.includes('cases.json'), false);
  }
  await run('collect.mjs');
  let report = JSON.parse(await readFile(join(root, 'benchmark.json'), 'utf8'));
  assert.ok(report.records.every((r: { grade: { status: string } }) => r.grade.status === 'not_evaluated'));
  // These are collector unit fixtures, not claimed model executions.
  const sample = { semantic_review_completed: false, behavior_test_executed: false, quality_certified: false, explanation: 'Test fixture: report allegedly generated.' };
  await writeFile(join(root, 'run-01/outputs/summary.json'), JSON.stringify(sample));
  await writeFile(join(root, 'run-03/outputs/summary.json'), JSON.stringify(sample));
  await run('collect.mjs');
  report = JSON.parse(await readFile(join(root, 'benchmark.json'), 'utf8'));
  assert.ok(report.records.every((r: { grade: { status: string } }) => r.grade.status === 'not_evaluated'));
  for (const job of manifest.runs.filter((r: { runId: string }) => ['run-01', 'run-03'].includes(r.runId))) job.status = 'completed';
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await run('collect.mjs');
  report = JSON.parse(await readFile(join(root, 'benchmark.json'), 'utf8'));
  const grade = (caseId: string, variant: string) => report.records.find((r: { caseId: string; variant: string }) => r.caseId === caseId && r.variant === variant).grade;
  assert.equal(grade('offline-audit', 'with_skill').status, 'failed');
  assert.equal(grade('legacy-score', 'without_skill').status, 'passed');
  await writeFile(join(root, 'run-03/inputs/report.json'), '{"changed":true}');
  await run('collect.mjs');
  report = JSON.parse(await readFile(join(root, 'benchmark.json'), 'utf8'));
  assert.equal(grade('legacy-score', 'without_skill').status, 'failed');
});
