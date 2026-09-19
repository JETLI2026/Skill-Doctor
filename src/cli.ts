#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditSkill } from './audit.ts';
import { loadConfig } from './config.ts';
import { parseSkill } from './parser/index.ts';
import { prepareReview } from './semantic/packet.ts';
import { providerFromEnv } from './semantic/provider.ts';
import { generateCases, loadCases, writeCases } from './regression/cases.ts';
import { evaluateOutputs, runBenchmark } from './regression/benchmark.ts';
import { capturedOutputSchema, type Variant } from './regression/schema.ts';
import { LlmRubricJudge } from './regression/grader.ts';
import { TextTaskRunner } from './regression/runner.ts';
import { renderMarkdown, renderBenchmarkMarkdown } from './reporting/markdown.ts';
import { renderHtml } from './reporting/html.ts';
import { compareReports, renderComparisonMarkdown } from './reporting/compare.ts';
import { diffSkills } from './refactor/diff.ts';
import { z } from 'zod';

const help = `Skill Doctor 0.3.3 — SKILL 审查、补丁债与回归评测

  audit <skill> [--static | --semantic | --semantic-review file] [--format json|md|html] [--out file]
               [--config file] [--fail-on error|warning|none]
  prepare-review <skill> --out <packet.json> [--config file]
  generate <skill> --live --out <new-directory> [--config file]
  eval --cases <directory-or-json> --outputs <json> [--repeats 1]
       [--variants with_skill,without_skill,baseline] [--judge --live]
       [--format json|md] [--out file]
  benchmark <skill> --cases <directory-or-json> --live [--baseline <old-skill>]
            [--repeats 3] [--judge] [--config file] [--format json|md] [--out file]
  compare <before-report.json> <after-report.json> [--format json|md] [--out file]
  diff <before-skill> <after-skill> [--out file] [--config file]

audit 未指定模式时仍生成静态报告，但以退出码 3 标记“完整审查未完成”。
--static 明确只做离线静态检查；--semantic、--live 才允许 LLM 调用。
LLM 配置：SKILL_DOCTOR_ENDPOINT（完整 chat/completions URL）、SKILL_DOCTOR_MODEL、
          SKILL_DOCTOR_API_KEY（本地服务可省略）。
退出码：0 完成且满足所选门槛；1 检查门槛 / 测试失败；2 输入 / 运行 / 语义审查错误；3 评测未完整覆盖或比较条件不一致。
audit --fail-on none 仍保留错误级问题；报告生成不等于质量达标。
`;
type IO = { stdout: (text: string) => void; stderr: (text: string) => void };
const io: IO = { stdout: text => process.stdout.write(text), stderr: text => process.stderr.write(text) };
const options = { format: { type: 'string' }, out: { type: 'string' }, config: { type: 'string' }, static: { type: 'boolean' }, semantic: { type: 'boolean' }, 'semantic-review': { type: 'string' }, 'fail-on': { type: 'string' }, cases: { type: 'string' }, outputs: { type: 'string' }, repeats: { type: 'string' }, variants: { type: 'string' }, baseline: { type: 'string' }, live: { type: 'boolean' }, judge: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } as const;
const allowed: Record<string, string[]> = {
  'prepare-review': ['out', 'config'],
  audit: ['format', 'out', 'config', 'static', 'semantic', 'semantic-review', 'fail-on'], generate: ['live', 'out', 'config'],
  eval: ['cases', 'outputs', 'repeats', 'variants', 'judge', 'live', 'format', 'out'],
  benchmark: ['cases', 'baseline', 'repeats', 'judge', 'live', 'format', 'out', 'config'],
  compare: ['format', 'out'], diff: ['out', 'config'],
};
export async function main(argv: string[], streams: IO = io): Promise<number> {
  try {
    const { values, positionals } = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
    if (values.help || argv.length === 0) { streams.stdout(help); return 0; }
    if (positionals.length === 0) throw new Error('缺少命令；使用 --help 查看可用命令。');
    const [command, ...paths] = positionals;
    if (!allowed[command!]) throw new Error(`未知命令：${command}`);
    for (const key of Object.keys(values)) if (!allowed[command!]!.includes(key)) throw new Error(`${command} 不支持 --${key}`);
    const expectedPaths = command === 'eval' ? 0 : ['compare', 'diff'].includes(command!) ? 2 : 1;
    if (paths.length !== expectedPaths) throw new Error(`${command} 需要 ${expectedPaths} 个路径参数。`);
    const format = values.format ?? 'json';
    if (!['json', 'md', ...(command === 'audit' ? ['html'] : [])].includes(format)) throw new Error('该命令不支持指定的 --format。');
    const required = (name: 'cases' | 'outputs' | 'out') => { const value = values[name]; if (!value) throw new Error(`缺少 --${name}`); return value; };
    async function emit(text: string): Promise<void> {
      if (values.out) { const file = resolve(values.out); await mkdir(dirname(file), { recursive: true }); await writeFile(file, text, { flag: 'wx' }); streams.stderr(`已写入 ${file}\n`); }
      else streams.stdout(text.endsWith('\n') ? text : `${text}\n`);
    }
    const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
    const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
    if (command === 'prepare-review') {
      required('out');
      await emit(json(prepareReview(await parseSkill(paths[0]!, await loadConfig(values.config)))));
      return 0;
    }
    if (command === 'audit') {
      const threshold = values['fail-on'] ?? 'error';
      if (!['error', 'warning', 'none'].includes(threshold)) throw new Error('--fail-on 应为 error、warning 或 none。');
      const modes = Number(Boolean(values.static)) + Number(Boolean(values.semantic)) + Number(Boolean(values['semantic-review']));
      if (modes > 1) throw new Error('--static、--semantic 与 --semantic-review 只能选择一种。');
      const report = await auditSkill(paths[0]!, { config: await loadConfig(values.config), provider: values.semantic ? providerFromEnv() : undefined, semanticReview: values['semantic-review'] ? await readJson(values['semantic-review']) : undefined });
      await emit(format === 'html' ? renderHtml(report) : format === 'md' ? renderMarkdown(report) : json(report));
      if (report.semantic.status === 'failed') return 2;
      if (modes === 0) {
        streams.stderr('静态报告已生成，但完整审查尚未完成；继续语义审查，或用 --static 明确只需静态结果。\n');
        return 3;
      }
      return report.findings.some(f => threshold !== 'none' && (f.severity === 'error' || threshold === 'warning' && f.severity === 'warning')) ? 1 : 0;
    }
    if (command === 'generate') {
      if (!values.live) throw new Error('generate 需要 --live：将 Skill 内容发送给已配置的 LLM 生成待审核案例。');
      const output = required('out'), config = await loadConfig(values.config), skill = await parseSkill(paths[0]!, config);
      const cases = await generateCases(skill, providerFromEnv(), config);
      await mkdir(dirname(resolve(output)), { recursive: true });
      await writeCases(cases, resolve(output));
      streams.stdout(`已生成 ${cases.length} 个待审核案例：${resolve(output)}\n`);
      return 0;
    }
    if (command === 'eval' || command === 'benchmark') {
      const cases = await loadCases(required('cases'));
      const repeats = Number(values.repeats ?? (command === 'benchmark' ? '3' : '1'));
      if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('--repeats 应为 1–20 的整数。');
      if ((command === 'benchmark' || values.judge) && !values.live) throw new Error('实时运行或语义评分需要 --live。');
      const provider = command === 'benchmark' || values.judge ? providerFromEnv() : undefined;
      const judge = values.judge ? new LlmRubricJudge(provider!) : undefined;
      let benchmark;
      if (command === 'eval') {
        const outputs = z.array(capturedOutputSchema).parse(await readJson(required('outputs')));
        const variants = z.array(z.enum(['with_skill', 'without_skill', 'baseline'])).parse((values.variants ?? 'with_skill,without_skill').split(',')) as Variant[];
        benchmark = await evaluateOutputs(cases, outputs, { repeats, variants, judge });
      } else {
        const config = await loadConfig(values.config);
        benchmark = await runBenchmark(cases, new TextTaskRunner(provider!, config.maxSemanticChars), await parseSkill(paths[0]!, config), { repeats, judge, baseline: values.baseline ? await parseSkill(values.baseline, config) : undefined, onProgress: (done, total) => streams.stderr(`评测 ${done}/${total}\n`) });
      }
      await emit(format === 'md' ? renderBenchmarkMarkdown(benchmark) : json(benchmark));
      if (benchmark.summary.with_skill!.failed) return 1;
      if (benchmark.records.some(r => r.grade.status === 'not_evaluated')) return 3;
      return 0;
    }
    if (command === 'compare') {
      const comparison = compareReports(await readJson(paths[0]!), await readJson(paths[1]!));
      await emit(format === 'md' ? renderComparisonMarkdown(comparison) : json(comparison));
      return comparison.comparable ? 0 : 3;
    }
    const config = await loadConfig(values.config);
    await emit(diffSkills(await parseSkill(paths[0]!, config), await parseSkill(paths[1]!, config)));
    return 0;
  } catch (error) {
    streams.stderr(`Skill Doctor: ${error instanceof Error ? error.message : '未知错误'}\n`);
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
