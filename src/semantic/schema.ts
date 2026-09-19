import { z } from 'zod';
import { dimensions } from '../domain/model.ts';
export const evidenceSchema = z.object({ file: z.string().min(1), startLine: z.number().int().positive(), endLine: z.number().int().positive(), quote: z.string().trim().min(1) }).strict();
export const assessmentsSchema = z.array(z.object({ dimension: z.enum(dimensions), criteria: z.array(z.object({ criterion: z.number().int().min(0).max(3), verdict: z.enum(['met', 'partial', 'unmet', 'not_applicable']), rationale: z.string().trim().min(1), evidence: z.array(evidenceSchema).min(1) }).strict()).length(4) }).strict()).length(8).refine(items => new Set(items.map(x => x.dimension)).size === 8 && items.every(x => new Set(x.criteria.map(c => c.criterion)).size === 4 && x.criteria.some(c => c.verdict !== 'not_applicable')), '八维和各四项标准须唯一，维度不可全部不适用');
export const destinationSchema = z.enum(['Agent', 'Rule', 'SKILL.md', 'references', 'scripts', 'templates', 'tests']);
export const semanticKinds = ['duplicate', 'near_duplicate', 'conflict', 'ambiguous', 'unverifiable', 'responsibility', 'disclose_reference', 'extract_script', 'external_knowledge', 'exception_handling', 'no_op'] as const;
export const semanticResponseSchema = z.object({
  assessments: assessmentsSchema.optional(),
  findings: z.array(z.object({ kind: z.enum(semanticKinds), severity: z.enum(['info', 'warning', 'error']), message: z.string().min(1), recommendation: z.string().min(1), evidence: z.array(evidenceSchema).min(1) }).strict()).max(200),
  patches: z.array(z.object({ candidateId: z.string().min(1), category: z.enum(['general_principle', 'business_knowledge', 'deterministic_logic', 'historical_incident', 'duplicate_rule', 'core_safety_boundary']), rootCause: z.string().min(1), rootCauseStatus: z.enum(['hypothesis', 'explicit']), principle: z.string().min(1), destination: destinationSchema, action: z.enum(['retain', 'move', 'merge']), generateRegression: z.boolean(), rationale: z.string().min(1) }).strict()).max(500),
}).strict();
export type SemanticResponse = z.infer<typeof semanticResponseSchema>;
