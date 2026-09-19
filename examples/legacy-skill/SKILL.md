---
name: record-normalizer
description: 规范化库存记录；在输入 JSON 库存数据时使用。
---
# 库存记录规范化

## 工作步骤

读取 JSON 对象，返回只含 sku 和 quantity 的 JSON 对象，不添加解释。

sku 必须是非空字符串，输出时去除两端空白。

如果 quantity 没有值，使用默认数量 1。为了兼容旧数据，0 也视为没有值。

如果 quantity 是负数或不是整数，返回 {"error":"INVALID_QUANTITY"}。

如果 sku 缺失或去掉空白后为空，返回 {"error":"INVALID_SKU"}。

## 历史补丁

曾经发生 quantity 为 0 时错误回填为 1 的事故，务必保留用户明确提供的零值。

不要跳过字段验证，必须在返回结果前逐个检查 sku 与 quantity 的有效性。

再次强调：不要跳过字段验证，必须在返回结果前逐个检查 sku 与 quantity 的有效性。

不要跳过字段验证，必须在返回结果前逐个检查 sku 与 quantity 的有效性。

特别注意，如果 sku 的长度大于 100，返回 {"error":"INVALID_SKU"}。

读取 [旧字段资料](references/old-schema.md) 处理未知字段。
