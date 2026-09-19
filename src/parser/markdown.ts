import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { parseDocument } from 'yaml';
import type { Block, Evidence, Link, ParseIssue, Section } from '../domain/model.ts';
import { estimateTokens, normalize, stableId } from '../domain/util.ts';

export function frontmatter(content: string): { metadata: Record<string, unknown>; body: string; error?: string } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return { metadata: {}, body: content, error: '缺少 YAML frontmatter。' };
  const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
  if (end < 0) return { metadata: {}, body: content, error: 'YAML frontmatter 未闭合。' };
  const body = lines.map((line, i) => i <= end ? '' : line).join('\n');
  try {
    const doc = parseDocument(lines.slice(1, end).join('\n'), { uniqueKeys: true });
    if (doc.errors.length) throw new Error(doc.errors[0]!.message);
    const data: unknown = doc.toJS({ maxAliasCount: 20 });
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('frontmatter 必须是键值映射。');
    return { metadata: data as Record<string, unknown>, body };
  } catch (error) { return { metadata: {}, body, error: error instanceof Error ? error.message : 'YAML 无效' }; }
}

function textOf(node: Nodes): string {
  if ('value' in node) return node.value;
  if ('children' in node) return node.children.map(child => textOf(child)).join('');
  if ('alt' in node) return node.alt ?? '';
  return '';
}
export const anchorSlug = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

export function parseMarkdown(path: string, content: string, body = content) {
  const tree = fromMarkdown(body);
  const lines = content.split('\n');
  const blocks: Block[] = [], links: Link[] = [], sections: Section[] = [], issues: ParseIssue[] = [];
  const definitions = new Map<string, string>();
  const occurrences = new Map<string, number>();
  const anchors: string[] = [];
  const evidenceOf = (node: Nodes): Evidence => ({ file: path, startLine: node.position!.start.line, endLine: node.position!.end.line, quote: lines.slice(node.position!.start.line - 1, node.position!.end.line).join('\n') });
  const visit = (node: Nodes, fn: (node: Nodes, inQuote: boolean) => void, inQuote = false): void => {
    fn(node, inQuote);
    if ('children' in node) for (const child of node.children) visit(child, fn, inQuote || node.type === 'blockquote');
  };
  visit(tree, node => { if (node.type === 'definition') definitions.set(normalize(node.identifier), node.url); });
  visit(tree, (node, inQuote) => {
    if (node.type === 'heading' || node.type === 'paragraph') {
      const text = textOf(node), key = normalize(text), n = occurrences.get(key) ?? 0;
      occurrences.set(key, n + 1);
      blocks.push({ id: stableId(path, key, String(n)), text, kind: node.type, evidence: evidenceOf(node), ...(node.type === 'heading' ? { depth: node.depth } : {}), inQuote });
      if (node.type === 'heading') {
        const base = anchorSlug(text);
        let slug = base, counter = 0;
        while (anchors.includes(slug)) slug = `${base}-${++counter}`;
        anchors.push(slug);
        sections.push({ title: text, depth: node.depth, startLine: node.position!.start.line, endLine: lines.length, tokens: 0 });
      }
    }
    if (node.type === 'link' || node.type === 'image') links.push({ target: node.url, evidence: evidenceOf(node), kind: 'markdown' });
    if (node.type === 'linkReference' || node.type === 'imageReference') {
      const target = definitions.get(normalize(node.identifier));
      if (target) links.push({ target, evidence: evidenceOf(node), kind: 'markdown' });
    }
    if (node.type === 'inlineCode' && /^(?:\.\/|\.\.\/)*(?:references|scripts|templates|tests|assets)\/[^\n]+$/u.test(node.value) && !/[\s*<>|]/u.test(node.value)) {
      links.push({ target: node.value, evidence: evidenceOf(node), kind: 'code-path' });
    }
  });
  for (const [i, section] of sections.entries()) {
    const next = sections.slice(i + 1).find(next => next.depth <= section.depth);
    section.endLine = next ? next.startLine - 1 : lines.length;
    section.tokens = estimateTokens(lines.slice(section.startLine - 1, section.endLine).join('\n'));
  }
  return { blocks, links, sections, anchors, issues };
}
