# 回归协议与扩展

## 案例 1.0

案例目录递归读取 JSON，文件可为单个对象或数组。Skill 内标准布局为 tests/golden-cases、tests/edge-cases、tests/regression-cases。完整示例见 [零值回归](../examples/record-normalizer/tests/regression-cases/preserve-zero.json)。

| 字段 | 用途 |
| --- | --- |
| schemaVersion | 1.0 |
| id | 小写字母、数字、连字符；集内唯一 |
| title / category | 可读标题 / 三类目录之一 |
| status | draft 或 ready；只有 ready 运行 |
| input / context | 真实任务与场景；无额外场景时 context 为空字符串 |
| expected_behavior | 至少一项可观察预期 |
| forbidden_behavior | 禁止行为数组，可为空 |
| assertions | 至少一项、id 唯一 |
| source_rule | 至少一项文件、行号、逐字来源 |
| sourceFingerprint | 生成时源 Skill 摘要 |

sourceFingerprint 是生成时快照，不随新增测试或行号变化自动修改历史。生成器覆盖三类案例及带事故信号的候选，验证来源与结构后统一保存为 draft。维护者核对场景和断言，再改为 ready；测试应检测错误行为，不应仅判断模型是否复述规则。

## 断言

| type | 字段 | 判定 |
| --- | --- | --- |
| contains / not_contains | value: string | 输出包含 / 不含精确片段 |
| equals | value: string | 文本完全一致，含空白 |
| json_equals | value: JSON | JSON 深比较，忽略对象键顺序 |
| json_path_equals | path: JSON Pointer, value: JSON | 路径存在且值匹配，缺失不同于 null |
| artifact_exists | path: string | 捕获记录包含产物键 |
| rubric | rubric: string | 注入的 RubricJudge 判定 |

JSON 断言要求输出自身为合法 JSON，不剥离 Markdown 围栏。JSON Pointer 支持 ~1、~0 与空路径。expected_behavior / forbidden_behavior 是帮助人审断言覆盖的说明，实际判定来自 assertions。产物断言只核对运行器提供的清单，真实性由适配器保证。

## 捕获输出

导入文件必须为数组，每项含 caseId、variant（with_skill / without_skill / baseline）、repeat（从 1 开始），以及 output 或 error，二选一。可选 artifacts 为逻辑产物路径到内容的映射，durationMs 为耗时，usage 为 promptTokens / completionTokens。缺省用量表示未知。

重复记录、未知案例、超轮次输出报错；缺少记录为 not_evaluated。导入数据由调用方提供，系统验证协议和评分，不能证明它由某个模型执行。教学输出明确标记为人工构造。

## 评测

同一测试集、runner、judge 和重复次数下请求各版本，轮次交替执行顺序。单次最多 20 轮、1000 次 ready 运行。保存案例摘要、runner / judge identity、版本摘要、原始输出、逐项评分证据和汇总。

全集通过率为 passed / 全部计划案例，已评估通过率为 passed / (passed + failed)，没有已评估项时为 null。使用各轮全集通过率的总体标准差，少量重复不提供统计显著性保证。任一对照未评估时，不产生该例改善或回归结论，总体 passRateDelta 为 null；其他已完成案例仍可逐例比较。

运行器错误为失败；缺少输出、草稿、评分器错误为未评估。候选失败返回 1；没有候选失败但存在未评估返回 3。不同测试集、评分器或模型的两次实验不应直接比较总体比例。

## TaskRunner 与 RubricJudge

使用当前宿主 Agent 执行文件工具任务、再导入真实产物的流程，见 [宿主对照评测](host-evaluation.md)。该流程与仅输出文本的 TextTaskRunner 分开记录。

通过公共 API 注入 TaskRunner，提供 identity 与 run({input, context}, skill?)。skill 未定义代表无 Skill 基线；返回 output 或 error，可带产物、耗时和用量。runBenchmark 仅传 input / context，并将 Skill 的 tests / other 资源过滤后逐轮深复制，不暴露断言、期望或测试来源。模型内的根目录字段仍指向原目录；使用文件工具的适配器必须将允许的资源复制到隔离工作区，不能让运行器直接浏览原 tests 目录。

真实 Agent 适配器为每轮分配隔离工作区，按其工具协议加载 Skill，设置超时、收集实际产物；核心不直接执行模型生成的命令。TextTaskRunner 只有文本输出和全量资料，不能模拟渐进式读取或工具副作用。

RubricJudge 接收 rubric、输出与任务上下文，看不到版本标签，返回 passed 与 evidence。默认 LLM judge 是独立请求但可能使用同一模型；可注入不同模型或人工判定以降低自我偏好。
