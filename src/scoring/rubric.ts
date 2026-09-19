import type { Dimension } from '../domain/model.ts';

/** Four equally weighted design criteria per dimension; not execution success rates. */
export const designRubric: Record<Dimension, readonly string[]> = {
  structure_clarity: ['用途与触发条件明确', '步骤顺序和完成条件清楚', '标题层级与信息位置便于查找', '术语和输入输出定义一致'],
  responsibility_boundary: ['当前任务范围与排除项明确', '跨任务角色和规则与任务步骤区分', '业务资料按适用范围组织', '确定性处理与模型判断分工合理'],
  rule_consistency: ['同条件下的指令不存在冲突', '例外和优先级明确', '重复与近义规则有统一权威位置', '跨文件规则与入口保持一致'],
  executability: ['必要输入及缺项处理明确', '步骤和工具调用条件可操作', '依赖和引用可用或有替代路径', '产物要求和完成标准可判断'],
  token_efficiency: ['入口聚焦所有任务共用内容', '条件资料按需加载', '重复解释与事故叙述负担合理', '指令具体且避免无效强调'],
  modularity: ['资源按职责划分', '资料入口与读取条件明确', '单一规则有权威维护位置', '修改一个分支不需同步多处规则'],
  exception_handling: ['适用的缺参及无效输入处理明确', '适用的工具或检索失败有降级路径', '不确定或冲突信息有处理方式', '恢复和停止条件保留安全边界'],
  testability: ['预期输出和禁止行为可观察', '完成条件可形成断言', '检查资源或验证步骤与风险匹配', '历史错误与边界场景可复现'],
};
