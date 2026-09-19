import type { Evidence, Skill } from '../domain/model.ts';
import { defaultConfig } from '../config.ts';
export function semanticContext(skill: Skill, maxChars = defaultConfig.maxSemanticChars) {
  const files = skill.files.filter(file => file.content !== undefined && (['entry', 'references', 'scripts', 'templates', 'tests'].includes(file.kind) || file.kind === 'other' && /\.(?:py|[cm]?js|ts|sh|ps1)$/.test(file.path)));
  const data = files.map(file => ({ path: file.path, kind: file.kind, lines: file.content!.split('\n').map((text, index) => ({ line: index + 1, text })) }));
  const payload = JSON.stringify(data);
  if (payload.length > maxChars) throw new Error(`语义上下文 ${payload.length} 字符超过 maxSemanticChars=${maxChars}；未静默截断。请拆分 Skill 或调整限制。`);
  return { files: files.map(file => file.path), data };
}
export function verifyEvidence(skill: Skill, evidence: Evidence, allowedFiles?: string[]): void {
  const file = skill.files.find(file => file.path === evidence.file);
  if (!file?.content || (allowedFiles && !allowedFiles.includes(evidence.file))) throw new Error(`无法核验语义证据文件：${evidence.file}`);
  const lines = file.content.split('\n');
  if (evidence.startLine < 1 || evidence.endLine < evidence.startLine || evidence.endLine > lines.length || !evidence.quote.trim() || !lines.slice(evidence.startLine - 1, evidence.endLine).join('\n').includes(evidence.quote)) throw new Error(`语义证据与原文不符：${evidence.file}:${evidence.startLine}`);
}
