# 静态规则与评分

| ruleId | 级别 | 含义 / 默认阈值 | 维度 |
| --- | --- | --- | --- |
| structure.frontmatter | error | YAML 缺失、未闭合、重复键或非法映射 | 结构 |
| structure.encoding | error | 文本不是 UTF-8 | 结构 |
| structure.symlink | error | 跳过符号链接 | 结构 |
| structure.depth | error | 超过 32 层目录，跳过更深内容 | 结构 |
| structure.unrecognized | info | 允许存在的自定义目录资源 | 无 |
| metadata.name | error | 1–64 个小写字母 / 数字 / 单连字符 | 结构 |
| metadata.description | error | 缺失、空白或超过 1024 字符 | 结构 |
| length.lines | warning | 入口超过 500 行 | Token 效率 |
| length.tokens | warning | 入口估算超过 5000 tokens | Token 效率 |
| complexity.rules | warning | 活动规则候选超过 50 段 | 结构 |
| complexity.conditions | warning | 条件信号超过 20 次 | 模块化 |
| complexity.prohibitions | warning | 否定信号超过 20 次 | Token 效率 |
| headings.missing | warning | 无标题 | 结构 |
| headings.jump | warning | 标题跳级或不从一级开始 | 结构 |
| sections.length | warning | 二级及更深章节超过 1200 tokens，含子节 | 模块化、Token 效率 |
| duplication.exact | warning | 规范化后完全重复，至少 24 字符 | 一致性、Token 效率 |
| references.invalid | error | 文件、协议、根目录边界、编码或锚点错误 | 可执行性、模块化 |
| references.orphan | warning | reference 无法从入口沿链接到达 | 模块化 |
| references.empty | warning | reference 为空或无文本内容 | 可执行性 |
| tests.missing | info | 未识别非空检查资源，不据此扣设计分 | 无 |
| tests.invalid-case | error | 三类标准案例协议错、重复 ID 或目录类别不符 | 可测试性 |
| tests.draft-only | warning | 标准案例全部为 draft | 可测试性 |

支持普通 Markdown 链接、定义式链接、行内代码中的明确资源路径。外链不验证网络可达性。当前不解析任意自然语言文件名、动态路径、HTML href、运行时 imports；未定义的 reference label 被 CommonMark 当作普通文本，本版不猜测它是否为错误引用。

重复比较使用 Unicode NFKC、转小写、压缩空白，不删除标点和否定词。代码和 blockquote 不参与活动规则 / 重复裁剪；模板、案例也不参与正文重复规则。引用内容中的文件链接仍可校验。

规则数以指令信号或列表段落估算，每段最多一条；分支数是条件词次数，不能解析嵌套布尔逻辑。禁令多仅触发人工审查建议，不自动删除。

语义规则以 semantic. 开头：duplicate、near_duplicate、conflict、ambiguous、unverifiable、responsibility、disclose_reference、extract_script、external_knowledge、exception_handling、no_op。重复、近义和冲突须两处独立证据，no_op 强制 info。

## 八维百分制设计审查

报告协议 1.2，评分口径 design-review-v1。每维四项等权标准（见 src/scoring/rubric.ts），met=1、partial=0.5、unmet=0；not_applicable 需提供适用范围证据，排除分母，不能整个维度都不适用。四项全部适用时，每项 25 分，部分达标得 12.5 分，最终四舍五入为整数。

完整设计分 = min（标准达成率 × 100，100 − penaltyPoints）。采用较低值避免同一问题在语义标准与缺陷列表中重复相加扣分；不同问题也可能被这一保守合并方式低估，权重需后续样本校准。warning=6、error=12、info=0，同 ruleId 每维最多 24，总扣分最多 100。逐项标准记录达标和不足的理由、原文与位置；deductions 记录问题上限的来源。分数用于设计比较，不是执行成功率或统计精度。

只完成静态检查时，六维展示“100−静态扣分”的静态暂评分；职责边界、异常处理标为待语义审查。完整语义审查提交八维各四项后，两维同样有分。空 findings 不会被当作完成八维审查。未运行真实模型测试不扣设计分；行为结果独立报告。

完整体检要求语义状态 completed，且八维全部 assessed 并有数值分。普通 audit 没有显式模式时保存静态暂评并退出 3；只有 --static 表示调用方接受静态范围。该完成门禁防止将六维暂评和两个未评估维度误报为完整结论。

缓存目录 __pycache__ 及 .pyc/.pyo 文件不进入内容模型、指纹或扣分；显式指向被忽略缓存的引用仍会报告无效。

检查能力识别输出 checks：非空 tests 资源、具有 verify/check/test/lint 名称信号的非空脚本、scan/desensiti 名称信号的内容扫描脚本。均为候选、execution=not_run，不执行被审脚本，也不保证完整识别自定义名称。tests.missing 改为 info；仅凭没有 tests 目录不扣分。已有标准案例格式错误和全草稿仍属于可测试性设计问题。

compare 可读取 1.0/1.1/1.2。评分政策、工具版本、配置或语义状态/审查者不一致时不输出设计分差值；仅相同覆盖状态的维度可比。分数提升不证明行为提升。
