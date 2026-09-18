import test from 'node:test';
import assert from 'node:assert/strict';
import { readArtifact } from '../src/regression/artifacts.ts';
import { fixture } from './helpers.ts';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

test('host artifact collection reads actual files and leaves absent artifacts missing', async t => {
  const root = await fixture(t, { 'outputs/result.json': '{"ok":true}' });
  assert.equal(await readArtifact(root, 'outputs/result.json'), '{"ok":true}');
  assert.equal(await readArtifact(root, 'outputs/missing.txt'), undefined);
});
test('host artifact collection rejects escapes, large files and directory artifacts', async t => {
  const root = await fixture(t, { 'outputs/result.txt': '12345' });
  for (const path of ['../secret', '/secret', 'C:/secret', 'outputs\\result.txt']) await assert.rejects(readArtifact(root, path));
  await assert.rejects(readArtifact(root, 'outputs/result.txt', 4), /大小限制/);
  await assert.rejects(readArtifact(root, 'outputs'), /普通文件/);
});
test('host artifact collection refuses a symlinked output directory', async t => {
  const root = await fixture(t, { 'real/result.txt': 'external' });
  await symlink(join(root, 'real'), join(root, 'alias'), 'junction');
  await assert.rejects(readArtifact(root, 'alias/result.txt'), /符号链接/);
  await assert.rejects(readArtifact(join(root, 'alias'), 'result.txt'), /符号链接/);
});
