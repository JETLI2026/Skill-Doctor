# Skill Doctor｜SKILL 审查、优化与质量检测

将历史错误转成「根因分析 → 通用原则 → 正确层级的修改 → 回归案例」，避免持续向 Prompt 追加禁令。

**0.3.3** 提供模块化 TypeScript 核心库、CLI、JSON / Markdown / HTML 报告。对话入口会在审查范围不明确时让用户选择快速静态审查或完整八维审查；显式 `--static` 只做离线静态扫描。使用锁定依赖、严格类型、回归测试和 Windows / Linux CI 持续维护。

**八维百分制设计审查已恢复。** 每维四项标准，记录达标与不足的原文证据；完整语义审查后八维均有分。静态结果标为暂评；行为评测单独报告，未运行不扣设计分。

## 快速运行

要求 Node.js **22.18+**、pnpm **11.19.0**。

```sh
pnpm install --frozen-lockfile
pnpm verify
node dist/cli.js audit examples/record-normalizer --static
node dist/cli.js audit examples/legacy-skill --static --format html --out .skill-doctor/review.html --fail-on none
```

用浏览器打开 HTML，可查看八维审查状态、筛选问题、展开源码证据、缺失验证和补丁建议。HTML 无外部依赖，不需要启动服务。输出路径须尚不存在。开发时可用 `node src/cli.ts` 代替 `node dist/cli.js`。

依赖已经安装时，即使 shell 没有 pnpm 命令，也可运行 `node scripts/verify.mjs` 完成类型检查、测试和构建。

## 已实现能力

| 模块 | 当前行为 |
| --- | --- |
| Skill Parser | YAML、Markdown AST、标题章节、原文行号、SHA-256；分类 references / scripts / templates / tests / assets / agents |
| Static Linter | 长度、Token 估算、标题跳级、规则与分支信号、超长章节、重复段落、引用 / 锚点、孤立与空 reference、目录和案例协议 |
| Semantic Reviewer | 重复、近义、冲突、歧义、不可验证、职责混杂、资料披露、脚本抽取、外部知识、异常处理及 No-op 假设；验证结构和源码证据 |
| Patch Debt Detector | 候选 → 六类模型分类 → 根因假设 / 原文叙述 → 原则与归属；可能的安全边界先保留 |
| Regression Generator | golden / edge / regression 三类场景草稿，包含输入、上下文、期望、禁止行为、断言和来源；审核后执行 |
| Refactor Engine | 原规则 → 问题 → 推荐归属 → 新原则 → 测试建议；另提供目录内容 Diff，默认不改写输入 |
| Evaluation | 确定性断言、可注入 rubric judge、多轮新版本 / 无 Skill / 旧版本对照、历史输出导入 |

规则与条件数量是公开启发式统计，不声称完成自然语言逻辑解析。代码块和引用示例不计入活动规则。Token 估算公式是 `CJK 字符 × 1.5 + 其他 Unicode 码点 ÷ 4` 向上取整，不是模型计费值。

## 语义审查

用户选择完整八维审查后，优先由当前宿主 Agent 审阅原文，再导入校验；不需要额外模型密钥：

```sh
node dist/cli.js prepare-review ./my-skill --out .skill-doctor/packet.json
# 宿主按任务包的 rubric 和 responseSchema 阅读文件，写出 review.json
node dist/cli.js audit ./my-skill --semantic-review .skill-doctor/review.json --format html --out .skill-doctor/full-review.html
```

任务包包含源指纹、逐行原文、四项标准与完整输出协议。导入审查者声明阅读全部文件，不证明宿主确实阅读；代码校验指纹、清单与引用，不能验证推理真伪。未分类的补丁保留待审。协议细节见 [语义导入](docs/semantic-review.md)。

如果用户选择完整八维审查且已配置并启用 `SKILL_DOCTOR_ENDPOINT` 与 `SKILL_DOCTOR_MODEL`，可直接使用该服务做完整语义审查；配置或用户此前明确选择该服务，视为已有数据处理授权，不重复询问。新增或切换到没有既有配置/授权记录的远程地址时，发送前说明目标与发送范围。用户明确要求离线时使用宿主导入或 `--static`。

