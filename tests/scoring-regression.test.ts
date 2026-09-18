import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dimensions, type DesignAssessment } from '../src/domain/model.ts';
import { auditSkill } from '../src/audit.ts';
import { parseSkill } from '../src/parser/index.ts';
import { semanticContext } from '../src/semantic/context.ts';
import { scoreDimensions } from '../src/scoring/index.ts';
import { renderMarkdown } from '../src/reporting/markdown.ts';
import { renderHtml } from '../src/reporting/html.ts';
import { compareReports } from '../src/reporting/compare.ts';
import { main } from '../src/cli.ts';
import { fixture, validEntry } from './helpers.ts';
const evidence = { file: 'SKILL.md', startLine: 7, endLine: 7, quote: 'Return the normalized record.' };
const assessments = (): DesignAssessment[] => dimensions.map(dimension => ({ dimension, criteria: [0,1,2,3].map(criterion => ({ criterion, verdict: 'met', rationale: 'Synthetic protocol fixture, not a real quality judgment.', evidence: [evidence] })) }));
async function reviewFor(root: string) {
  const skill = await parseSkill(root);
  return { schemaVersion: '1.0', sourceFingerprint: skill.fingerprint, reviewer: 'fixture-reviewer', reviewedFiles: semanticContext(skill).files, assessments: assessments(), findings: [], patches: [] };
}
test('static scores are explicitly provisional; absent tests do not deduct design points', async t => {
  const report = await auditSkill(await fixture(t, { 'SKILL.md': validEntry }));
  assert.equal(report.scores.filter(s => s.score === 100 && s.status === 'partial').length, 6);
  assert.equal(report.scores.filter(s => s.score === null).length, 2);
  assert.equal(report.findings.find(f => f.ruleId === 'tests.missing')?.severity, 'info');
  assert.ok(renderMarkdown(report).includes('静态暂评'));
  assert.ok(renderHtml(report).includes('静态暂评'));
});
test('empty provider output cannot certify eight dimensions', async t => {
  const report = await auditSkill(await fixture(t, { 'SKILL.md': validEntry }), { provider: { identity: 'empty', complete: async () => ({ text: '{"findings":[],"patches":[]}', durationMs: 1 }) } });
  assert.equal(report.semantic.status, 'failed');
  assert.ok(report.scores.every(s => s.status !== 'assessed'));
});
test('eight design scores include positive and negative evidence, with no double charge', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const review = await reviewFor(root);
  review.assessments[1]!.criteria[0]!.verdict = 'partial';
  const report = await auditSkill(root, { semanticReview: review });
  assert.ok(report.scores.every(s => s.score !== null && s.status === 'assessed'));
  assert.equal(report.scores[1]!.score, 88);
  assert.ok(renderMarkdown(report).includes(evidence.quote));
  assert.ok(renderHtml(report).includes('88 / 100'));
  const findings = [{ id: 'x', ruleId: 'semantic.responsibility', origin: 'semantic' as const, severity: 'warning' as const, dimensions: ['responsibility_boundary' as const], message: 'x', recommendation: 'fix', evidence: [evidence] }];
  assert.equal(scoreDimensions(findings, true, review.assessments)[1]!.score, 88);
  const before = await auditSkill(root, { semanticReview: { ...review, assessments: assessments() } });
  assert.equal(compareReports(before, report).scores[1]!.delta, -12);
  assert.equal(compareReports(await auditSkill(root), report).comparable, false);
});
test('semantic imports reject stale source, missing coverage, fake evidence and repeated criteria', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const review = await reviewFor(root);
  await assert.rejects(auditSkill(root, { semanticReview: { ...review, sourceFingerprint: 'stale' } }), /指纹/);
  await assert.rejects(auditSkill(root, { semanticReview: { ...review, reviewedFiles: ['wrong.md'] } }), /清单/);
  const fake = structuredClone(review); fake.assessments[0]!.criteria[0]!.evidence[0]!.quote = 'invented';
  await assert.rejects(auditSkill(root, { semanticReview: fake }), /证据/);
  const duplicate = structuredClone(review); duplicate.assessments[0]!.criteria[1]!.criterion = 0;
  await assert.rejects(auditSkill(root, { semanticReview: duplicate }), /唯一/);
  await assert.rejects(auditSkill(root, { semanticReview: review, provider: { identity: 'unused', complete: async () => { throw Error('never'); } } }), /同时/);
});
test('CLI imports complete host review and rejects invalid imports without writing a successful report', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry });
  const host = await fixture(t, {}); const file = join(host, 'review.json');
  const packetFile = join(host, 'packet.json');
  assert.equal(await main(['prepare-review', root, '--out', packetFile], { stdout: () => {}, stderr: () => {} }), 0);
  const packet = JSON.parse(await (await import('node:fs/promises')).readFile(packetFile, 'utf8'));
  assert.equal(packet.rubric.exception_handling.length, 4);
  assert.ok(packet.files[0].lines.some((l: {text: string}) => l.text === evidence.quote));
  await writeFile(file, JSON.stringify(await reviewFor(root)));
  let stdout = '';
  const io = { stdout: (text: string) => { stdout += text; }, stderr: (_text: string) => {} };
  assert.equal(await main(['audit', root, '--semantic-review', file], io), 0);
  assert.equal(JSON.parse(stdout).scores.filter((s: {score: number}) => s.score === 100).length, 8);
  await writeFile(file, '{}'); stdout = '';
  assert.equal(await main(['audit', root, '--semantic-review', file], io), 2);
  assert.equal(stdout, '');
});
test('runtime caches do not affect findings or fingerprints; checks outside tests are recognized without execution', async t => {
  const root = await fixture(t, { 'SKILL.md': validEntry, 'verify_skill.py': 'raise RuntimeError("must not execute")', 'scripts/desensitize_scan.py': 'print("scan")' });
  const before = await auditSkill(root);
  await writeFile(join(root, 'cache.pyc'), 'binary cache');
  const after = await auditSkill(root);
  assert.equal(after.skill.fingerprint, before.skill.fingerprint);
  assert.deepEqual(after.findings, before.findings);
  assert.deepEqual(after.checks.map(c => c.kind).sort(), ['content_scan_candidate', 'self_check_candidate']);
  assert.ok(!after.findings.some(f => f.ruleId === 'tests.missing'));
  assert.ok(after.checks.every(c => c.execution === 'not_run'));
  const nested = await fixture(t, { 'SKILL.md': validEntry, 'references/__pycache__/memo.pyc': 'cache' });
  assert.ok(!(await auditSkill(nested)).findings.some(f => f.ruleId.startsWith('references.')));
});
test('historical evidence-first reports remain readable, but policy changes cannot produce deltas', async t => {
  const current = await auditSkill(await fixture(t, { 'SKILL.md': validEntry }));
  const old = { ...current, schemaVersion: '1.1', toolVersion: '0.2.0', scoringPolicy: 'evidence-first-v1', scores: current.scores.map(s => ({ ...s, score: null })) };
  assert.equal(compareReports(old, current).comparable, false);
  assert.ok(compareReports(old, current).scores.every(s => s.delta === null));
  assert.throws(() => compareReports({ ...old, scores: old.scores.map(s => ({ ...s, score: 100 })) }, current), /协议不符/);
});
