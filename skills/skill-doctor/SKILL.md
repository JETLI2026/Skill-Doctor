---
name: skill-doctor
description: 审查 SKILL 的结构、补丁债与八维质量证据，提供问题清单和改版前后对比。用于技能体检、审查 SKILL.md 或比较技能版本。
---

# Skill Doctor · 技能体检

对含 `SKILL.md` 的技能目录做证据化审查：问题清单（文件行号与原文）、八维设计评分、补丁债和版本对比。完整体检包含静态与宿主语义审查；只要求静态时离线运行。审查保持输入技能不变；用户要求优化时，依据发现提出改法并在已授权范围内修改。

## 工具位置

WorkBuddy 部署：`A:\DEEPSEEK工作区\SKILL体检\skill-doctor`（依赖已装；要求 Node >= 22.18）。

```powershell
$cli = 'A:\DEEPSEEK工作区\SKILL体检\skill-doctor\dist\cli.js'
$rep = 'A:\DEEPSEEK工作区\SKILL体检\reports'   # 报告统一写这里
```

## 完整体检（默认完成条件）

用户说“检测、体检、审查”时直接完成静态与语义两部分，不先询问是否需要语义审查。普通 `audit` 只产生静态暂评，不能作为完整体检结束点。

优先使用已经配置并启用的模型服务：存在 `SKILL_DOCTOR_ENDPOINT` 与 `SKILL_DOCTOR_MODEL`，或用户已在本次/此前明确选择该服务时，直接运行 `audit --semantic`，无需重复提醒。报告记录 provider。配置服务（包括 DeepSeek 等常用模型）视为该服务的数据处理授权；用户明确要求离线时不调用它。

没有已配置服务时，由当前宿主读取原文并完成语义审查，无需额外模型服务：

```powershell
node $cli prepare-review '<技能目录>' --out "$rep\<技能名>-<唯一批次>-packet.json"
# 读取任务包；按其 responseSchema 写出 review.json，记录实际宿主/模型标识
node $cli audit '<技能目录>' --semantic-review "$rep\<技能名>-<唯一批次>-review.json" --format html --out "$rep\<技能名>-<唯一批次>-full.html" --fail-on none
```

完成条件：读取任务包完整文件清单中的原文（大文件分批）；八维各四项标准都有 verdict、理由和逐字证据；具体问题提供改法，冲突附两处原文。只声明实际读过的文件。无法完成时报告覆盖缺口，保留静态暂评，不补造完整分数。

完整报告须同时满足：`semantic.status=completed`，八个维度均为 `assessed` 且有数值分数。未满足时继续语义审查；确实受上下文、读取或服务错误阻断时，明确交付“静态暂评 / 完整体检未完成”及原因，不把静态报告称为体检完成。

同一审查结果可再输出 JSON/Markdown，以便比较。未分析的补丁保留待审；完整设计评分不意味着所有关键词候选已逐个分类。导入失败时修正证据或重新审查变化后的输入，再生成报告。任务包内含完整协议，额外说明见部署目录 docs/semantic-review.md。

新增或切换到一个没有既有配置/授权记录的远程地址时，在发送前说明目标服务和发送范围；获得授权后不重复提醒。不要因模型是外部服务就逐次确认，也不要把当前宿主审查当作一次新的外发授权。

## 仅静态检查（用户明确指定）

`--out` 拒绝覆盖已有文件，每次用新的文件名。

```powershell
# Markdown 报告
node $cli audit '<技能目录>' --static --format md --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).md" --fail-on none

# HTML 报告：可筛选问题、展开源码证据和补丁建议，双击即可看，无需起服务
node $cli audit '<技能目录>' --static --format html --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).html" --fail-on none

# JSON（供后续 compare 用）
node $cli audit '<技能目录>' --static --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).json" --fail-on none
```

体检对象可以是任何技能目录，例如 `C:\Users\JetLi\.agents\skills\<名>`（全局技能）、`A:\DEEPSEEK工作区\招聘智能\skills\<名>`（个人技能正本）、`C:\Users\JetLi\.dsh\skills\<名>`。

## 改版前后对比

```powershell
node $cli compare <旧报告.json> <新报告.json> --format md
node $cli diff <旧技能目录> <新技能目录>          # 只看差异，不自动应用
```

先读取比较条件与不可比原因，再解释新增、消失的问题；行为改善以固定案例的实际回归结果为依据。

## 批量体检技能库

以下命令先批量收集静态结果；完整体检继续对每个技能执行上面的宿主语义审查与导入，不将静态批次当成完整审查。

```powershell
Get-ChildItem "$env:USERPROFILE\.agents\skills" -Directory -Force | ForEach-Object {
  if (Test-Path "$($_.FullName)\SKILL.md") {
    node $cli audit $_.FullName --static --format md --out "$rep\$($_.Name)-$(Get-Date -f yyyyMMdd-HHmmss-fff).md" --fail-on none
  }
}
```

读取各报告，按严重度与问题类型归并，附证据位置、检查范围和报告路径；检查范围不同的技能分别说明。

## 检查范围与解读

- `audit` 不指定模式时生成静态报告但退出 3，表示完整审查未完成；用户明确只需静态结果时加 `--static`。完整体检使用宿主导入或已配置服务的 `--semantic`。
- 以报告中的语义状态区分未请求、完成、失败；行为评测单独依据 Benchmark 记录。普通 `audit` 不执行行为回归。
- 当前为八维百分制设计分。四项标准记录达标与不足证据，和缺陷扣分上限取较低值；不代表执行成功率。纯静态六维暂评、职责边界与异常处理待语义审查；完整审查后八维均有分。未运行行为评测不扣设计分。检查脚本只做候选识别，存在不等于通过。
- 汇报先说明本轮检查范围，再给主要发现、证据和下一步建议。Token 是启发式估算；案例生成与真实模型评测的用法按需查看部署工具的 README。

## 验证

命令回显 `已写入 <路径>`，文件存在且能按所选格式读取，表示报告已生成。读取报告中的工具版本、语义状态和问题证据，再形成审查结论。

退出码 0 表示命令完成且满足所选门槛，`--fail-on none` 下仍可能有错误级问题；2 表示输入、运行或语义审查失败，即使保留了静态报告也应说明失败阶段。1、3 等命令相关退出码见 `node $cli --help`。
