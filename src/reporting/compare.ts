import { z } from 'zod';
import { dimensions } from '../domain/model.ts';
import { evidenceSchema } from '../semantic/schema.ts';
import { dimensionLabels } from './labels.ts';
const snapshotSchema = z.object({
  schemaVersion: z.enum(['1.0', '1.1', '1.2']), toolVersion: z.string(),
  scoringPolicy: z.enum(['legacy-remaining-points', 'evidence-first-v1', 'design-review-v1']).default('legacy-remaining-points'),
  skill: z.object({ name: z.string(), fingerprint: z.string() }), config: z.record(z.string(), z.unknown()),
  semantic: z.object({ status: z.enum(['not_requested', 'completed', 'failed']), provider: z.string().optional() }),
  metrics: z.object({ lines: z.number(), estimatedTokens: z.number(), ruleCount: z.number(), conditionCount: z.number() }),
  findings: z.array(z.object({ id: z.string(), ruleId: z.string(), message: z.string(), evidence: z.array(evidenceSchema).min(1) })),
  scores: z.array(z.object({ dimension: z.enum(dimensions), score: z.number().min(0).max(100).nullable(), status: z.enum(['partial', 'assessed', 'not_evaluated']), penaltyPoints: z.number().min(0).max(100).optional() })),
}).refine(report => report.schemaVersion !== '1.1' || report.scoringPolicy === 'evidence-first-v1' && report.scores.every(s => s.score === null && s.penaltyPoints !== undefined && s.status !== 'assessed'), '报告与证据优先评分协议不符。').refine(report => report.schemaVersion !== '1.2' || report.scoringPolicy === 'design-review-v1', '报告与设计评分协议不符。');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function compareReports(beforeInput: unknown, afterInput: unknown) {
  const before = snapshotSchema.parse(beforeInput), after = snapshotSchema.parse(afterInput);
  if (before.scores.length !== dimensions.length || after.scores.length !== dimensions.length || new Set(before.scores.map(s => s.dimension)).size !== dimensions.length || new Set(after.scores.map(s => s.dimension)).size !== dimensions.length) throw new Error('报告缺少完整且唯一的八维评分。');
  const reasons: string[] = [];
  if (before.toolVersion !== after.toolVersion) reasons.push('工具版本不同');
  if (canonical(before.config) !== canonical(after.config)) reasons.push('检查配置不同');
  if (canonical(before.semantic) !== canonical(after.semantic) || before.semantic.status === 'failed') reasons.push('语义评估状态或模型不一致，或评估失败');
  if (before.scoringPolicy !== after.scoringPolicy) reasons.push('评分口径不同');
  if ([before.scoringPolicy, after.scoringPolicy].includes('legacy-remaining-points')) reasons.push('旧版 100−扣分是缺陷剩余分，不能作为质量分或质量提升依据');
  const comparable = reasons.length === 0;
  const beforeIds = new Set(before.findings.map(f => f.id)), afterIds = new Set(after.findings.map(f => f.id));
  return {
    schemaVersion: '1.1', before: before.skill, after: after.skill, beforePolicy: before.scoringPolicy, afterPolicy: after.scoringPolicy, comparable, reasons,
    metricsDelta: Object.fromEntries(Object.keys(before.metrics).map(key => [key, after.metrics[key as keyof typeof after.metrics] - before.metrics[key as keyof typeof before.metrics]])),
    scores: dimensions.map(dimension => {
      const a = before.scores.find(s => s.dimension === dimension)!, b = after.scores.find(s => s.dimension === dimension)!;
      return { dimension, before: a.score, after: b.score, delta: comparable && a.status === b.status && a.score !== null && b.score !== null ? b.score - a.score : null,
        penaltyBefore: a.penaltyPoints ?? null, penaltyAfter: b.penaltyPoints ?? null,
        penaltyDelta: comparable && a.status === b.status && a.penaltyPoints !== undefined && b.penaltyPoints !== undefined ? b.penaltyPoints - a.penaltyPoints : null };
    }),
    introduced: after.findings.filter(f => !beforeIds.has(f.id)), resolved: before.findings.filter(f => !afterIds.has(f.id)),
    unchangedCount: after.findings.filter(f => beforeIds.has(f.id)).length,
    interpretation: '同口径、同覆盖范围下比较设计分；设计分变化不证明行为改善，行为效果使用固定案例单独验证。',
  };
}
export function renderComparisonMarkdown(diff: ReturnType<typeof compareReports>): string {
  const quality = (value: number | null, policy: string) => policy === 'legacy-remaining-points' && value !== null ? `旧口径 ${value}（非质量分）` : policy === 'design-review-v1' && value !== null ? `${value} / 100` : '未评估';
  return ['# Skill Doctor · 审查差异', '', `${diff.before.name} → ${diff.after.name}`, '', `检查条件可比：${diff.comparable ? '是' : `否（${diff.reasons.join('；')}）`}`, '', '| 维度 | 原质量分 | 新质量分 | 设计分变化 | 原问题负担 | 新问题负担 | 问题负担变化 |', '| --- | --- | --- | --- | --- | --- | --- |', ...diff.scores.map(s => `| ${dimensionLabels[s.dimension]} | ${quality(s.before, diff.beforePolicy)} | ${quality(s.after, diff.afterPolicy)} | ${s.delta ?? '不可比'} | ${s.penaltyBefore ?? '未提供'} | ${s.penaltyAfter ?? '未提供'} | ${s.penaltyDelta ?? '不可比'} |`), '', `新增 ${diff.introduced.length} · 消失 ${diff.resolved.length} · 保留 ${diff.unchangedCount}`, '', ...diff.introduced.map(f => `- 新增 ${f.ruleId}：${f.message}`), ...diff.resolved.map(f => `- 消失 ${f.ruleId}：${f.message}`), '', diff.interpretation, ''].join('\n');
}
