# Skill Doctor 工程约定

职责与数据流见 `docs/architecture.md`。修改规则时查 `docs/rules.md`，修改评测时查 `docs/evaluation.md`。

## 核心不变量

- 确定性检查留在代码；LLM 结论带逐字证据与验证状态。
- 补丁关键词只是候选信号；安全敏感规则保留保护作用，再形成待审核建议。
- 分数、建议和回归结果是不同证据。缺少评估的数据保持未知，空断言和草稿不能通过。
- 执行模型只接收案例 input / context；预期结果、source_rule 与断言留给 Grader。
- 审查和建议不修改输入 Skill；报告与案例使用显式输出路径。

## 维护流程

新增规则提供规则文档和能重现问题的输入测试，优先验证可观察行为与失败路径。
运行 `node scripts/verify.mjs` 验证类型、测试与构建。CLI 变更还需执行编译后的命令。
默认测试使用可注入 Provider；真实 LLM 验证记录模型标识，报告不保存 API key。
更新 README、CHANGELOG 和 TODO 中受修改影响的内容。

## Git 备份

每次发布或同步新版本后，提交并推送到 `gongfeng` 与 `github` 两个远端，使用 `codex/backup-<版本>` 分支。宣布备份完成前，核对两个远端分支均指向本地 HEAD。不要覆盖远端 `main`。
