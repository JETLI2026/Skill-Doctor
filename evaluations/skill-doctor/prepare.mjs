import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCases } from '../../src/regression/schema.ts';
import { parseSkill } from '../../src/parser/index.ts';
import { scenarios } from './suite.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(process.argv[2] ?? join(project, `.skill-doctor/host-eval-${Date.now()}`));
if (relative(project, out).startsWith('..') || out === project) throw new Error('评测输出应为项目中的新目录。');
await mkdir(dirname(out), { recursive: true });
await mkdir(out); // Preserve earlier runs instead of overwriting them.
const skill = await parseSkill(join(project, 'skills/skill-doctor'));
const source = skill.files.find(f => f.path === 'SKILL.md').content;
const cli = join(project, 'dist/cli.js');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = {
  'offline-audit': { 'subject/SKILL.md': '---\nname: report-helper\ndescription: Prepare a report when asked to summarize records.\n---\n# Report workflow\nRead [the required field schema](references/fields.md) before preparing the report.\nReturn the validated report.\n' },
  'legacy-score': { 'report.json': await readFile(join(project, 'evaluations/skill-doctor/fixtures/legacy-report.json'), 'utf8') },
  'mixed-policy-comparison': { 'before.json': await readFile(join(project, 'evaluations/skill-doctor/fixtures/legacy-report.json'), 'utf8'), 'after.json': await readFile(join(project, 'evaluations/skill-doctor/fixtures/evidence-report.json'), 'utf8') },
};
const cases = parseCases(scenarios.map(s => {
  const line = source.split('\n').findIndex(text => text.includes(s.sourceText));
  if (line < 0) throw new Error(`Source rule moved: ${s.id}`);
  return { schemaVersion: '1.0', id: s.id, title: s.title, category: s.category, status: 'ready', input: s.input, context: '使用相同 CLI 和独立目录完成本地任务；本轮不发起外部模型调用。', expected_behavior: [s.title], forbidden_behavior: ['修改原输入，或将未执行的检查声称已通过。'], assertions: [...s.assertions.map(([id, path, value]) => ({ id, type: 'json_path_equals', path, value })), ...s.artifacts.map((path, i) => ({ id: `artifact-${i}`, type: 'artifact_exists', path }))], source_rule: [{ file: 'SKILL.md', startLine: line + 1, endLine: line + 1, quote: source.split('\n')[line] }], sourceFingerprint: skill.fingerprint };
}));
const runs = [];
for (const [index, c] of cases.entries()) {
  // Alternate order; each host agent gets one task and a fresh conversation.
  const variants = index % 2 ? ['without_skill', 'with_skill'] : ['with_skill', 'without_skill'];
  for (const variant of variants) {
    const runId = `run-${String(runs.length + 1).padStart(2, '0')}`, directory = join(out, runId);
    await mkdir(join(directory, 'outputs'), { recursive: true });
    const inputs = {};
    for (const [path, text] of Object.entries(files[c.id])) {
      const target = join(directory, 'inputs', path);
      await mkdir(dirname(target), { recursive: true }); await writeFile(target, text);
      inputs[path] = hash(text);
    }
    if (variant === 'with_skill') { await mkdir(join(directory, 'skill')); await copyFile(join(project, 'skills/skill-doctor/SKILL.md'), join(directory, 'skill/SKILL.md')); }
    const task = { input: c.input, context: c.context };
    await writeFile(join(directory, 'task.json'), JSON.stringify(task, null, 2));
    runs.push({ runId, caseId: c.id, variant, repeat: 1, directory, inputs, status: 'pending' });
  }
}
await writeFile(join(out, 'cases.json'), JSON.stringify(cases, null, 2));
await writeFile(join(out, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), cli, cliHash: hash(await readFile(cli)), skillFingerprint: skill.fingerprint, host: 'Codex collaboration agents', model: process.argv[3] ?? 'unrecorded', repeats: 1, runs }, null, 2));
console.log(JSON.stringify({ output: out, cli, runs: runs.map(({ directory, runId, variant }) => ({ directory, runId, variant })) }, null, 2));