静态命令无需密钥。语义分析使用支持 JSON object 输出的 Chat Completions 兼容服务；endpoint 为完整请求 URL。Shell 示例：

```sh
export SKILL_DOCTOR_ENDPOINT='https://provider.example/v1/chat/completions'
export SKILL_DOCTOR_MODEL='your-model-id'
# 有鉴权的服务另设 SKILL_DOCTOR_API_KEY；密钥仅从环境读取
skill-doctor audit ./my-skill --semantic --format md --out .skill-doctor/semantic.md
```

PowerShell 使用 `$env:变量名 = '值'` 设置相同环境变量。若未全局安装 CLI，可将命令替换为 `node dist/cli.js`。

`--semantic` 发送入口、references、scripts、templates、tests 及根目录脚本文本及候选规则给配置的服务，不自动寻找密钥。远程服务使用 HTTPS，本地回环服务可使用 HTTP。模型无本机工具，HTTP 有超时、响应大小限制和有限重试。

模型返回的逐字引用必须位于对应文件行区间。漏审候选、伪造证据、冲突证据不足、非法结构或输出截断均使语义阶段失败；静态结果保留，退出码为 2。超出上下文预算直接报错，不静默截断。HTTP 错误响应不会原样写入报告。

普通 `audit` 未指定 `--static`、`--semantic` 或 `--semantic-review` 时仍保存静态报告，但返回退出码 3，提示完整审查尚未完成。完整报告必须满足 `semantic.status=completed`，且八维均为 `assessed` 并有数值分数。

## 回归案例与评测

生成案例到新目录：

```sh
node dist/cli.js generate ./my-skill --live --out .skill-doctor/cases-v1
```

维护者核对输入、期望与断言后，将案例 `status` 从 `draft` 改为 `ready`，可将其纳入 Skill 的 `tests/` 版本管理。生成内容未执行、未通过评测。

无需 LLM 的历史结果评分：

```sh
node dist/cli.js eval --cases examples/record-normalizer/tests --outputs examples/captured-outputs.json --format md
```

`captured-outputs.json` 是**人工构造的教学数据**，不是模型实测结果。示例的确定性脚本则由项目测试真实执行，验证正常输入、负数拒绝与零值丢失回归。

真实模型对照：

```sh
node dist/cli.js benchmark examples/record-normalizer --cases examples/record-normalizer/tests --baseline examples/legacy-skill --repeats 3 --live --format md --out .skill-doctor/live-benchmark.md
```

比较 with_skill、without_skill 和可选 baseline。每次请求隔离，执行器只接收 input / context 和已排除 tests 的执行资源副本；断言和期望保留给评分器。含 rubric 断言时，加 `--judge` 使用独立请求评分，也可在库中注入人工或其他模型评分器。

内置 **TextTaskRunner 只生成文本，并一次性提供入口和支持文本**，不会执行 Skill 脚本或模拟真实 Agent 的文件工具，也不能评测渐进式读取效果。真实宿主 Agent 可通过 TaskRunner 接口接入，或导入其捕获输出。没有产物时，产物断言不会通过。

另提供 [宿主 Agent 对照评测](docs/host-evaluation.md)：准备相同任务给独立 Agent，分别使用 / 不使用 Skill，实际执行文件与 CLI 操作后采集磁盘产物，再交给现有 Grader。已提供 Skill Doctor 的三个历史场景和可重复准备、采集脚本；宿主模型服务由当前 Agent 环境提供，不需要给 CLI 另配 API key。新宿主须实现等价的任务执行与产物采集过程。

[首轮实测记录](docs/host-evaluation-pilot-20260917.md)：一个宿主 Agent 完成 5 次执行，均通过既定关键断言；1 次因宿主用量限制未完成。两个完整对照场景未观察到 Skill 增益，总体差值不可比。本轮新增产物采集与任务包隔离测试，累计 **44 项测试、类型检查与构建通过**。

