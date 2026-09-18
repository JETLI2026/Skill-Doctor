export const dimensions = ['structure_clarity', 'responsibility_boundary', 'rule_consistency', 'executability', 'token_efficiency', 'modularity', 'exception_handling', 'testability'] as const;
export type Dimension = typeof dimensions[number];
export type Severity = 'info' | 'warning' | 'error';
export type Destination = 'Agent' | 'Rule' | 'SKILL.md' | 'references' | 'scripts' | 'templates' | 'tests';
export interface Evidence { file: string; startLine: number; endLine: number; quote: string }
export interface Block { id: string; text: string; evidence: Evidence; kind: 'paragraph' | 'heading'; depth?: number; inQuote: boolean }
export interface Link { target: string; evidence: Evidence; kind: 'markdown' | 'code-path'; resolved?: string; anchor?: string; problem?: string; external?: boolean }
export interface Section { title: string; depth: number; startLine: number; endLine: number; tokens: number }
export type ResourceKind = 'entry' | 'references' | 'scripts' | 'templates' | 'tests' | 'assets' | 'agents' | 'other';
export interface SkillFile { path: string; kind: ResourceKind; bytes: number; hash: string; content?: string; blocks: Block[]; links: Link[]; sections: Section[]; anchors: string[] }
export interface ParseIssue { code: string; message: string; evidence: Evidence }
export interface Skill { root: string; name: string; fingerprint: string; metadata: Record<string, unknown>; files: SkillFile[]; issues: ParseIssue[] }
export interface Finding { id: string; ruleId: string; severity: Severity; origin: 'static' | 'semantic'; message: string; recommendation: string; evidence: Evidence[]; dimensions: Dimension[] }
export interface Metrics { lines: number; characters: number; estimatedTokens: number; tokenMethod: string; ruleCount: number; prohibitionCount: number; conditionCount: number; referenceCount: number; resourceCount: number }
export interface PatchCandidate { id: string; source: Evidence; signals: string[]; safetySensitive: boolean }
export interface PatchAnalysis extends PatchCandidate { status: 'unreviewed' | 'reviewed'; category?: 'general_principle' | 'business_knowledge' | 'deterministic_logic' | 'historical_incident' | 'duplicate_rule' | 'core_safety_boundary'; rootCause?: string; rootCauseStatus?: 'hypothesis' | 'explicit'; principle?: string; destination?: Destination; action: 'review' | 'retain' | 'move' | 'merge'; generateRegression: boolean; rationale: string }
export interface RefactorItem { id: string; originalRule: string; problem: string; destination: Destination | null; newPrinciple: string | null; generateTest: boolean; action: PatchAnalysis['action']; evidence: Evidence; reviewRequired: true }
export interface Deduction { findingId: string; points: number; evidence: Evidence[] }
export interface DesignAssessment { dimension: Dimension; criteria: { criterion: number; verdict: 'met' | 'partial' | 'unmet' | 'not_applicable'; rationale: string; evidence: Evidence[] }[] }
export interface DimensionScore { dimension: Dimension; score: number | null; status: 'partial' | 'assessed' | 'not_evaluated'; deductions: Deduction[]; penaltyPoints: number; findingCount: number; missingEvidence: string[]; explanation: string; assessment?: DesignAssessment }
export interface SemanticState { status: 'not_requested' | 'completed' | 'failed'; provider?: string; error?: string; reviewedFiles: string[] }
export interface Report { schemaVersion: '1.2'; toolVersion: string; scoringPolicy: 'design-review-v1'; createdAt: string; skill: { name: string; fingerprint: string; files: { path: string; hash: string }[] }; config: Record<string, unknown>; metrics: Metrics; findings: Finding[]; patches: PatchAnalysis[]; refactors: RefactorItem[]; checks: import('../lint/capabilities.ts').CheckCapability[]; scores: DimensionScore[]; semantic: SemanticState }
