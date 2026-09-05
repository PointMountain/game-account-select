import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectFindings, getCandidate, readStore, updateStore, verifyCandidate, transition, receiptIsCurrent, appliedEvidence, digest, knowledgeState } from '../../skills/game-account-skill-optimizer/scripts/lib/learning-store.mjs';
import { renderGameEvaluationReport } from '../../skills/game-account-toolkit/scripts/finalize-game-evaluation.mjs';
import { renderSelectionReport } from '../../skills/game-account-arknights/scripts/render-selection-report.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function environment(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-learning-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'skills/game-account-demo/scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills/game-account-demo/scripts/evaluate.mjs'), 'old');
  return root;
}
function observe(store, root, run = 'one', targetSkill = 'game-account-demo') {
  return collectFindings(store, { root, artifact: { run_id: run }, artifactHash: digest(run), report: {
    target_skill: targetSkill, findings: [{ id: 'missing-evidence', severity: 'high', category: 'evidence', evidence: ['private seller data'],
      suggested_targets: ['skills/game-account-demo/scripts/evaluate.mjs'] }],
  } })[0];
}
function patch(root) {
  fs.writeFileSync(path.join(root, 'skills/game-account-demo/scripts/evaluate.mjs'), 'fixed');
  fs.writeFileSync(path.join(root, 'skills/game-account-demo/scripts/validate-demo.mjs'), 'positive and negative regression');
}
const pass = () => ({ status: 0, stdout: 'passed', stderr: '' });

test('reports do not count a bare applied status as a verified improvement', () => {
  const report = renderGameEvaluationReport({ knowledge_update_candidates: [{ apply_status: 'applied', id: 'invented' }] }, { game: 'Demo', scoreKey: 'score' });
  assert.match(report, /已应用 0 条/);
  const analysis = spawnSync(process.execPath, ['skills/game-account-skill-optimizer/scripts/analyze-run.mjs', '--input', 'skills/game-account-skill-optimizer/test-fixtures/selector-session-preference-leak-run.json', '--json'], { cwd: repo, encoding: 'utf8' });
  assert.equal(analysis.status, 0, analysis.stderr);
  assert.ok(JSON.parse(analysis.stdout).findings.some((finding) => finding.id === 'self-improve-applied-evidence-missing'));
});

test('Arknights renderer recomputes learning counts instead of trusting a cached summary', () => {
  const artifact = { knowledge_update_candidates: [{ apply_status: 'applied', id: 'invented' }],
    self_improve: { knowledge_candidates: { total: 1, applied: 1, pending: 0 } } };
  assert.match(renderSelectionReport(artifact), /本轮已应用 0 条/);
});

test('deduplication uses run identity; repeated failures reopen applied work without retaining private evidence', (t) => {
  const root = environment(t);
  const store = readStore(root);
  const id = observe(store, root);
  observe(store, root);
  assert.equal(observe(store, root, 'one', 'skills/game-account-demo'), id);
  assert.equal(store.candidates.length, 1);
  assert.equal(store.candidates[0].observations.length, 1);
  assert.doesNotMatch(JSON.stringify(store), /private seller data/);
  assert.throws(() => transition(root, store, id, 'applied', 'claim'), /validated/);
  assert.throws(() => verifyCandidate(root, store, id, pass), /changed/);
  patch(root);
  assert.equal(verifyCandidate(root, store, id, pass).passed, true);
  const candidate = transition(root, store, id, 'applied', 'implemented regression fix');
  const reference = { apply_status: 'applied', learning_candidate_id: id, learning_receipt_digest: digest(JSON.stringify(candidate.receipt)) };
  assert.equal(appliedEvidence(root, reference, store).valid, true);
  assert.equal(appliedEvidence(root, { ...reference, preference_scope: 'run_only' }, store).valid, false);
  observe(store, root);
  assert.equal(candidate.status, 'applied');
  observe(store, root, 'two');
  assert.equal(candidate.status, 'proposed');
  assert.equal(candidate.observations.length, 2);
  assert.equal(appliedEvidence(root, reference, store).valid, false);
});

test('failed tests, edits during validation and stale receipts cannot be promoted', (t) => {
  const root = environment(t);
  const store = readStore(root);
  const id = observe(store, root);
  patch(root);
  assert.equal(verifyCandidate(root, store, id, () => ({ status: 1 })).passed, false);
  assert.ok(fs.existsSync(path.join(root, getCandidate(store, id).receipt.log_path)));
  assert.throws(() => transition(root, store, id, 'applied', 'failed'), /validated/);
  assert.equal(verifyCandidate(root, store, id, () => {
    fs.writeFileSync(path.join(root, 'skills/game-account-demo/scripts/evaluate.mjs'), 'drift during test');
    return pass();
  }).passed, false);
  verifyCandidate(root, store, id, pass);
  fs.writeFileSync(path.join(root, 'skills/game-account-demo/scripts/evaluate.mjs'), 'new edit');
  assert.equal(receiptIsCurrent(root, store, getCandidate(store, id)), false);
  assert.throws(() => transition(root, store, id, 'applied', 'stale'), /current/);
});

test('deferred and rejected work requires an explicit resume; status aliases fail closed', (t) => {
  const root = environment(t);
  const store = readStore(root);
  const id = observe(store, root);
  transition(root, store, id, 'deferred', 'requires current source evidence');
  assert.throws(() => verifyCandidate(root, store, id, pass), /Resume/);
  transition(root, store, id, 'proposed', 'evidence available');
  assert.equal(getCandidate(store, id).status, 'proposed');
  assert.deepEqual(knowledgeState([{ apply_status: 'merged' }, { apply_status: 'verified_existing' }, { apply_status: 'deferred' }], root), { total: 3, applied: 0, verified_existing: 1, pending: 2 });
});

test('atomic store keeps prior state on errors and refuses competing writers', (t) => {
  const root = environment(t);
  updateStore(root, (store) => observe(store, root));
  const before = fs.readFileSync(path.join(root, '.harness/learning.json'), 'utf8');
  assert.throws(() => updateStore(root, () => { throw new Error('bad'); }), /bad/);
  assert.equal(fs.readFileSync(path.join(root, '.harness/learning.json'), 'utf8'), before);
  fs.mkdirSync(path.join(root, '.harness/learning.lock'));
  assert.throws(() => updateStore(root, () => {}), /locked/);
});

test('artifact paths cannot escape the repo or follow symlinks', (t) => {
  const root = environment(t);
  fs.symlinkSync(os.tmpdir(), path.join(root, 'skills/outside'));
  for (const target of ['../escape', '/tmp/escape', 'skills/../escape', 'skills/outside/file']) {
    assert.throws(() => collectFindings(readStore(root), { root, artifact: {}, artifactHash: 'a', report: { target_skill: 'demo', findings: [{ id: 'bad', severity: 'high', suggested_targets: [target] }] } }), /target/i);
  }
});
