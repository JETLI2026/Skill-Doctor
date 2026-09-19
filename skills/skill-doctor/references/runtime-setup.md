# 运行时准备

发布包只提供 Agent 工作流；审查命令由 Skill Doctor CLI 执行。先检查 `skill-doctor --help` 是否可用。

命令不可用时，获取官方工程并构建：

```sh
git clone https://github.com/JETLI2026/Skill-Doctor.git
cd Skill-Doctor
pnpm install --frozen-lockfile
pnpm build
node dist/cli.js audit ./target-skill --static --format html --out ./skill-review.html --fail-on none
```

要求 Node.js 22.18+ 和 pnpm 11.19.0。已有工程检出时，直接在含 `package.json` 与 `dist/cli.js` 的目录执行相同的 `node dist/cli.js` 命令。不要把报告写回被审查的 Skill 目录。
