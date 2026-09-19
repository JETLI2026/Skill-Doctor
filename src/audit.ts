import { configSchema, type Config } from './config.ts';
import { importSemanticReview } from './semantic/import.ts';
import { discoverChecks } from './lint/capabilities.ts';
import type { DesignAssessment, Report } from './domain/model.ts';
import { parseSkill } from './parser/index.ts';
import { lintSkill } from './lint/index.ts';
import { detectPatchCandidates, pendingPatches } from './patch-debt/index.ts';
import type { LlmProvider } from './semantic/provider.ts';
import { reviewSemantics } from './semantic/reviewer.ts';
import { planRefactors } from './refactor/index.ts';
import { scoreDimensions } from './scoring/index.ts';
export async function auditSkill(path: string, options: { config?: Partial<Config>; provider?: LlmProvider; semanticReview?: unknown } = {}): Promise<Report> {
  if (options.provider && options.semanticReview !== undefined) throw new Error('语义服务与导入不能同时使用。');
  const config = configSchema.parse(options.config ?? {});
  const skill = await parseSkill(path, config);
  const { findings, metrics } = lintSkill(skill, config);
  const candidates = detectPatchCandidates(skill);
  let patches = pendingPatches(candidates);
  let assessments: DesignAssessment[] = [];
  let semantic: Report['semantic'] = { status: 'not_requested', reviewedFiles: [] };
  if (options.provider) {
    try {
      const reviewed = await reviewSemantics(skill, candidates, options.provider, config.maxSemanticChars);
      if (reviewed.assessments.length !== 8) throw new Error('语义审查缺少八维设计标准结果。');
      findings.push(...reviewed.findings); patches = reviewed.patches; assessments = reviewed.assessments;
      semantic = { status: 'completed', provider: options.provider.identity, reviewedFiles: reviewed.reviewedFiles };
    } catch (error) {
      // External providers may put arbitrary response bodies in errors. Keep reports free of them.
      semantic = { status: 'failed', provider: options.provider.identity, reviewedFiles: [], error: error instanceof Error && error.message.startsWith('语义') ? error.message : 'LLM 审查失败：连接、输出结构或证据验证未通过。' };
    }
  }
  if (options.semanticReview !== undefined) {
    const reviewed = importSemanticReview(skill, candidates, options.semanticReview);
    findings.push(...reviewed.findings); assessments = reviewed.assessments;
    patches = patches.map(p => reviewed.patches.find(r => r.id === p.id) ?? p);
    semantic = { status: 'completed', provider: reviewed.reviewer, reviewedFiles: reviewed.reviewedFiles };
  }
  return { schemaVersion: '1.2', toolVersion: '0.3.5', scoringPolicy: 'design-review-v1', createdAt: new Date().toISOString(), skill: { name: skill.name, fingerprint: skill.fingerprint, files: skill.files.map(({ path, hash }) => ({ path, hash })) }, config, metrics, findings, patches, refactors: planRefactors(patches), checks: discoverChecks(skill), scores: scoreDimensions(findings, semantic.status === 'completed', assessments), semantic };
}
