import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const packageFiles = [
  ['SKILL.md', 'SKILL.md'],
  ['references/complete-review.md', 'references/complete-review.md'],
  ['references/faq.md', 'references/faq.md'],
  ['references/runtime-setup.md', 'references/runtime-setup.md'],
  ['packaging/skillhub/README.md', 'README.md'],
] as const;

export async function buildSkillHubPackage(projectRoot: string, output: string): Promise<string[]> {
  const root = resolve(projectRoot);
  const destination = resolve(output);
  if (root === destination) throw new Error('发布包输出目录不能是项目根目录。');
  try { await stat(destination); throw new Error(`发布包输出目录已存在：${destination}`); }
  catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
  await mkdir(destination, { recursive: true });
  for (const [source, target] of packageFiles) {
    const from = resolve(root, source);
    const to = resolve(destination, target);
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
  }
  return packageFiles.map(([, target]) => target);
}
