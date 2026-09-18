# Skill Doctor · 回归评测

模式：import · Runner：Codex collaboration agents:gpt-6-astra · Grader：确定性断言 · 轮次：1

测试集摘要：6bfcff107b4d0c60adb1d8defcbb470768b5ee653485e4c5086a29876486b142

通过率分母包含全部计划案例；未评估单独列出。此处不证明 Agent 的外部工具执行能力。

| 版本 | 通过 | 失败 | 未评估 | 全集通过率 | 轮次标准差 | 平均耗时 ms | 平均 tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| with_skill | 2 | 0 | 1 | 66.7% | 0.0% | 未提供 | 未提供 |
| without_skill | 3 | 0 | 0 | 100.0% | 0.0% | 未提供 | 未提供 |

## 对照 without_skill

通过率差值：不可比（存在未评估记录）

回归：无
改善：无
无法比较：mixed-policy-comparison#1

## 逐例证据

### offline-audit · with_skill · #1 · passed


- unchanged: passed — 实际 JSON 值：true
- semantic-scope: passed — 实际 JSON 值：false
- behavior-scope: passed — 实际 JSON 值：false
- quality-claim: passed — 实际 JSON 值：false
- report-scope: passed — 实际 JSON 值："not_requested"
- broken-reference: passed — 实际 JSON 值：true
- artifact-0: passed — 找到产物 audit.json
- artifact-1: passed — 找到产物 audit.md

### legacy-score · with_skill · #1 · passed


- unchanged: passed — 实际 JSON 值：true
- semantic-scope: passed — 实际 JSON 值：false
- behavior-scope: passed — 实际 JSON 值：false
- quality-claim: passed — 实际 JSON 值：false

### mixed-policy-comparison · with_skill · #1 · not_evaluated

缺少该案例的执行输出。

### offline-audit · without_skill · #1 · passed


- unchanged: passed — 实际 JSON 值：true
- semantic-scope: passed — 实际 JSON 值：false
- behavior-scope: passed — 实际 JSON 值：false
- quality-claim: passed — 实际 JSON 值：false
- report-scope: passed — 实际 JSON 值："not_requested"
- broken-reference: passed — 实际 JSON 值：true
- artifact-0: passed — 找到产物 audit.json
- artifact-1: passed — 找到产物 audit.md

### legacy-score · without_skill · #1 · passed


- unchanged: passed — 实际 JSON 值：true
- semantic-scope: passed — 实际 JSON 值：false
- behavior-scope: passed — 实际 JSON 值：false
- quality-claim: passed — 实际 JSON 值：false

### mixed-policy-comparison · without_skill · #1 · passed


- unchanged: passed — 实际 JSON 值：true
- comparison-scope: passed — 实际 JSON 值：false
- behavior-scope: passed — 实际 JSON 值：null
- tool-comparison: passed — 实际 JSON 值：false
- no-invented-delta: passed — 实际 JSON 值：true
- artifact-0: passed — 找到产物 comparison.json
