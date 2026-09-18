import type { Skill } from '../domain/model.ts';
/** A deterministic review diff, intentionally not an automatic patch applier. */
export function diffSkills(before: Skill, after: Skill): string {
  const oldFiles = new Map(before.files.map(file => [file.path, file]));
  const newFiles = new Map(after.files.map(file => [file.path, file]));
  const result: string[] = [];
  for (const path of [...new Set([...oldFiles.keys(), ...newFiles.keys()])].sort()) {
    const a = oldFiles.get(path), b = newFiles.get(path);
    if (a?.hash === b?.hash) continue;
    result.push(`--- ${a ? `a/${path}` : '/dev/null'}`, `+++ ${b ? `b/${path}` : '/dev/null'}`);
    if ((a && a.content === undefined) || (b && b.content === undefined)) { result.push('Binary or unreadable resource changed.'); continue; }
    const left = a?.content?.split('\n') ?? [], right = b?.content?.split('\n') ?? [];
    let prefix = 0, suffix = 0;
    while (prefix < Math.min(left.length, right.length) && left[prefix] === right[prefix]) prefix++;
    while (suffix < Math.min(left.length, right.length) - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
    const start = Math.max(0, prefix - 3), aEnd = Math.min(left.length, left.length - suffix + 3), bEnd = Math.min(right.length, right.length - suffix + 3);
    result.push(`@@ -${left.length ? start + 1 : 0},${aEnd - start} +${right.length ? start + 1 : 0},${bEnd - start} @@`);
    for (let i = start; i < prefix; i++) result.push(` ${left[i]}`);
    for (let i = prefix; i < left.length - suffix; i++) result.push(`-${left[i]}`);
    for (let i = prefix; i < right.length - suffix; i++) result.push(`+${right[i]}`);
    for (let i = left.length - suffix; i < aEnd; i++) result.push(` ${left[i]}`);
  }
  return result.length ? `${result.join('\n')}\n` : 'No content changes.\n';
}
