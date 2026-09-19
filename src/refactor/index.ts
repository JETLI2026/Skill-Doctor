import type { PatchAnalysis, RefactorItem } from '../domain/model.ts';
export function planRefactors(patches: PatchAnalysis[]): RefactorItem[] {
  return patches.map(patch => ({ id: patch.id, originalRule: patch.source.quote, problem: patch.rootCause ?? patch.rationale, destination: patch.destination ?? null, newPrinciple: patch.principle ?? null, generateTest: patch.generateRegression, action: patch.action, evidence: patch.source, reviewRequired: true }));
}
