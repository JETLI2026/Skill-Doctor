import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { defaultConfig, type Config } from '../config.ts';
import type { Evidence, ParseIssue, ResourceKind, Skill, SkillFile } from '../domain/model.ts';
import { hash, slash } from '../domain/util.ts';
import { frontmatter, parseMarkdown } from './markdown.ts';

const resourceKinds = new Set(['references', 'scripts', 'templates', 'tests', 'assets', 'agents']);
const textExtensions = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx', '.py', '.sh', '.bash', '.ps1', '.sql', '.csv', '.toml', '.html']);
export const within = (root: string, target: string): boolean => {
  const rel = relative(root, target);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`);
};
export async function parseSkill(input: string, config: Config = defaultConfig): Promise<Skill> {
  const inputPath = await realpath(input);
  if ((await stat(inputPath)).isFile() && basename(inputPath) !== 'SKILL.md') throw new Error('入口文件必须命名为 SKILL.md。');
  const root = (await stat(inputPath)).isDirectory() ? inputPath : dirname(inputPath);
  const files: SkillFile[] = [], issues: ParseIssue[] = [];
  let metadata: Record<string, unknown> = {}, totalBytes = 0, count = 0;
  const issue = (code: string, file: string, message: string): void => { issues.push({ code, message, evidence: { file, startLine: 1, endLine: 1, quote: file } }); };
  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 32) { issue('structure.depth', slash(relative(root, dir)), '目录嵌套超过 32 层，已跳过。'); return; }
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.name === '__pycache__' || /\.py[co]$/i.test(entry.name) || config.ignore.includes(entry.name) || entry.name.startsWith('.env.')) continue;
      const abs = resolve(dir, entry.name), path = slash(relative(root, abs));
      if (++count > config.maxFiles) throw new Error(`文件 / 目录数量超过 maxFiles=${config.maxFiles}，未生成不完整审查。`);
      if (entry.isSymbolicLink()) { issue('structure.symlink', path, '符号链接未读取，请使用包内普通文件。'); continue; }
      if (entry.isDirectory()) { await walk(abs, depth + 1); continue; }
      if (!entry.isFile()) continue;
      const size = (await stat(abs)).size;
      totalBytes += size;
      if (size > config.maxFileBytes || totalBytes > config.maxTotalBytes) throw new Error(`读取限制超出：${path}；调整 maxFileBytes / maxTotalBytes 后重试。`);
      const bytes = await readFile(abs);
      let content: string | undefined;
      if (textExtensions.has(extname(path).toLowerCase())) {
        try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); }
        catch { issue('structure.encoding', path, '文本文件不是有效 UTF-8。'); }
      }
      const head = path.split('/')[0]!;
      const kind: ResourceKind = path === 'SKILL.md' ? 'entry' : resourceKinds.has(head) ? head as ResourceKind : 'other';
      let body = content;
      if (kind === 'entry' && content !== undefined) {
        const fm = frontmatter(content); metadata = fm.metadata; body = fm.body;
        if (fm.error) issues.push({ code: 'structure.frontmatter', message: fm.error, evidence: { file: path, startLine: 1, endLine: 1, quote: content.split('\n')[0] ?? '' } });
      }
      const markdown = content !== undefined && extname(path).toLowerCase() === '.md' ? parseMarkdown(path, content, body) : { blocks: [], links: [], sections: [], anchors: [] };
      files.push({ path, kind, bytes: size, hash: hash(bytes.toString('base64')), content, ...markdown });
    }
  }
  await walk(root);
  const entry = files.find(file => file.path === 'SKILL.md');
  if (!entry?.content?.trim()) throw new Error('缺少可读取且非空的 SKILL.md。');
  const known = new Map(files.map(file => [file.path, file]));
  for (const file of files) for (const link of file.links) {
    if (/^(?:https?:|mailto:)/i.test(link.target)) { link.external = true; continue; }
    if (/^[a-z][a-z\d+.-]*:/i.test(link.target) || link.target.startsWith('//')) { link.problem = '不支持的引用协议或绝对路径。'; continue; }
    const [targetPath, ...fragment] = link.target.split('#');
    let cleanPath: string, anchor: string;
    try { cleanPath = decodeURIComponent(targetPath!.split('?')[0]!); anchor = decodeURIComponent(fragment.join('#')); }
    catch { link.problem = '引用包含无效 URL 编码。'; continue; }
    const absolute = cleanPath ? resolve(root, dirname(file.path), cleanPath) : resolve(root, file.path);
    if (!within(root, absolute) || isAbsolute(cleanPath) || /^[a-z]:/i.test(cleanPath)) { link.problem = '引用超出 Skill 根目录。'; continue; }
    link.resolved = slash(relative(root, absolute));
    link.anchor = anchor;
    const target = known.get(link.resolved);
    if (!target) { link.problem = '引用文件不存在、已忽略或不是普通文件。'; continue; }
    if (link.anchor && extname(target.path).toLowerCase() === '.md' && !target.anchors.includes(link.anchor)) link.problem = '引用的标题锚点不存在。';
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return { root, name: typeof metadata.name === 'string' ? metadata.name : basename(root), metadata, files, issues, fingerprint: hash(files.map(file => `${file.path}:${file.hash}`).join('\n')) };
}
export function entryEvidence(skill: Skill): Evidence {
  const file = skill.files.find(f => f.path === 'SKILL.md')!;
  return { file: file.path, startLine: 1, endLine: 1, quote: file.content!.split('\n')[0]! };
}
