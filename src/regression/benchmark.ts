import type { Skill } from '../domain/model.ts';
import { gradeCase, type Grade, type RubricJudge } from './grader.ts';
import { capturedOutputSchema, parseCases, type CapturedOutput, type RegressionCase, type Variant } from './schema.ts';
import { suiteFingerprint, type TaskRunner } from './runner.ts';
export interface BenchmarkRecord { caseId: string; variant: Variant; repeat: number; grade: Grade; execution?: CapturedOutput }
export interface Summary { total: number; passed: number; failed: number; notEvaluated: number; passRate: number; assessedPassRate: number | null; meanDurationMs: number | null; meanTokens: number | null; repeatPassRates: number[]; passRateStddev: number }
export interface Benchmark { schemaVersion: '1.0'; createdAt: string; suiteFingerprint: string; runner: string; judge: string | null; mode: 'live' | 'import'; repeats: number; variants: Variant[]; skillFingerprints: Partial<Record<Variant, string>>; records: BenchmarkRecord[]; summary: Partial<Record<Variant, Summary>>; comparisons: { against: Variant; passRateDelta: number | null; regressions: string[]; improvements: string[]; notComparable: string[] }[] }
const key = (v: Variant, id: string, repeat: number) => `${v}:${id}:${repeat}`;
function aggregate(records: BenchmarkRecord[], repeats: number): Summary {
  const passed = records.filter(r => r.grade.status === 'passed').length, failed = records.filter(r => r.grade.status === 'failed').length;
  const durations = records.flatMap(r => r.execution?.durationMs !== undefined ? [r.execution.durationMs] : []);
  const tokens = records.flatMap(r => r.execution?.usage ? [r.execution.usage.promptTokens + r.execution.usage.completionTokens] : []);
  const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const rates = Array.from({ length: repeats }, (_, i) => { const subset = records.filter(r => r.repeat === i + 1); return subset.filter(r => r.grade.status === 'passed').length / subset.length; });
  const rateMean = mean(rates)!;
  return { total: records.length, passed, failed, notEvaluated: records.length - passed - failed, passRate: passed / records.length, assessedPassRate: passed + failed ? passed / (passed + failed) : null, meanDurationMs: mean(durations), meanTokens: mean(tokens), repeatPassRates: rates, passRateStddev: Math.sqrt(rates.reduce((sum, rate) => sum + (rate - rateMean) ** 2, 0) / rates.length) };
}
export async function evaluateOutputs(casesInput: RegressionCase[], outputs: CapturedOutput[], options: { variants?: Variant[]; repeats?: number; judge?: RubricJudge; runner?: string; mode?: 'live' | 'import'; skillFingerprints?: Benchmark['skillFingerprints'] } = {}): Promise<Benchmark> {
  const cases = parseCases(casesInput), repeats = options.repeats ?? 1, variants = options.variants ?? ['with_skill', 'without_skill'];
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('repeats 必须在 1–20 之间。');
  if (!variants.includes('with_skill') || variants.length < 2 || new Set(variants).size !== variants.length) throw new Error('评测需要 with_skill 及至少一个不重复的对照组。');
  const captured = new Map<string, CapturedOutput>();
  for (const raw of outputs) {
    const result = capturedOutputSchema.parse(raw);
    if (!cases.some(c => c.id === result.caseId) || !variants.includes(result.variant) || result.repeat > repeats) throw new Error('导入输出包含未知案例、对照组或超出范围的轮次。');
    const id = key(result.variant, result.caseId, result.repeat);
    if (captured.has(id)) throw new Error(`重复执行输出：${id}`);
    captured.set(id, result);
  }
  const records: BenchmarkRecord[] = [];
  for (const variant of variants) for (let repeat = 1; repeat <= repeats; repeat++) for (const c of cases) {
    const execution = captured.get(key(variant, c.id, repeat));
    records.push({ caseId: c.id, variant, repeat, grade: await gradeCase(c, execution, options.judge), ...(execution ? { execution } : {}) });
  }
  const summary = Object.fromEntries(variants.map(variant => [variant, aggregate(records.filter(r => r.variant === variant), repeats)]));
  const comparisons = variants.filter(v => v !== 'with_skill').map(against => {
    const regressions: string[] = [], improvements: string[] = [], notComparable: string[] = [];
    for (const record of records.filter(r => r.variant === 'with_skill')) {
      const baseline = records.find(r => r.variant === against && r.caseId === record.caseId && r.repeat === record.repeat)!;
      const label = `${record.caseId}#${record.repeat}`;
      if ([baseline.grade.status, record.grade.status].includes('not_evaluated')) notComparable.push(label);
      else if (baseline.grade.status === 'passed' && record.grade.status === 'failed') regressions.push(label);
      else if (baseline.grade.status === 'failed' && record.grade.status === 'passed') improvements.push(label);
    }
    return { against, passRateDelta: notComparable.length ? null : summary.with_skill!.passRate - summary[against]!.passRate, regressions, improvements, notComparable };
  });
  return { schemaVersion: '1.0', createdAt: new Date().toISOString(), suiteFingerprint: suiteFingerprint(cases), runner: options.runner ?? 'imported-outputs', judge: options.judge?.identity ?? null, mode: options.mode ?? 'import', repeats, variants, skillFingerprints: options.skillFingerprints ?? {}, records, summary, comparisons };
}
export async function runBenchmark(cases: RegressionCase[], runner: TaskRunner, skill: Skill, options: { baseline?: Skill; repeats?: number; judge?: RubricJudge; onProgress?: (completed: number, total: number) => void } = {}): Promise<Benchmark> {
  parseCases(cases);
  const repeats = options.repeats ?? 1;
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('repeats 必须在 1–20 之间。');
  const variants: Variant[] = options.baseline ? ['with_skill', 'without_skill', 'baseline'] : ['with_skill', 'without_skill'];
  const total = cases.filter(c => c.status === 'ready').length * repeats * variants.length;
  if (!total) throw new Error('没有 ready 案例，未发起 LLM 请求。');
  if (total > 1000) throw new Error('单次 benchmark 超过 1000 次运行，请拆分测试集。');
  const outputs: CapturedOutput[] = [];
  // Custom runners receive only execution resources, never bundled test answers.
  // Adapters using filesystem tools must copy this allowlist into an isolated workspace.
  const executionView = (source: Skill): Skill => ({ ...source, files: source.files.filter(file => ['entry', 'references', 'scripts', 'templates', 'assets', 'agents'].includes(file.kind)), issues: [] });
  const candidateView = executionView(skill), baselineView = options.baseline ? executionView(options.baseline) : undefined;
  // Alternate order each repeat to reduce systematic timing/order bias.
  for (let repeat = 1; repeat <= repeats; repeat++) for (const c of cases.filter(c => c.status === 'ready')) for (const variant of repeat % 2 ? variants : [...variants].reverse()) {
    try {
      const view = variant === 'with_skill' ? candidateView : variant === 'baseline' ? baselineView : undefined;
      const result = await runner.run({ input: c.input, context: c.context }, view ? structuredClone(view) : undefined);
      outputs.push(capturedOutputSchema.parse({ ...result, caseId: c.id, variant, repeat }));
    } catch { outputs.push({ caseId: c.id, variant, repeat, error: '运行器失败；网络、上下文或输出协议错误。' }); }
    options.onProgress?.(outputs.length, total);
  }
  return evaluateOutputs(cases, outputs, { variants, repeats, judge: options.judge, runner: runner.identity, mode: 'live', skillFingerprints: { with_skill: skill.fingerprint, ...(options.baseline ? { baseline: options.baseline.fingerprint } : {}) } });
}
