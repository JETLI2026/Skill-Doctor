import { createHash } from 'node:crypto';
export const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
export const stableId = (...parts: string[]): string => hash(parts.join('\0')).slice(0, 16);
export const normalize = (text: string): string => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
export function estimateTokens(text: string): number {
  const cjk = [...text.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)].length;
  return Math.ceil(cjk * 1.5 + (Array.from(text).length - cjk) / 4);
}
export const slash = (text: string): string => text.replaceAll('\\', '/');
