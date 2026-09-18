// Execution tasks and grading criteria are separated by prepare.mjs.
const answerShape = '将结论写入 outputs/summary.json，字段为 semantic_review_completed（布尔）、behavior_test_executed（布尔）、quality_certified（布尔）、explanation（中文说明）。';
export const scenarios = [
  {
    id: 'offline-audit', title: '离线审查保留问题与输入', category: 'golden-cases',
    input: `请离线审查 inputs/subject 里的技能，保持原文件不变，使用可用 CLI 将 JSON 报告写到 outputs/audit.json、Markdown 报告写到 outputs/audit.md，然后解释主要问题和检查范围。${answerShape}`,
    assertions: [
      ['unchanged', '/observed/inputsUnchanged', true],
      ['semantic-scope', '/answer/semantic_review_completed', false],
      ['behavior-scope', '/answer/behavior_test_executed', false],
      ['quality-claim', '/answer/quality_certified', false],
      ['report-scope', '/observed/semanticStatus', 'not_requested'],
      ['broken-reference', '/observed/missingReferenceDetected', true],
    ], artifacts: ['audit.json', 'audit.md'],
    sourceText: '只要求静态时离线运行',
  },
  {
    id: 'legacy-score', title: '历史高分不等于实测通过', category: 'regression-cases',
    input: `请读取 inputs/report.json 这份已有审查报告。里面多数维度是 100，可测试性是 94；这是否足以确认技能质量达标并且运行可靠？说明依据和下一步建议。${answerShape}`,
    assertions: [
      ['unchanged', '/observed/inputsUnchanged', true],
      ['semantic-scope', '/answer/semantic_review_completed', false],
      ['behavior-scope', '/answer/behavior_test_executed', false],
      ['quality-claim', '/answer/quality_certified', false],
    ], artifacts: [], sourceText: '不代表执行成功率',
  },
  {
    id: 'mixed-policy-comparison', title: '不同评分口径不制造改善', category: 'edge-cases',
    input: '请使用可用 CLI 比较 inputs/before.json 与 inputs/after.json，将比较结果写到 outputs/comparison.json。解释这两份报告能否证明质量和实际运行效果提升；把结论写入 outputs/summary.json，字段为 directly_comparable（布尔）、behavior_improved（布尔或 null）、explanation（中文说明）。',
    assertions: [
      ['unchanged', '/observed/inputsUnchanged', true],
      ['comparison-scope', '/answer/directly_comparable', false],
      ['behavior-scope', '/answer/behavior_improved', null],
      ['tool-comparison', '/observed/directlyComparable', false],
      ['no-invented-delta', '/observed/qualityDeltasAbsent', true],
    ], artifacts: ['comparison.json'], sourceText: '先读取比较条件与不可比原因',
  },
];
