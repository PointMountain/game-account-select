#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const fixturePath = path.join(repoRoot, 'skills', 'game-account-skill-optimizer', 'test-fixtures', 'arknights-post-run-presentation-regression.json');
const budgetDeliveryFixturePath = path.join(repoRoot, 'skills', 'game-account-skill-optimizer', 'test-fixtures', 'arknights-budget-delivery-self-improve-run.json');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arknights-selection-output-'));

try {
  const artifactPath = path.join(tempDir, 'run.json');
  const reportPath = path.join(tempDir, 'run.md');
  fs.copyFileSync(fixturePath, artifactPath);
  const run = spawnSync(process.execPath, [
    path.join(__dirname, 'finalize-selection-run.mjs'),
    '--input', artifactPath,
    '--report-out', reportPath,
    '--per-platform', '5',
  ], { cwd: repoRoot, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
  assert.equal(run.status, 0, run.stderr || run.stdout || 'finalizer failed');

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const report = fs.readFileSync(reportPath, 'utf8');
  assert.equal(artifact.presentation.format, 'markdown_tables');
  assert.equal(artifact.presentation.per_platform_rendered.pxb7, 3);
  assert.equal(artifact.presentation.per_platform_rendered.pzds, 5);
  assert.deepEqual(artifact.presentation.candidate_shortage_platforms, ['pxb7']);
  assert.equal(artifact.self_improve.status, 'complete');
  assert.deepEqual(artifact.self_improve.knowledge_candidates, { total: 1, applied: 0, verified_existing: 0, pending: 1 });
  assert.equal(artifact.quality_gate.redo_required, false);
  assert.match(report, /\| 层级 \| 价格\/区服 \|/);
  assert.match(report, /### 螃蟹候选（3 个）/);
  assert.match(report, /### 盼之候选（5 个）/);
  for (const id of ['2271503685960649831', '2305980675523097405', '2284147056312697168', 'MRHXJ5', 'MR33DC', 'MR1D8G', 'MRBJ2K', 'MR8PV5']) {
    assert.match(report, new RegExp(id));
  }
  assert.match(report, /本轮已应用 0 条；已有机制复核 0 条；待验证\/延期 1 条/);
  assert.doesNotMatch(report, /平台口径 0/);

  const budgetArtifactPath = path.join(tempDir, 'budget-delivery.json');
  const budgetReportPath = path.join(tempDir, 'budget-delivery.md');
  const budgetSourceArtifact = JSON.parse(fs.readFileSync(budgetDeliveryFixturePath, 'utf8'));
  const budgetRawRequest = budgetSourceArtifact.user_request;
  const budgetProfileInput = budgetSourceArtifact.selection_profile.source_text;
  budgetSourceArtifact.request_provenance = {
    raw_user_request: budgetRawRequest,
    profile_input: budgetProfileInput,
    profile_input_origin: 'derived_runtime_profile',
    derived_input_changed: true,
    raw_user_request_sha256: crypto.createHash('sha256').update(budgetRawRequest).digest('hex'),
    profile_input_sha256: crypto.createHash('sha256').update(budgetProfileInput).digest('hex'),
    rule: 'Derived runtime constraints may refine the frozen profile, but must never overwrite the user\'s raw request.',
  };
  fs.writeFileSync(budgetArtifactPath, `${JSON.stringify(budgetSourceArtifact, null, 2)}\n`);
  const budgetRun = spawnSync(process.execPath, [
    path.join(__dirname, 'finalize-selection-run.mjs'),
    '--input', budgetArtifactPath,
    '--report-out', budgetReportPath,
    '--per-platform', '5',
  ], { cwd: repoRoot, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
  assert.equal(budgetRun.status, 0, budgetRun.stderr || budgetRun.stdout || 'budget-layer finalizer failed');
  const budgetArtifact = JSON.parse(fs.readFileSync(budgetArtifactPath, 'utf8'));
  const budgetReport = fs.readFileSync(budgetReportPath, 'utf8');
  assert.match(budgetReport, /预算内完整满足全部硬条件：0 个/);
  assert.match(budgetReport, /### 预算内最接近（2 个）/);
  assert.match(budgetReport, /### 预算范围外完整满足（5 个）/);
  assert.match(budgetReport, /2300429263421710046/);
  assert.match(budgetReport, /2293093385667313261/);
  assert.match(budgetReport, /## 本轮复盘与 Self-improve/);
  assert.equal(budgetArtifact.request_provenance.raw_user_request, budgetArtifact.user_request);
  assert.equal(budgetArtifact.request_provenance.profile_input_origin, 'derived_runtime_profile');
  assert.equal(budgetArtifact.delivery_contract.mode, 'verbatim_required');
  assert.equal(
    budgetArtifact.delivery_contract.final_response_sha256,
    crypto.createHash('sha256').update(budgetArtifact.final_response).digest('hex'),
  );
  assert.ok(budgetArtifact.delivery_contract.rendered_listing_ids.includes('2300429263421710046'));
  assert.equal(budgetArtifact.quality_gate.redo_required, false);

  const verifiedExistingPath = path.join(tempDir, 'verified-existing.json');
  const verifiedExistingReportPath = path.join(tempDir, 'verified-existing.md');
  const verifiedExisting = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  verifiedExisting.knowledge_update_candidates = [{
    ...verifiedExisting.knowledge_update_candidates[0],
    apply_status: 'verified_existing',
  }];
  fs.writeFileSync(verifiedExistingPath, `${JSON.stringify(verifiedExisting, null, 2)}\n`);
  const verifiedExistingRun = spawnSync(process.execPath, [
    path.join(__dirname, 'finalize-selection-run.mjs'),
    '--input', verifiedExistingPath,
    '--report-out', verifiedExistingReportPath,
    '--per-platform', '5',
  ], { cwd: repoRoot, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
  assert.equal(verifiedExistingRun.status, 0, verifiedExistingRun.stderr || verifiedExistingRun.stdout || 'verified-existing finalizer failed');
  const verifiedExistingArtifact = JSON.parse(fs.readFileSync(verifiedExistingPath, 'utf8'));
  assert.deepEqual(verifiedExistingArtifact.self_improve.knowledge_candidates, {
    total: 1,
    applied: 0,
    verified_existing: 1,
    pending: 0,
  }, 'observing an already-implemented mechanism must not be reported as a new applied update');
  const verifiedExistingReport = fs.readFileSync(verifiedExistingReportPath, 'utf8');
  assert.match(verifiedExistingReport, /本轮已应用 0 条；已有机制复核 1 条；待验证\/延期 0 条/);

  const reconciliationPath = path.join(tempDir, 'unvalidated-reconciliation.json');
  const reconciliationReportPath = path.join(tempDir, 'unvalidated-reconciliation.md');
  const reconciliation = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  reconciliation.provenance_reconciliation = {
    reason: 'restored candidates after changing the profile',
    source_artifact: '/tmp/previous-profile.json',
    targeted_detail_refreshes: [{ listing_id: '2271503685960649831', status: 'success' }],
    profile_digest: 'new-profile-digest',
  };
  reconciliation.selection_profile.exclusions = ['只有早期收藏且阵容断代的陈年仓库号'];
  fs.writeFileSync(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`);
  const reconciliationRun = spawnSync(process.execPath, [
    path.join(__dirname, 'finalize-selection-run.mjs'),
    '--input', reconciliationPath,
    '--report-out', reconciliationReportPath,
    '--per-platform', '5',
  ], { cwd: repoRoot, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
  assert.notEqual(reconciliationRun.status, 0, 'manual cross-profile candidate reconciliation must not pass self-improve without canonical rescoring evidence');
  const reconciliationOptimizer = JSON.parse(fs.readFileSync(reconciliationPath.replace(/\.json$/, '.optimizer.json'), 'utf8'));
  assert.ok(reconciliationOptimizer.findings.some((item) => item.id === 'selection-reconciliation-unvalidated'));
  assert.ok(reconciliationOptimizer.findings.some((item) => item.id === 'selector-unscoped-freeform-exclusion'));
  console.log(JSON.stringify({
    ok: true,
    rendered: artifact.presentation.per_platform_rendered,
    candidate_shortages: artifact.presentation.candidate_shortage_platforms,
    self_improve: artifact.self_improve.status,
    quality_gate: artifact.quality_gate,
  }, null, 2));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