报告包含通过 / 失败 / 未评估数、全集及已评估通过率、各轮通过率与总体标准差、时间 / Token、逐例回归与改善。全集通过率分母保留所有计划案例；缺少用量显示未知。任一对照存在未评估记录时，总体通过率差值为不可比。草稿、缺少输出或评分器故障不会自动通过。

## 修改前后比较

```sh
node dist/cli.js audit examples/legacy-skill --static --out .skill-doctor/before.json --fail-on none
node dist/cli.js audit examples/record-normalizer --static --out .skill-doctor/after.json
node dist/cli.js compare .skill-doctor/before.json .skill-doctor/after.json --format md
node dist/cli.js diff examples/legacy-skill examples/record-normalizer
```

列出新增、消失、保留问题与各维问题负担变化。工具版本、检查配置、语义覆盖、模型或评分口径不同则标记不可比。旧报告仍可读取，但其中的 100 / 94 会标为“旧口径，非质量分”，不会用于计算质量改善。问题减少不证明行为改善，应同时查看固定测试集的回归结果。`diff` 用于审阅，不自动应用。

所有 `--out` 默认拒绝覆盖已有文件，下一轮使用新路径以保留基线。

## 八维百分制设计审查

报告协议 1.2，评分口径 design-review-v1。每维四项等权标准（见 src/scoring/rubric.ts），met=1、partial=0.5、unmet=0；not_applicable 需提供适用范围证据，排除分母，不能整个维度都不适用。四项全部适用时，每项 25 分，部分达标得 12.5 分，最终四舍五入为整数。

完整设计分 = min（标准达成率 × 100，100 − penaltyPoints）。采用较低值避免同一问题在语义标准与缺陷列表中重复相加扣分；不同问题也可能被这一保守合并方式低估，权重需后续样本校准。warning=6、error=12、info=0，同 ruleId 每维最多 24，总扣分最多 100。逐项标准记录达标和不足的理由、原文与位置；deductions 记录问题上限的来源。分数用于设计比较，不是执行成功率或统计精度。

只完成静态检查时，六维展示“100−静态扣分”的静态暂评分；职责边界、异常处理标为待语义审查。完整语义审查提交八维各四项后，两维同样有分。空 findings 不会被当作完成八维审查。未运行真实模型测试不扣设计分；行为结果独立报告。

缓存目录 __pycache__ 及 .pyc/.pyo 文件不进入内容模型、指纹或扣分；显式指向被忽略缓存的引用仍会报告无效。

检查能力识别输出 checks：非空 tests 资源、具有 verify/check/test/lint 名称信号的非空脚本、scan/desensiti 名称信号的内容扫描脚本。均为候选、execution=not_run，不执行被审脚本，也不保证完整识别自定义名称。tests.missing 改为 info；仅凭没有 tests 目录不扣分。已有标准案例格式错误和全草稿仍属于可测试性设计问题。

compare 可读取 1.0/1.1/1.2。评分政策、工具版本、配置或语义状态/审查者不一致时不输出设计分差值；仅相同覆盖状态的维度可比。分数提升不证明行为提升。

## 配置与退出码

复制 [配置示例](skill-doctor.config.example.json)，通过 `--config` 显式传入。缺省字段使用默认值，未知字段或非法数值报错。ignore 按路径段名称匹配，不是 glob；disabledRules 使用 [静态规则 ID](docs/rules.md)。

| 退出码 | 含义 |
| --- | --- |
| 0 | 完成且满足所选检查门槛 |
| 1 | audit 命中门槛，或 with_skill 有失败案例 |
| 2 | 输入、运行或请求的语义审查失败 |
| 3 | 评测未完整覆盖，或比较条件不一致 |

audit 默认 `--fail-on error`，严格 CI 可用 warning，探索报告可用 none。none 下的退出码 0 仍可能伴随错误级问题；语义失败保留静态报告并返回 2。文件生成成功不代表质量达标。对照组失败不使候选版本失败；候选失败优先返回 1，未评估记录仍完整保留。

## Agent Skill 入口

