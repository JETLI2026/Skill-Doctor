import { z } from 'zod';
import { evidenceSchema } from '../semantic/schema.ts';
const assertionId = z.string().regex(/^[a-zA-Z0-9_-]+$/).max(80);
export const assertionSchema = z.discriminatedUnion('type', [
  z.object({ id: assertionId, type: z.literal('contains'), value: z.string().min(1) }).strict(),
  z.object({ id: assertionId, type: z.literal('not_contains'), value: z.string().min(1) }).strict(),
  z.object({ id: assertionId, type: z.literal('equals'), value: z.string().min(1) }).strict(),
  z.object({ id: assertionId, type: z.literal('json_equals'), value: z.json() }).strict(),
  z.object({ id: assertionId, type: z.literal('json_path_equals'), path: z.string().regex(/^(?:|\/.*)$/), value: z.json() }).strict(),
  z.object({ id: assertionId, type: z.literal('artifact_exists'), path: z.string().min(1) }).strict(),
  z.object({ id: assertionId, type: z.literal('rubric'), rubric: z.string().min(1) }).strict(),
]);
export const caseSchema = z.object({
  schemaVersion: z.literal('1.0'), id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), title: z.string().min(1),
  category: z.enum(['golden-cases', 'edge-cases', 'regression-cases']), status: z.enum(['draft', 'ready']),
  input: z.string().min(1), context: z.string(), expected_behavior: z.array(z.string().min(1)).min(1), forbidden_behavior: z.array(z.string().min(1)),
  assertions: z.array(assertionSchema).min(1).max(100), source_rule: z.array(evidenceSchema).min(1), sourceFingerprint: z.string().min(1),
}).strict().refine(value => new Set(value.assertions.map(a => a.id)).size === value.assertions.length, 'assertion id 重复。');
export type RegressionCase = z.infer<typeof caseSchema>;
export type Assertion = z.infer<typeof assertionSchema>;
export const capturedOutputSchema = z.object({
  caseId: z.string().min(1), variant: z.enum(['with_skill', 'without_skill', 'baseline']), repeat: z.number().int().min(1).max(20),
  output: z.string().optional(), artifacts: z.record(z.string(), z.string()).optional(), error: z.string().min(1).optional(),
  durationMs: z.number().nonnegative().optional(), usage: z.object({ promptTokens: z.number().nonnegative(), completionTokens: z.number().nonnegative() }).strict().optional(),
}).strict().refine(v => (v.output !== undefined) !== (v.error !== undefined), '必须提供 output 或 error，且不能同时提供。');
export type CapturedOutput = z.infer<typeof capturedOutputSchema>;
export type Variant = CapturedOutput['variant'];
export function parseCases(data: unknown): RegressionCase[] {
  const cases = z.array(caseSchema).min(1).max(500).parse(data);
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('case id 重复。');
  return cases;
}
