---
name: skill-doctor
description: 审查 SKILL 的结构、补丁债与八维质量证据，提供问题清单和改版前后对比。用于技能体检、审查 SKILL.md 或比较技能版本。
---

# Skill Doctor · 技能体检

对含 `SKILL.md` 的技能目录做证据化审查：问题清单（文件行号与原文）、八维审查状态、补丁债和版本对比。默认离线，审查保持输入技能不变；用户要求优化时，依据发现提出改法并在已授权范围内修改。

## 工具位置

WorkBuddy 部署：`A:\DEEPSEEK工作区\SKILL体检\skill-doctor`（依赖已装；要求 Node >= 22.18）。

```powershell
$cli = 'A:\DEEPSEEK工作区\SKILL体检\skill-doctor\dist\cli.js'
$rep = 'A:\DEEPSEEK工作区\SKILL体检\reports'   # 报告统一写这里
```

## 单技能体检

`--out` 拒绝覆盖已有文件，每次用新的文件名。

```powershell
# Markdown 报告
node $cli audit '<技能目录>' --format md --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).md" --fail-on none

# HTML 报告：可筛选问题、展开源码证据和补丁建议，双击即可看，无需起服务
node $cli audit '<技能目录>' --format html --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).html" --fail-on none

# JSON（供后续 compare 用）
node $cli audit '<技能目录>' --out "$rep\<技能名>-$(Get-Date -f yyyyMMdd-HHmmss-fff).json" --fail-on none
```

体检对象可以是任何技能目录，例如 `C:\Users\JetLi\.agents\skills\<名>`（全局技能）、`A:\DEEPSEEK工作区\招聘智能\skills\<名>`（个人技能正本）、`C:\Users\JetLi\.dsh\skills\<名>`。

## 改版前后对比

```powershell
node $cli compare <旧报告.json> <新报告.json> --format md
node $cli diff <旧技能目录> <新技能目录>          # 只看差异，不自动应用
```

先读取比较条件与不可比原因，再解释新增、消失的问题；行为改善以固定案例的实际回归结果为依据。

## 批量体检技能库

```powershell
Get-ChildItem "$env:USERPROFILE\.agents\skills" -Directory -Force | ForEach-Object {
  if (Test-Path "$($_.FullName)\SKILL.md") {
    node $cli audit $_.FullName --format md --out "$rep\$($_.Name)-$(Get-Date -f yyyyMMdd-HHmmss-fff).md" --fail-on none
  }
}
```

读取各报告，按严重度与问题类型归并，附证据位置、检查范围和报告路径；检查范围不同的技能分别说明。

## 检查范围与解读

- 静态 `audit` 默认离线。需要语义判断时，加 `--semantic` 将技能内容发送到已配置的服务；先检查 `SKILL_DOCTOR_ENDPOINT` 与 `SKILL_DOCTOR_MODEL`，API key 按服务鉴权要求配置。
- 以报告中的语义状态区分未请求、完成、失败；行为评测单独依据 Benchmark 记录。普通 `audit` 不执行行为回归。
- 当前八维质量分为未知，报告提供缺陷、证据与待验证事项。问题负担是启发式权重，0 表示未检出有权重的问题；旧版 100 / 94 也只是缺陷剩余分，均不代表质量达标。
- 汇报先说明本轮检查范围，再给主要发现、证据和下一步建议。Token 是启发式估算；案例生成与真实模型评测的用法按需查看部署工具的 README。

## 验证

命令回显 `已写入 <路径>`，文件存在且能按所选格式读取，表示报告已生成。读取报告中的工具版本、语义状态和问题证据，再形成审查结论。

退出码 0 表示命令完成且满足所选门槛，`--fail-on none` 下仍可能有错误级问题；2 表示输入、运行或语义审查失败，即使保留了静态报告也应说明失败阶段。1、3 等命令相关退出码见 `node $cli --help`。
