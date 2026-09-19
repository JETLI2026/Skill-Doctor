import type { Dimension } from '../domain/model.ts';
export const dimensionLabels: Record<Dimension, string> = {
  structure_clarity: '结构清晰度', responsibility_boundary: '职责边界', rule_consistency: '规则一致性', executability: '可执行性',
  token_efficiency: 'Token 效率', modularity: '模块化', exception_handling: '异常处理', testability: '可测试性',
};
export const severityLabels = { error: '错误', warning: '待改进', info: '提示' };
export const categoryLabels: Record<string, string> = { general_principle: '通用原则', business_knowledge: '业务知识', deterministic_logic: '确定性逻辑', historical_incident: '历史事故', duplicate_rule: '重复规则', core_safety_boundary: '核心安全边界' };
export const actionLabels = { review: '待审查', retain: '保留', move: '迁移建议', merge: '合并建议' };
