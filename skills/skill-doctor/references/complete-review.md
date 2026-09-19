# 完整八维审查流程

仅当用户选择“完整八维审查”，或明确要求完整、八维、语义审查时读取本文件。

## 执行

优先使用已经配置并启用的模型服务：存在 `SKILL_DOCTOR_ENDPOINT` 与 `SKILL_DOCTOR_MODEL`，或用户已在本次或此前明确选择该服务时，运行：

```sh
skill-doctor audit ./target-skill --semantic --format html --out ./full-review.html --fail-on none
```

配置服务视为该服务的数据处理授权，报告记录 provider。用户明确要求离线时不调用它。

没有已配置服务时，由当前宿主读取原文并完成语义审查：

```sh
skill-doctor prepare-review ./target-skill --out ./review-packet.json
# 读取任务包；按其 responseSchema 写出 review.json，记录实际宿主或模型标识
skill-doctor audit ./target-skill --semantic-review ./review.json --format html --out ./full-review.html --fail-on none
```

读取任务包完整文件清单中的原文；大文件分批读取。八维各四项标准必须都有 verdict、理由和逐字证据；具体问题提供改法，冲突附两处原文。只声明实际读过的文件。

## 交付门禁

只有最终报告同时满足 `semantic.status=completed`、八个维度均为 `assessed` 且有数值分数时，才交付完整八维评分。未满足时继续语义审查；确实受上下文、读取或服务错误阻断时，交付“完整八维审查未完成”及原因，并在用户接受时回退为静态暂评；不补造完整分数。

同一结果可再输出 JSON 或 Markdown，以便比较。未分析补丁保留待审；完整设计评分不意味着所有关键词候选都已分类。导入失败时修正证据或重新审查变化后的输入，再生成报告。

新增或切换到没有既有配置或授权记录的远程地址时，在发送前说明目标服务和发送范围；获得授权后不重复提醒。不要把当前宿主审查当作新的外发授权。
