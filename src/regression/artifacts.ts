import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Read host-produced files, never a model's assertion that an artifact exists. */
export async function readArtifact(root: string, path: string, maxBytes = 1_048_576): Promise<string | undefined> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('产物大小限制必须是正整数。');
  if (isAbsolute(path) || path.includes(':') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('产物必须使用包内相对路径。');
  if ((await lstat(root)).isSymbolicLink()) throw new Error('拒绝符号链接输出目录。');
  const base = await realpath(root);
  let current = base;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('拒绝符号链接产物。'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  }
  const actual = await realpath(current), inside = relative(base, actual);
  if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('产物超出输出目录。');
  const info = await lstat(actual);
  if (!info.isFile() || info.size > maxBytes) throw new Error('产物不是普通文件或超过大小限制。');
  const bytes = await readFile(actual);
  if (bytes.length > maxBytes) throw new Error('产物超过大小限制。');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