[skills/skill-doctor/SKILL.md](skills/skill-doctor/SKILL.md) 是可随项目发布的通用入口：它只假设已安装的 `skill-doctor` CLI 或可定位的项目根目录，不假设某个宿主、操作系统、技能安装位置或报告目录。安装或复制到目标 Agent 宿主时，同步入口与对应工具版本，并由调用方选择可写的输出位置。

入口在范围不明确时先让用户选择快速静态审查或完整八维审查；已明确范围时直接执行。完整模式只在语义状态完成后交付八维评分，静态模式明确展示为暂评分。语义审查和行为评测是不同证据；已经配置且获授权的模型服务可用于语义审查，行为评测仍需单独运行。案例生成、评测协议的细节继续由本 README 和评测文档维护。

## 项目结构

```text
src/
  domain/       类型、证据、摘要
  parser/       YAML、Markdown AST、资源、引用
  lint/         静态规则、信号、案例结构检查
  semantic/     Provider、上下文、协议和证据验证
  patch-debt/   候选识别与未评估状态
  regression/   案例生成、Grader、Runner、Benchmark
  refactor/     迁移建议与内容 Diff
  scoring/      八维问题负担、质量证据缺口
  reporting/    Markdown、HTML、报告比较
  audit.ts      编排
  cli.ts        命令与退出码
  index.ts      公共库 API
tests/          单元、协议、CLI、真实脚本集成测试
examples/       有缺陷 / 改进 Skill、案例、人工输出
evaluations/    宿主执行场景、准备与采集脚本、历史报告快照
docs/           架构、规则、评测协议
scripts/        工程验证
skills/         可发布的通用 Skill 入口
```

```ts
import { auditSkill, renderHtml } from './dist/index.js';
const report = await auditSkill('./my-skill');
const html = renderHtml(report);
```

验证命令为 `pnpm check`、`pnpm test`、`pnpm build`，或 `pnpm verify`。新增规则需附可重现案例和文档。数据协议变更时同步版本与迁移说明。

评分缺陷先以失败测试复现，再验证修复。2026-09-17 **40 项测试、类型检查与构建通过**：入口调优增加“配置模型仍保持离线”和“语义失败已生成报告仍返回 2”的 CLI 覆盖，并验证放宽门槛保留原问题且不改输入。Skill 通过项目解析器格式校验，编译后 JSON / Markdown / HTML 命令均已运行；详细记录见 TODO。基线评测行为未改动。远程 CI 尚未执行。已安装入口不等同于开启语义审查或执行行为回归；以报告 semantic.status 和 Benchmark 记录为准。HTML 转义和 CSP 已测试，浏览器视觉验收仍待完成。

详见 [架构](docs/architecture.md)、[规则](docs/rules.md)、[评测协议](docs/evaluation.md)、[工程计划](TODO.md)、[变更记录](CHANGELOG.md)。

## 0.3.0 验证记录

类型检查、45 项测试与构建通过。编译后 prepare-review、语义导入 audit 的 JSON/Markdown/HTML、compare 均完成验收；验收使用明确标记的协议夹具，不作为真实模型效果证据。劳动仲裁技能静态复查由 7 条警告变为 4 条：移除缓存误扣和缺 tests 扣分，识别两个检查脚本候选；未改动该技能。

## 0.3.3 验证记录

对话入口改为用户选择快速静态审查或完整八维审查；完整模式不在语义导入前交付静态评分。入口自检仅保留 `tests.missing` 提示；**49 项测试、严格类型检查、构建和编译后 HTML 静态审查通过**。

## 0.3.2 验证记录

公开入口、使用文档与评测描述已移除特定宿主和本机路径假设；默认解析忽略 `.pnpm-store`，避免项目扫描误读包管理器缓存。**48 项测试、严格类型检查、构建和编译后静态 CLI 验证通过**；部署入口与源文件哈希一致。

## 0.3.1 验证记录

类型检查、46 项测试与构建通过。编译后 CLI 验证：未指定审查模式时保存静态报告并退出 3；显式 `--static` 退出 0；语义导入完成后八维均 assessed、退出 0。协议夹具只验证流程，不代表真实技能质量。

已部署的入口应与当前工具版本同步；部署前保留原有文件备份，部署后复测报告语义状态和八维完成状态。
