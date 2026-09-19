import type { PatchAnalysis, PatchCandidate, Skill } from '../domain/model.ts';
import { safetyPattern, signalPatterns } from '../lint/signals.ts';
export function detectPatchCandidates(skill: Skill): PatchCandidate[] {
  return skill.files.filter(file => ['entry', 'references'].includes(file.kind)).flatMap(file => file.blocks.filter(block => block.kind === 'paragraph' && !block.inQuote).flatMap(block => {
    const signals = signalPatterns.filter(([, pattern]) => pattern.test(block.text)).map(([signal]) => signal);
    return signals.length ? [{ id: block.id, source: block.evidence, signals, safetySensitive: safetyPattern.test(block.text) }] : [];
  }));
}
export function pendingPatches(candidates: PatchCandidate[]): PatchAnalysis[] {
  return candidates.map(candidate => ({ ...candidate, status: 'unreviewed', action: candidate.safetySensitive ? 'retain' : 'review', generateRegression: candidate.signals.includes('incident'), rationale: candidate.safetySensitive ? '可能涉及安全边界，先保留原规则，等待语义核验。' : '关键词仅定位候选；尚未判断根因、分类或是否应移除。' }));
}
