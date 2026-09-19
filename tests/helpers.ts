import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
export const validEntry = '---\nname: test-skill\ndescription: Transform records when asked to normalize input.\n---\n# Record workflow\n\nReturn the normalized record.\n';
export async function fixture(t: TestContext, files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skill-doctor-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
  return root;
}
