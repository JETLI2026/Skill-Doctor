---
name: record-normalizer
description: 规范化库存 JSON；用户要求清洗 sku 和 quantity 时使用。
---
# 库存记录规范化

读取一个 JSON 对象，返回规范化 JSON 或明确的错误对象。

## 执行

1. 按 [字段契约](references/schema.md) 校验输入。该资料定义字段边界及校验顺序。
2. 使用 `scripts/normalize.mjs` 完成确定性校验与默认值处理；纯文本环境按同一契约处理。
3. 只输出 JSON。成功输出遵循 [记录模板](templates/record.json)，失败返回契约中的错误码。

## 完成条件

quantity 缺失时取 1，明确提供的 0 保持为 0。sku 必须是去除两端空白后长度为 1–100 的字符串。

修改后运行 tests/ 中的正常、边界和历史回归案例，确认字段值和错误码一致。
