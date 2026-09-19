import { assessmentsSchema } from '../semantic/schema.ts';
import { dimensions, type DesignAssessment, type DimensionScore, type Finding } from '../domain/model.ts';
export function scoreDimensions(findings: Finding[], semanticComplete: boolean, assessments: DesignAssessment[] = []): DimensionScore[] {
  if (assessments.length) assessmentsSchema.parse(assessments);
  const points = { info: 0, warning: 6, error: 12 };
  return dimensions.map(dimension => {
    const evidenceFindings = findings.filter(finding => finding.dimensions.includes(dimension) && points[finding.severity] > 0);
    const assessment = assessments.find(a => a.dimension === dimension);
    const unavailable = !assessment && ['responsibility_boundary', 'exception_handling'].includes(dimension) && !evidenceFindings.length;
    const perRule = new Map<string, number>();
    let remainingBudget = 100;
    const deductions = evidenceFindings.map(finding => {
      if (!finding.evidence.length) throw new Error('评分拒绝无证据的扣分。');
      const charged = Math.min(points[finding.severity], 24 - (perRule.get(finding.ruleId) ?? 0), remainingBudget);
      perRule.set(finding.ruleId, (perRule.get(finding.ruleId) ?? 0) + charged);
      remainingBudget -= charged;
      return { findingId: finding.id, points: charged, evidence: finding.evidence };
    }).filter(deduction => deduction.points > 0);
    const missingEvidence = [
      ...(!semanticComplete ? ['语义审查未完成。'] : []),
      '行为评测独立报告，未运行不扣设计分。',
      ...(!assessment ? ['尚未完成四项设计标准的逐项审查。'] : []),
    ];
    const penaltyPoints = deductions.reduce((sum, d) => sum + d.points, 0);
    const applicable = assessment?.criteria.filter(c => c.verdict !== 'not_applicable');
    const rubricScore = applicable?.length ? Math.round(100 * applicable.reduce((sum, c) => sum + (c.verdict === 'met' ? 1 : c.verdict === 'partial' ? 0.5 : 0), 0) / applicable.length) : null;
    // Use the stricter of rubric and defect ceiling; never charge the same semantic defect twice.
    const score = rubricScore === null ? unavailable ? null : 100 - penaltyPoints : Math.min(rubricScore, 100 - penaltyPoints);
    return { dimension, score, status: assessment ? 'assessed' : unavailable ? 'not_evaluated' : 'partial', deductions, assessment,
      penaltyPoints: deductions.reduce((sum, deduction) => sum + deduction.points, 0), findingCount: evidenceFindings.length, missingEvidence,
      explanation: assessment ? '设计审查分：四项标准达成率与缺陷上限取较低值；不代表执行成功率。' : unavailable ? '尚未进行此维度的语义设计审查。' : '静态暂评分：100 减已发现缺陷扣分，完整设计分需语义审查。' };
  });
}
