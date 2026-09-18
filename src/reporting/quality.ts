import type { DimensionScore } from '../domain/model.ts';
export function qualityLabel(score: Pick<DimensionScore, 'score' | 'status'>): string {
  return score.score !== null ? `${score.score} / 100${score.status === 'partial' ? '（静态暂评）' : ''}` : '待语义审查';
}
export function coverageLabel(status: DimensionScore['status']): string {
  return { partial: '仅部分检查', assessed: '已评估', not_evaluated: '未审查' }[status];
}
