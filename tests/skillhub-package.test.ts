import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildSkillHubPackage } from '../src/packaging/skillhub.ts';

test('builds a small SkillHub package with only the public entry and disclosed references', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'skill-doctor-skillhub-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const output = join(parent, 'release');
  const files = await buildSkillHubPackage(resolve('.'), output);
  assert.deepEqual(files, ['SKILL.md', 'references/complete-review.md', 'references/faq.md', 'references/runtime-setup.md', 'README.md']);
  assert.equal(await readFile(join(output, 'SKILL.md'), 'utf8'), await readFile('SKILL.md', 'utf8'));
  assert.match(await readFile(join(output, 'README.md'), 'utf8'), /精简发布包/);
  await assert.rejects(buildSkillHubPackage(resolve('.'), output), /已存在/);
});
