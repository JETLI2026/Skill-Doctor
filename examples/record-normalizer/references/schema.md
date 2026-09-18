# 字段契约

输入是一个非数组 JSON 对象，校验顺序如下。

1. 输入不是对象时返回 {"error":"INVALID_INPUT"}。
2. sku 必须为字符串，trim 后长度在 1–100（含）之间，否则返回 {"error":"INVALID_SKU"}。
3. quantity 仅在字段不存在时默认 1；存在时必须是非负安全整数，否则返回 {"error":"INVALID_QUANTITY"}。
4. 成功结果只有 sku 与 quantity，忽略其他字段。

显式的 quantity=0 保留为 0。null、字符串、负数、小数均不是有效数量。
