import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('public Skill entry uses the installed CLI without local host paths', async () => {
  const entry = await readFile(resolve('skills/skill-doctor/SKILL.md'), 'utf8');
  assert.match(entry, /skill-doctor audit/);
  assert.doesNotMatch(entry, /[A-Z]:\\|C:\\Users\\/i);
});
