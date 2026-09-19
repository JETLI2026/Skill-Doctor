import type { Finding, Skill } from '../domain/model.ts';
import { stableId } from '../domain/util.ts';
import { caseSchema } from '../regression/schema.ts';
import type { Config } from '../config.ts';
/** Validate only Skill Doctor case folders; other test frameworks remain valid resources. */
export function lintTestResources(skill: Skill, config: Config): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  let ready = 0, drafts = 0;
  const files = skill.files.filter(f => /^tests\/(?:golden-cases|edge-cases|regression-cases)\/.*\.json$/.test(f.path));
  for (const file of files) {
    const evidence = [{ file: file.path, startLine: 1, endLine: Math.min(file.content?.split('\n').length ?? 1, 12), quote: file.content?.split('\n').slice(0, 12).join('\n') ?? file.path }];
    let error = '';
    try {
      const data: unknown = JSON.parse(file.content ?? '');
      const values = Array.isArray(data) ? data : [data];
      if (!values.length) throw new Error('案例文件为空数组。');
      for (const value of values) {
        const c = caseSchema.parse(value);
        if (file.path.split('/')[1] !== c.category) throw new Error('category 与目录不一致。');
        if (seen.has(c.id)) throw new Error(`case id 重复：${c.id}`);
        seen.add(c.id);
        if (c.status === 'ready') ready++; else drafts++;
      }
    } catch (err) { error = err instanceof Error ? err.message : '无效案例'; }
    if (error && !config.disabledRules.includes('tests.invalid-case')) findings.push({ id: stableId('tests.invalid-case', file.path), ruleId: 'tests.invalid-case', severity: 'error', origin: 'static', message: `回归案例不符合协议：${error}`, recommendation: '使用案例 Schema 校验输入、断言、分类、来源与唯一 ID。', evidence, dimensions: ['testability'] });
  }
  if (drafts > 0 && ready === 0 && !config.disabledRules.includes('tests.draft-only')) {
    const file = files[0]!;
    findings.push({ id: stableId('tests.draft-only', file.path), ruleId: 'tests.draft-only', severity: 'warning', origin: 'static', message: `${drafts} 个案例均未审核，没有 ready 案例。`, recommendation: '核对真实场景、期望与断言后，将有效案例的 status 改为 ready。', evidence: [{ file: file.path, startLine: 1, endLine: 1, quote: file.content?.split('\n')[0] ?? file.path }], dimensions: ['testability'] });
  }
  return findings;
}
