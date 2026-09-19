import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateOutputs } from '../../src/regression/benchmark.ts';
import { renderBenchmarkMarkdown } from '../../src/reporting/markdown.ts';
import { readArtifact } from '../../src/regression/artifacts.ts';

if (!process.argv[2]) throw new Error('用法：node evaluations/skill-doctor/collect.mjs <run-directory>');
const root = resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
if (!manifest.model || manifest.model === 'unrecorded') throw new Error('先记录真实执行宿主的模型标识。');
const cases = JSON.parse(await readFile(join(root, 'cases.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(await readFile(manifest.cli)) !== manifest.cliHash) throw new Error('评测期间 CLI 改变，不能继续汇总为同一次实验。');
async function filesIn(directory, prefix = '') {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('输入出现符号链接。');
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) paths.push(...await filesIn(join(directory, entry.name), `${path}/`));
    else paths.push(path);
  }
  return paths.sort();
}
const outputs = [];
for (const run of manifest.runs) {
  if (!/^run-\d+$/.test(run.runId)) throw new Error('非法 runId。');
  if (run.status !== 'completed') continue; // Host completion, not partial file presence, authorizes collection.
  try {
  const directory = join(root, run.runId), outputDir = join(directory, 'outputs');
  const response = await readArtifact(outputDir, 'summary.json');
  if (response === undefined) continue; // Missing execution stays not_evaluated.
  let answer;
  try { answer = JSON.parse(response); } catch { answer = null; }
  const paths = await filesIn(join(directory, 'inputs'));
  let inputsUnchanged = JSON.stringify(paths) === JSON.stringify(Object.keys(run.inputs).sort());
  for (const path of paths) inputsUnchanged &&= hash(await readFile(join(directory, 'inputs', path))) === run.inputs[path];
  const artifacts = {}, observed = { inputsUnchanged };
  for (const assertion of cases.find(c => c.id === run.caseId).assertions.filter(a => a.type === 'artifact_exists')) {
    const content = await readArtifact(outputDir, assertion.path);
    if (content !== undefined) artifacts[assertion.path] = content;
  }
  if (run.caseId === 'offline-audit') {
    let audit;
    try { audit = JSON.parse(artifacts['audit.json'] ?? 'null'); } catch { audit = null; }
    observed.semanticStatus = audit?.semantic?.status ?? null;
    observed.missingReferenceDetected = audit?.findings?.some(f => f.ruleId === 'references.invalid' && f.evidence?.some(e => e.file === 'SKILL.md' && e.quote.includes('references/fields.md'))) ?? false;
  }
  if (run.caseId === 'mixed-policy-comparison') {
    let diff;
    try { diff = JSON.parse(artifacts['comparison.json'] ?? 'null'); } catch { diff = null; }
    observed.directlyComparable = diff?.comparable ?? null;
    observed.qualityDeltasAbsent = diff?.scores?.length === 8 && diff.scores.every(s => s.delta === null);
  }
  outputs.push({ caseId: run.caseId, variant: run.variant, repeat: run.repeat, output: JSON.stringify({ answer, observed }), artifacts });
  } catch (error) {
    outputs.push({ caseId: run.caseId, variant: run.variant, repeat: run.repeat, error: `产物收集失败：${error.message}` });
  }
}
const benchmark = await evaluateOutputs(cases, outputs, { mode: 'import', runner: `${manifest.host}:${manifest.model}`, repeats: manifest.repeats, skillFingerprints: { with_skill: manifest.skillFingerprint } });
await writeFile(join(root, 'captured-outputs.json'), JSON.stringify(outputs, null, 2));
await writeFile(join(root, 'benchmark.json'), JSON.stringify(benchmark, null, 2));
await writeFile(join(root, 'benchmark.md'), renderBenchmarkMarkdown(benchmark));
console.log(JSON.stringify({ summary: benchmark.summary, comparisons: benchmark.comparisons, notEvaluated: benchmark.records.filter(r => r.grade.status === 'not_evaluated').length }, null, 2));
