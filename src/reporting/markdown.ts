import { designRubric } from '../scoring/rubric.ts';
import type { Report } from '../domain/model.ts';
import type { Benchmark } from '../regression/benchmark.ts';
import { dimensionLabels, severityLabels, categoryLabels, actionLabels } from './labels.ts';
import { qualityLabel, coverageLabel } from './quality.ts';
const cell = (value: unknown): string => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const quote = (text: string): string => text.split('\n').map(line => `> ${line}`).join('\n');
export function renderMarkdown(report: Report): string {
  const lines = [`# Skill Doctor · ${report.skill.name}`, '', `版本 ${report.toolVersion} · ${report.createdAt}`, '', `语义审查：${report.semantic.status}${report.semantic.error ? `（${report.semantic.error}）` : ''}`, '', '## 确定性统计', '', '| 指标 | 数值 |', '| --- | --- |', ...Object.entries(report.metrics).map(([k, v]) => `| ${k} | ${cell(v)} |`), '', '## 八维设计审查分', '', '百分制衡量技能设计，不是执行成功率。完整分按四项标准达成率计算，并受已确认缺陷扣分上限约束，取较低值避免重复扣分。静态暂评只覆盖已启用的代码检查。', '', '| 维度 | 质量分 | 审查范围 | 已发现问题 | 问题负担 | 原文证据 |', '| --- | --- | --- | --- | --- | --- |', ...report.scores.map(s => `| ${dimensionLabels[s.dimension]} | ${qualityLabel(s)} | ${coverageLabel(s.status)} | ${s.findingCount} | ${s.penaltyPoints} | ${s.deductions.map(d => `${d.findingId}（权重 ${d.points}）`).join('; ') || '未检出问题，不构成达标证明'} |`), '', '### 检查范围与行为验证', '', ...report.scores.map(s => `- **${dimensionLabels[s.dimension]}**：${s.missingEvidence.map(cell).join('；')}`), ''];
  lines.push('## 已识别检查能力', '', '以下仅表示资源存在，不代表执行过或通过。', '', ...report.checks.map(c => `- ${c.kind}: ${c.file}（未运行）`), '', '## 逐项设计依据', '');
  for (const score of report.scores) if (score.assessment) {
    lines.push(`### ${dimensionLabels[score.dimension]}`, '');
    for (const c of score.assessment.criteria) {
      lines.push(`- ${designRubric[score.dimension][c.criterion]}：${c.verdict} — ${c.rationale}`, '');
      for (const e of c.evidence) lines.push(`${e.file}:${e.startLine}–${e.endLine}`, '', quote(e.quote), '');
    }
  }
  lines.push('## 发现与证据', '');
  if (!report.findings.length) lines.push('已启用检查未发现问题。未运行的语义和行为检查仍未评估。', '');
  for (const finding of report.findings) {
    lines.push(`### ${severityLabels[finding.severity]} · ${finding.ruleId}`, '', `${finding.message} (${finding.id})`, '', `建议：${finding.recommendation}`, '');
    for (const e of finding.evidence) lines.push(`证据：${e.file}:${e.startLine}–${e.endLine}`, '', quote(e.quote), '');
  }
  lines.push('## 补丁技术债与重构建议', '');
  if (!report.patches.length) lines.push('未发现关键词候选；这不代表不存在语义补丁。', '');
  for (const patch of report.patches) lines.push(`### ${patch.source.file}:${patch.source.startLine} · ${patch.category ? categoryLabels[patch.category] : '尚未分类'}`, '', quote(patch.source.quote), '', `- 状态：${patch.status} / ${actionLabels[patch.action]}`, `- 根因${patch.rootCauseStatus === 'hypothesis' ? '假设' : ''}：${patch.rootCause ?? '待语义审查'}`, `- 推荐归属：${patch.destination ?? '待审查'}`, `- 新原则：${patch.principle ?? '待语义审查'}`, `- 生成回归案例：${patch.generateRegression ? '建议生成' : '未提出'}`, `- 理由：${patch.rationale}`, '');
  lines.push('所有重构建议均待审核；报告不会改写原 Skill。', '');
  return lines.join('\n');
}
export function renderBenchmarkMarkdown(benchmark: Benchmark): string {
  const deltaText = (delta: number | null): string => delta === null ? '不可比（存在未评估记录）' : `${(delta * 100).toFixed(1)} 个百分点`;
  return [`# Skill Doctor · 回归评测`, '', `模式：${benchmark.mode} · Runner：${benchmark.runner} · Grader：${benchmark.judge ?? '确定性断言'} · 轮次：${benchmark.repeats}`, '', `测试集摘要：${benchmark.suiteFingerprint}`, '', '通过率分母包含全部计划案例；未评估单独列出。此处不证明 Agent 的外部工具执行能力。', '', '| 版本 | 通过 | 失败 | 未评估 | 全集通过率 | 轮次标准差 | 平均耗时 ms | 平均 tokens |', '| --- | --- | --- | --- | --- | --- | --- | --- |', ...benchmark.variants.map(v => { const s = benchmark.summary[v]!; return `| ${v} | ${s.passed} | ${s.failed} | ${s.notEvaluated} | ${(s.passRate * 100).toFixed(1)}% | ${(s.passRateStddev * 100).toFixed(1)}% | ${s.meanDurationMs ?? '未提供'} | ${s.meanTokens ?? '未提供'} |`; }), '', ...benchmark.comparisons.flatMap(c => [`## 对照 ${c.against}`, '', `通过率差值：${deltaText(c.passRateDelta)}`, '', `回归：${c.regressions.join(', ') || '无'}`, `改善：${c.improvements.join(', ') || '无'}`, `无法比较：${c.notComparable.join(', ') || '无'}`, '']), '## 逐例证据', '', ...benchmark.records.flatMap(r => [`### ${r.caseId} · ${r.variant} · #${r.repeat} · ${r.grade.status}`, '', r.grade.reason ?? '', ...r.grade.assertions.map(a => `- ${a.id}: ${a.status} — ${a.evidence}`), ''])].join('\n');
}
