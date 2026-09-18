# 架构与维护决策

2026-09-16 初始仓库只有 `.git`。选择 TypeScript / Node 统一核心库、CLI、执行器与报告模型。Markdown AST、YAML、Schema 使用成熟依赖，HTML 仅作为报告视图。当前不需要数据库、账号或上传服务。

## 数据流

```text
Skill → Parser → Skill / Evidence / content hashes
              ├→ Static Linter → Findings / Metrics
              └→ Patch candidates → Semantic Reviewer → Findings / Patch analyses
Findings → Eight-dimension defect burden / missing quality evidence
Patch analyses → Refactor plan
Skill / historical rules → Generator → draft cases → human review → ready cases
Ready cases → same runner: with_skill / without_skill / baseline → Outputs
Outputs + assertions → Grader → Benchmark / regressions / variance
Audit reports → policy / condition check → finding / defect-burden differences
```

解析器不执行被审查脚本，跳过符号链接，引用限制在包内。文件大小、总大小、数量超限时明确失败。报告使用相对路径和一基行号。

## 数据契约

- Evidence：文件、起止行号、逐字 quote。统计发现同时保留测量值。
- Finding：稳定内容 ID、ruleId、来源、级别、维度、建议、证据；纯行号平移不改变 ID。
- PatchCandidate：关键词与保守安全信号，不等于技术债结论。
- PatchAnalysis：来源、根因、hypothesis / explicit、六类分类、原则、归属、动作与测试建议。explicit 仅代表原文明确叙述，不代表系统完成了事故调查。
- RefactorItem：可复核建议，reviewRequired=true；不自动改文件。
- Report：协议 1.2 / design-review-v1；八维设计分、逐项达标与不足证据、缺陷扣分、检查能力候选及语义状态。完整设计分与静态暂评分明确区分。
- RegressionCase / Benchmark：独立行为证据，协议仍为 1.0；它们不直接填补审查维度的质量分。

0.3.0 恢复百分制设计审查：四项标准等权达成率与缺陷扣分上限取较低值。标准、计算公式和边界见 docs/rules.md。语义导入验证源指纹、完整文件清单、八维四项唯一性与逐字引文；核验原文存在不证明推论正确。纯静态审查保留暂评分，真实行为评测独立。

## 推荐归属

| 归属 | 内容 |
| --- | --- |
| Agent | 跨任务角色、编排、工具边界 |
| Rule | 跨任务不变量或组织规则 |
| SKILL.md | 当前任务步骤、核心约束与读取入口 |
| references | 特定分支需要的资料、定义和细节 |
| scripts | 可确定执行、需要稳定复现的计算与检查 |
| templates | 输出产物结构 |
| tests | 正常、边界、历史事故和断言 |

仅服务当前任务分支的业务知识可进入 references；跨任务知识建议移到外部知识库或 Agent 的按需知识入口。本版不写入外部知识库。

## 扩展边界

LlmProvider 不绑定厂商 SDK。支持宿主 prepare-review / semantic-review 导入与 Chat Completions JSON object 输出，经本地结构与证据校验。文件作为审查数据与审查指令隔离，模型没有本机工具；这不等于完全解决模型提示注入。证据匹配只证明原文存在，不证明解释正确。

完整体检的完成门禁是语义状态 completed 与八维 assessed 数值分。CLI 普通 audit 不指定模式时只保存静态暂评并退出 3；显式 --static 表示调用方确实只要静态扫描。已经配置/启用或由用户明确选择的模型服务视为已有数据处理授权，不逐次确认；新增或切换到未知远程地址时由宿主在发送前说明。显式离线要求优先。

TaskRunner 与 RubricJudge 独立。内置文本运行器加载全量支持文本；真实 Agent 适配器负责工作区隔离、工具权限、时限和产物真实性。核心不执行任意外部命令。增加 GUI 或服务时复用 `src/index.ts`，保持 UI 与文件、模型适配层解耦。

后续按真实样本校准信号与权重，增加 tokenizer 插件、语义分批一致性、WorkBuddy 运行器、产物隔离、盲评与基线仓库。按可重现失败推进，不提前加入空实现。

## 方法论来源

- Matt Pocock 的 Writing for Agents：研究本机已安装版本的 context load、渐进披露、co-location、重复与 no-op；No-op 保留为实验假设。
- [Anthropic skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)：参考同题基线、断言、重复运行和差异分析；本项目使用独立协议，不声称完全兼容其 evals JSON。
- [Agent Skills specification](https://agentskills.io/specification)：参考 frontmatter 和资源分层；WorkBuddy 自定义目录仅提示，不按未经确认的平台约束报错。
- [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)、[YAML](https://eemeli.org/yaml/)、[Zod](https://zod.dev/api)：官方 AST、YAML、校验接口。
- [Chat Completions 协议](https://developers.openai.com/api/reference/resources/chat)：HTTP 消息、文本与可选用量字段。
