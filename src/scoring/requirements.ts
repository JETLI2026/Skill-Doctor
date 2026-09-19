import type { Dimension } from '../domain/model.ts';

// A completed defect scan does not provide these affirmative quality measurements.
export const missingQualityEvidence: Record<Dimension, string[]> = {
  structure_clarity: ['按真实任务验证步骤顺序、入口触发条件和完成标准是否清晰。'],
  responsibility_boundary: ['验证 Agent / Rule / Skill / Knowledge / Script 的归属适合实际调用环境。'],
  rule_consistency: ['验证不同规则、适用条件和例外在真实任务中没有行为冲突。'],
  executability: ['在目标 Agent 中实际执行任务并核验工具调用、产物和失败路径。'],
  token_efficiency: ['在同题基线下证明上下文裁剪没有降低效果，并记录实际加载 Token。'],
  modularity: ['验证按需资料确实可被发现、正确触发和加载，模块能够独立维护。'],
  exception_handling: ['执行故障、边界与历史事故案例，验证恢复行为及安全约束。'],
  testability: ['核验断言覆盖真实需求、可捕获已知缺陷，并在固定测试集上执行回归。'],
};
