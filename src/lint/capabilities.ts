import type { Evidence, Skill } from '../domain/model.ts';

export interface CheckCapability {
  kind: 'self_check_candidate' | 'content_scan_candidate' | 'test_resource';
  file: string;
  evidence: Evidence;
  execution: 'not_run';
}
/** Discovery only: names plus nonempty executable content are signals, never proof of passing tests. */
export function discoverChecks(skill: Skill): CheckCapability[] {
  return skill.files.flatMap(file => {
    if (!file.content?.trim()) return [];
    const code = /\.(?:py|[cm]?js|ts|sh|ps1)$/i.test(file.path);
    const name = file.path.split('/').at(-1)!;
    const kind = file.kind === 'tests' ? 'test_resource' : code && /(?:scan|desensiti|脱敏)/i.test(name) ? 'content_scan_candidate' : code && /(?:^|[_\-.])(?:verify|check|test|lint)(?:[_\-.]|$)/i.test(name) ? 'self_check_candidate' : undefined;
    if (!kind) return [];
    const lines = file.content.split('\n');
    const line = lines.findIndex(value => value.trim().length > 0);
    return [{ kind, file: file.path, execution: 'not_run' as const, evidence: { file: file.path, startLine: line + 1, endLine: line + 1, quote: lines[line]! } }];
  });
}
