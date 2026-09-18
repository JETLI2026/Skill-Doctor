import { defaultConfig, type Config } from '../config.ts';
import type { Dimension, Evidence, Finding, Metrics, Severity, Skill } from '../domain/model.ts';
import { estimateTokens, normalize, stableId } from '../domain/util.ts';
import { entryEvidence } from '../parser/index.ts';
import { conditionPattern, prohibitionPattern, rulePattern } from './signals.ts';
import { discoverChecks } from './capabilities.ts';
import { lintTestResources } from './test-resources.ts';

export function lintSkill(skill: Skill, config: Config = defaultConfig): { findings: Finding[]; metrics: Metrics } {
  const findings: Finding[] = [];
  const entry = skill.files.find(file => file.kind === 'entry')!;
  const evidence = entryEvidence(skill);
  const prose = entry.blocks.filter(block => block.kind === 'paragraph' && !block.inQuote);
  const text = prose.map(block => block.text).join('\n');
  const content = entry.content!;
  const metrics: Metrics = {
    lines: content.trimEnd().split('\n').length, characters: Array.from(content).length,
    estimatedTokens: estimateTokens(content), tokenMethod: 'heuristic-v1: CJK × 1.5 + other Unicode code points ÷ 4 (not tokenizer billing)',
    ruleCount: prose.filter(block => rulePattern.test(block.text) || /^\s*(?:[-*+]|\d+[.)])\s/u.test(block.evidence.quote)).length,
    prohibitionCount: [...text.matchAll(prohibitionPattern)].length,
    conditionCount: [...text.matchAll(conditionPattern)].length,
    referenceCount: skill.files.filter(file => file.kind === 'references').length, resourceCount: skill.files.length - 1,
  };
  function add(ruleId: string, severity: Severity, message: string, recommendation: string, dimensions: Dimension[], evidenceList: Evidence[] = [evidence]): void {
    if (config.disabledRules.includes(ruleId)) return;
    const id = stableId(ruleId, ...evidenceList.map(e => `${e.file}:${normalize(e.quote)}`));
    if (!findings.some(f => f.id === id)) findings.push({ id, ruleId, severity, message, recommendation, dimensions, evidence: evidenceList, origin: 'static' });
  }
  for (const issue of skill.issues) add(issue.code, 'error', issue.message, '修复该文件的结构或编码，然后重新审查。', ['structure_clarity'], [issue.evidence]);
  if (typeof skill.metadata.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.metadata.name) || skill.metadata.name.length > 64) add('metadata.name', 'error', 'name 应为 1–64 字符的小写字母、数字与单连字符名称。', '为 Skill 设置清晰、稳定的标识。', ['structure_clarity']);
  if (typeof skill.metadata.description !== 'string' || !skill.metadata.description.trim() || skill.metadata.description.length > 1024) add('metadata.description', 'error', 'description 缺失、为空或超过 1024 字符。', '说明用途与触发条件。', ['structure_clarity']);
  const thresholds: [keyof Metrics, number, string, Dimension[]][] = [
    ['lines', config.maxLines, 'length.lines', ['token_efficiency']],
    ['estimatedTokens', config.maxTokens, 'length.tokens', ['token_efficiency']],
    ['ruleCount', config.maxRules, 'complexity.rules', ['structure_clarity']],
    ['conditionCount', config.maxConditions, 'complexity.conditions', ['modularity']],
    ['prohibitionCount', config.maxProhibitions, 'complexity.prohibitions', ['token_efficiency']],
  ];
  for (const [key, limit, id, dims] of thresholds) if (Number(metrics[key]) > limit) add(id, 'warning', `${key}=${metrics[key]}，超过配置阈值 ${limit}。`, '按工作分支检查内容归属；保留必要安全边界，使用回归评测验证裁剪。', dims);
  if (!entry.sections.length) add('headings.missing', 'warning', 'SKILL.md 没有 Markdown 标题。', '按主要工作阶段组织标题。', ['structure_clarity']);
  let lastDepth = 0;
  for (const block of entry.blocks.filter(b => b.kind === 'heading' && !b.inQuote)) {
    if (block.depth! > lastDepth + 1) add('headings.jump', 'warning', `标题从 ${lastDepth} 级跳到 ${block.depth} 级。`, '保持标题层级连续。', ['structure_clarity'], [block.evidence]);
    lastDepth = block.depth!;
  }
  for (const section of entry.sections) if (section.tokens > config.maxSectionTokens && section.depth > 1) add('sections.length', 'warning', `章节「${section.title}」约 ${section.tokens} tokens，超过 ${config.maxSectionTokens}。`, '将条件分支资料移到 reference，并添加读取条件。', ['modularity', 'token_efficiency'], [{ file: entry.path, startLine: section.startLine, endLine: section.endLine, quote: content.split('\n').slice(section.startLine - 1, section.endLine).join('\n') }]);
  const seen = new Map<string, Evidence>();
  for (const file of skill.files.filter(f => f.kind === 'entry' || f.kind === 'references')) {
    for (const block of file.blocks.filter(b => b.kind === 'paragraph' && !b.inQuote)) {
      const normalized = normalize(block.text);
      if (normalized.length < config.minDuplicateChars) continue;
      const prior = seen.get(normalized);
      if (prior) add('duplication.exact', 'warning', '发现规范化后完全相同的段落。', '保留一个权威位置，其他位置使用带触发条件的引用。', ['token_efficiency', 'rule_consistency'], [prior, block.evidence]);
      else seen.set(normalized, block.evidence);
    }
    for (const link of file.links) if (link.problem) add('references.invalid', 'error', `${link.target}：${link.problem}`, '修正目标路径或标题锚点。', ['executability', 'modularity'], [link.evidence]);
  }
  const reached = new Set(['SKILL.md']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of skill.files.filter(f => reached.has(f.path))) for (const link of file.links) if (link.resolved && !link.problem && !reached.has(link.resolved)) { reached.add(link.resolved); changed = true; }
  }
  for (const file of skill.files.filter(f => f.kind === 'references')) {
    const at: Evidence = { file: file.path, startLine: 1, endLine: 1, quote: file.content?.split('\n')[0] ?? file.path };
    if (!reached.has(file.path)) add('references.orphan', 'warning', `从 SKILL.md 无法沿引用到达 ${file.path}。`, '在需要它的工作分支添加引用与读取条件，或确认它应移出 Skill。', ['modularity'], [at]);
    if (!file.content?.trim()) add('references.empty', 'warning', `${file.path} 无可读取的文本内容。`, '补充实际资料或移除无效引用。', ['executability'], [at]);
  }
  for (const file of skill.files.filter(f => f.kind === 'other' && f.path.includes('/'))) add('structure.unrecognized', 'info', `自定义目录资源：${file.path}。`, '自定义目录允许存在；检查调用方是否明确。', [], [{ file: file.path, startLine: 1, endLine: 1, quote: file.path }]);
  if (!discoverChecks(skill).length) add('tests.missing', 'info', '未识别检查脚本或非空 tests 资源；未执行行为评测。', '按技能风险确认是否需要结构自检、内容扫描或行为回归；不因缺少运行环境扣设计分。', []);
  findings.push(...lintTestResources(skill, config));
  return { findings, metrics };
}
