import type { Skill } from '../domain/model.ts';
import { hash } from '../domain/util.ts';
import { defaultConfig } from '../config.ts';
import type { LlmProvider } from '../semantic/provider.ts';
import type { CapturedOutput, RegressionCase } from './schema.ts';
export interface TaskRunner { readonly identity: string; run(c: Pick<RegressionCase, 'input' | 'context'>, skill?: Skill): Promise<Omit<CapturedOutput, 'caseId' | 'variant' | 'repeat'>> }
export class TextTaskRunner implements TaskRunner {
  readonly identity: string;
  private readonly provider: LlmProvider;
  private readonly maxChars: number;
  constructor(provider: LlmProvider, maxChars = defaultConfig.maxSemanticChars) { this.provider = provider; this.maxChars = maxChars; this.identity = `text-full-context-v1:${provider.identity}`; }
  async run(c: Pick<RegressionCase, 'input' | 'context'>, skill?: Skill) {
    const resources = skill?.files.filter(f => f.content !== undefined && ['entry', 'references', 'scripts', 'templates'].includes(f.kind)).map(f => ({ path: f.path, content: f.content })) ?? [];
    const instructions = JSON.stringify(resources);
    if (instructions.length > this.maxChars) throw new Error('评测上下文超出限制。');
    const completion = await this.provider.complete({ system: `执行用户任务。当前运行器只能输出文本，不能执行脚本、读写文件或调用外部工具。${skill ? `按以下 Skill 与随附资源执行：\n${instructions}` : ''}`, user: JSON.stringify({ input: c.input, context: c.context }) });
    return { output: completion.text, durationMs: completion.durationMs, usage: completion.usage };
  }
}
export function suiteFingerprint(cases: RegressionCase[]): string { return hash(JSON.stringify([...cases].sort((a, b) => a.id.localeCompare(b.id, 'en')))); }
