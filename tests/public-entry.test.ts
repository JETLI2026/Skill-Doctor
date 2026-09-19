import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('public Skill entry uses the installed CLI without local host paths', async () => {
  const entry = await readFile(resolve('skills/skill-doctor/SKILL.md'), 'utf8');
  assert.match(entry, /skill-doctor audit/);
  assert.doesNotMatch(entry, /[A-Z]:\\|C:\\Users\\/i);
});

test('public Skill entry requires a scope choice before an ambiguous review', async () => {
  const entry = await readFile(resolve('skills/skill-doctor/SKILL.md'), 'utf8');
  assert.match(entry, /快速静态审查/);
  assert.match(entry, /完整八维审查/);
  assert.match(entry, /等待用户选择/);
  assert.match(entry, /选择前不生成或展示评分报告/);
});

test('root SkillHub entry exactly mirrors the maintained public skill and its references', async () => {
  const [rootEntry, packagedEntry, rootCompleteReview, packagedCompleteReview, rootFaq, packagedFaq, rootRuntimeSetup, packagedRuntimeSetup] = await Promise.all([
    readFile('SKILL.md', 'utf8'),
    readFile('skills/skill-doctor/SKILL.md', 'utf8'),
    readFile('references/complete-review.md', 'utf8'),
    readFile('skills/skill-doctor/references/complete-review.md', 'utf8'),
    readFile('references/faq.md', 'utf8'),
    readFile('skills/skill-doctor/references/faq.md', 'utf8'),
    readFile('references/runtime-setup.md', 'utf8'),
    readFile('skills/skill-doctor/references/runtime-setup.md', 'utf8'),
  ]);
  assert.equal(rootEntry, packagedEntry);
  assert.equal(rootCompleteReview, packagedCompleteReview);
  assert.equal(rootFaq, packagedFaq);
  assert.equal(rootRuntimeSetup, packagedRuntimeSetup);
});
