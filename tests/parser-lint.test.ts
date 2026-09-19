import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSkill } from '../src/parser/index.ts';
import { lintSkill } from '../src/lint/index.ts';
import { defaultConfig } from '../src/config.ts';
import { frontmatter } from '../src/parser/markdown.ts';
import { estimateTokens } from '../src/domain/util.ts';
import { fixture, validEntry } from './helpers.ts';

test('parses nested resources, BOM/CRLF, multiline YAML and source line numbers', async t => {
  const root = await fixture(t, { 'SKILL.md': '\uFEFF---\r\nname: test-skill\r\ndescription: >-\r\n  Normalize records\r\n  when asked.\r\n---\r\n# 工作流\r\n\r\n必须返回 JSON。\r\n', 'references/sub/guide.md': '# Guide', 'scripts/run.py': 'print(1)', 'templates/record.json': '{}', 'tests/case.json': '{}' });
  const skill = await parseSkill(root);
  assert.equal(skill.metadata.description, 'Normalize records when asked.');
  assert.equal(skill.files.length, 5);
  assert.equal(skill.files.find(f => f.kind === 'entry')!.blocks[1]!.evidence.startLine, 9);
  assert.equal(skill.files.find(f => f.kind === 'scripts')!.content, 'print(1)');
});
test('does not count fenced code or block quotes as active rules and conditions', async t => {
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n\`\`\`md\n禁止。如果遇到。\n[missing](ghost.md)\n\`\`\`\n> 不要示例。\n\n如果失败，必须返回原因。\n` });
  const { metrics, findings } = lintSkill(await parseSkill(root));
  assert.equal(metrics.prohibitionCount, 0);
  assert.equal(metrics.conditionCount, 1);
  assert.ok(!findings.some(f => f.ruleId === 'references.invalid'));
});
test('checks relative links, reference-style links, anchors and transitive reachability', async t => {
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n[guide][g]\n\n[g]: references/guide.md#guide\n\n[broken](references/guide.md#absent)\n[escape](../outside.md)\n[web](https://example.test)\n`, 'references/guide.md': '# Guide\n[detail](detail.md)\n', 'references/detail.md': '# Detail\n', 'references/orphan.md': '# Orphan' });
  const { findings } = lintSkill(await parseSkill(root));
  assert.equal(findings.filter(f => f.ruleId === 'references.invalid').length, 2);
  assert.deepEqual(findings.filter(f => f.ruleId === 'references.orphan').map(f => f.evidence[0]!.file), ['references/orphan.md']);
});
test('duplicate findings retain both source locations and survive line shifts', async t => {
  const paragraph = '必须验证用户提供的所有数据字段并返回具体错误原因。';
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n${paragraph}\n\n${paragraph}\n` });
  const before = lintSkill(await parseSkill(root)).findings.find(f => f.ruleId === 'duplication.exact')!;
  assert.equal(before.evidence.length, 2);
  await writeFile(join(root, 'SKILL.md'), `${validEntry}\n\n${paragraph}\n\n${paragraph}\n`);
  const after = lintSkill(await parseSkill(root)).findings.find(f => f.ruleId === 'duplication.exact')!;
  assert.equal(before.id, after.id);
});
test('fails explicitly on absent entry and resource limits', async t => {
  const root = await fixture(t, { 'references/a.md': 'hello' });
  await assert.rejects(parseSkill(root), /SKILL.md/);
  await writeFile(join(root, 'SKILL.md'), validEntry);
  await assert.rejects(parseSkill(root, { ...defaultConfig, maxFileBytes: 5 }), /读取限制/);
});
test('skips package-manager stores by default so project audits do not consume cache files', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry, '.pnpm-store/v11/files/cache.md': '# cached package content' });
  const skill = await parseSkill(root);
  assert.ok(!skill.files.some(file => file.path.startsWith('.pnpm-store/')));
});
test('rejects invalid YAML metadata without crashing', () => {
  assert.ok(frontmatter('---\nname: a\nname: b\n---').error);
  assert.ok(frontmatter('---\n- item\n---').error);
  assert.ok(frontmatter('---\nname: a').error);
});
test('symlink resources cannot be used to read outside the skill', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  try { await symlink(join(root, 'SKILL.md'), join(root, 'linked.md')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Windows symlink permission unavailable'); return; } throw error; }
  const skill = await parseSkill(root);
  assert.ok(skill.issues.some(i => i.code === 'structure.symlink'));
  assert.ok(!skill.files.some(f => f.path === 'linked.md'));
});
test('token estimates count Chinese and Latin and thresholds are configurable', async t => {
  assert.equal(estimateTokens('中文'), 3);
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const result = lintSkill(await parseSkill(root), { ...defaultConfig, maxTokens: 1 });
  assert.ok(result.findings.some(f => f.ruleId === 'length.tokens'));
});
test('URL-encoded hash and question mark in filenames are not mistaken for fragments', async t => {
  const root = await fixture(t, { 'SKILL.md': `${validEntry}\n[hash](references/a%23b.md#guide)`, 'references/a#b.md': '# Guide' });
  const result = lintSkill(await parseSkill(root));
  assert.ok(!result.findings.some(f => f.ruleId === 'references.invalid'));
});
test('recognized regression folders validate cases instead of trusting file presence', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry, 'tests/regression-cases/empty.json': '{"assertions":[]}' });
  const result = lintSkill(await parseSkill(root));
  assert.ok(result.findings.some(f => f.ruleId === 'tests.invalid-case'));
});
