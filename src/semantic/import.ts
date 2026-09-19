import { z } from 'zod';
import type { PatchCandidate, Skill } from '../domain/model.ts';
import { assessmentsSchema, semanticResponseSchema } from './schema.ts';
import { validateSemanticResponse } from './reviewer.ts';
import { semanticContext } from './context.ts';

export const semanticImportSchema = z.object({
  schemaVersion: z.literal('1.0'), sourceFingerprint: z.string().min(1),
  reviewer: z.string().trim().min(1), reviewedFiles: z.array(z.string()).min(1),
  assessments: assessmentsSchema,
  findings: semanticResponseSchema.shape.findings,
  patches: semanticResponseSchema.shape.patches.default([]),
}).strict();

export function importSemanticReview(skill: Skill, candidates: PatchCandidate[], input: unknown) {
  const data = semanticImportSchema.parse(input);
  if (data.sourceFingerprint !== skill.fingerprint) throw new Error('语义导入的源指纹不匹配，请重新审查当前文件。');
  // Import is a host review; no provider request/context-window limit applies here.
  const expected = semanticContext(skill, Number.MAX_SAFE_INTEGER).files.sort();
  if (JSON.stringify([...data.reviewedFiles].sort()) !== JSON.stringify(expected)) throw new Error('语义导入须声明完整且唯一的待审文件清单。');
  const selected = candidates.filter(c => data.patches.some(p => p.candidateId === c.id));
  const review = validateSemanticResponse(skill, selected, { findings: data.findings, patches: data.patches, assessments: data.assessments }, expected);
  return { ...review, reviewer: data.reviewer };
}
