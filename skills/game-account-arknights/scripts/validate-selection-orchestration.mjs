#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const runner = path.join(__dirname, 'run-pxb7-selection.mjs');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arknights-orchestration-'));
const fakeOperationRunner = path.join(temporaryRoot, 'fake-operation-runner.mjs');
const fakeCleanupRunner = path.join(temporaryRoot, 'fake-cleanup-runner.mjs');
const cleanupLog = path.join(temporaryRoot, 'cleanup.log');

fs.writeFileSync(fakeOperationRunner, `
import fs from 'node:fs';
const args = process.argv.slice(2);
const value = (name, fallback = null) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] ?? fallback; };
const operation = value('--operation');
const taskSpace = value('--task-space', 'fixture-task');
const input = value('--input');
const platform = String(operation).split('/')[0];
const signals = operation.endsWith('-detail') ? (platform === 'pxb7' ? ['明日方舟', '商品'] : ['明日方舟', '账号']) : ['明日方舟'];
const base = {
  query_governance: 'ego_ops', browser_transport: 'ego_browser', operation,
  ego_ops: { knowledge_status: 'verified_operation_available', operation_reference: '/fixture/' + operation + '.md', knowledge_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', manifest_availability: 'verified', checkpoint_count: 2 },
  task_space_id: 501, task_space_name: taskSpace,
  page: { url: input || (platform === 'pxb7' ? 'https://www.pxb7.com/buy/10053/1' : 'https://www.pzds.com/goodsList/84/6/headerSearch'), title: platform === 'pxb7' ? '螃蟹 明日方舟' : '盼之 明日方舟' },
  evidence: { matched_signals: signals, result_count: 0 }, reasons: [], needs_user_action: false,
};
const fail = (reason, needsUserAction = false) => { console.log(JSON.stringify({ ...base, ok: false, reasons: [reason], needs_user_action: needsUserAction, data: null })); process.exit(1); };
if (process.env.GAME_ACCOUNT_FAKE_OPERATION_LOG) fs.appendFileSync(process.env.GAME_ACCOUNT_FAKE_OPERATION_LOG, operation + '\\n');
if (process.env.GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION === operation) {
  const takeoverState = process.env.GAME_ACCOUNT_FAKE_STATE + '.takeover';
  const count = fs.existsSync(takeoverState) ? Number(fs.readFileSync(takeoverState, 'utf8')) + 1 : 1;
  fs.writeFileSync(takeoverState, String(count));
  if (count === Number(process.env.GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE || '1')) fail('browser_control_handoff', true);
}
if (process.env.GAME_ACCOUNT_FAKE_TAKEOVER === '1') fail('browser_control_handoff', true);
if (operation === 'pzds/arknights-list' && process.env.GAME_ACCOUNT_FAKE_PZDS_FAIL_ONCE === '1') {
  const state = process.env.GAME_ACCOUNT_FAKE_STATE;
  if (!fs.existsSync(state)) { fs.writeFileSync(state, 'failed-once'); fail('fixture_initial_pzds_failure'); }
}
if (operation.endsWith('-detail') && process.env.GAME_ACCOUNT_FAKE_DETAIL_FAIL === '1') fail('fixture_detail_failure');
const limit = Math.max(1, Number(value('--limit', '10')) || 10);
const makeRow = (index) => {
  const listingId = platform === 'pxb7' ? String(9000000000000000000n + BigInt(index)) : 'MRFIX' + String(index).padStart(2, '0');
  const url = platform === 'pxb7' ? 'https://www.pxb7.com/product/' + listingId + '/1' : 'https://www.pzds.com/goodsDetails/' + listingId + '/6';
  const priceBase = Number(process.env.GAME_ACCOUNT_FAKE_PRICE_BASE || '850');
  return {
    listingId, priceCny: priceBase + index * 10, server: '官服', url,
    publishedAt: '2026-08-30 10:00:00',
    status: { sourceStatus: 'success', guarantee: true, officialVerification: true, verifiedAt: '2026-08-30' },
    counts: { level: 120, sixStar: 40, elite2: 30, limitedSixStar: 12, collab: 0, skins: 20 },
    resources: { orundum: 60000, originitePrime: 100 },
    operatorNames: ['维什戴尔', '逻各斯', '缄默德克萨斯'],
    elite2OperatorNames: ['维什戴尔', '逻各斯', '缄默德克萨斯'],
    elite1OperatorNames: [], collabOperatorNames: [], skins: ['典藏时装'],
    riskFacts: ['找回包赔', '官方验号'], verificationImageUrls: ['https://example.invalid/verification-' + listingId + '.png'],
  };
};
let data;
if (operation.endsWith('-list')) data = Array.from({ length: limit }, (_, index) => makeRow(index + 1));
else {
  const listingId = platform === 'pxb7' ? String(input).match(/\\/product\\/([^/?#]+)/)?.[1] : String(input).match(/\\/goodsDetails\\/([^/?#]+)/)?.[1];
  const row = makeRow(1);
  data = [{ ...row, listingId, url: input }];
}
console.log(JSON.stringify({ ...base, ok: true, data, evidence: { ...base.evidence, result_count: data.length } }));
`);

fs.writeFileSync(fakeCleanupRunner, `
import fs from 'node:fs';
const args = process.argv.slice(2);
const index = args.indexOf('--task-space');
const taskSpace = index < 0 ? null : args[index + 1];
if (process.env.GAME_ACCOUNT_FAKE_CLEANUP_LOG) fs.appendFileSync(process.env.GAME_ACCOUNT_FAKE_CLEANUP_LOG, String(taskSpace) + '\\n');
const failed = process.env.GAME_ACCOUNT_FAKE_CLEANUP_FAIL === '1';
console.log(JSON.stringify({ ok: !failed, ego_task_spaces_requested: [taskSpace], ego_task_space_closures: failed ? [] : [{ target: taskSpace, ok: true }], ego_task_spaces_remaining: failed ? [taskSpace] : [], process_audit_after: [] }));
process.exit(failed ? 1 : 0);
`);

function runScenario(name, extraEnv = {}, extraArgs = [], { useDefaultCounts = false } = {}) {
  const artifactPath = path.join(temporaryRoot, `${name}.json`);
  const reportPath = path.join(temporaryRoot, `${name}.md`);
  const statePath = path.join(temporaryRoot, `${name}.state`);
  const operationLog = path.join(temporaryRoot, `${name}.operations.log`);
  const request = extraEnv.GAME_ACCOUNT_FAKE_REQUEST || '明日方舟1000元左右，战力优先，只看预算范围内，绝不超预算';
  const result = spawnSync(process.execPath, [
    runner,
    '--request', request,
    '--out', artifactPath,
    '--report-out', reportPath,
    '--task-space', `fixture-${name}`,
    ...(useDefaultCounts ? [] : ['--limit', '10']),
    '--batches', '1',
    ...(useDefaultCounts ? [] : ['--details-per-platform', '2', '--display-per-platform', '3']),
    '--recommendations', '3',
    '--backups', '1',
    ...extraArgs,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 240000,
    maxBuffer: 1024 * 1024 * 32,
    env: {
      ...process.env,
      GAME_ACCOUNT_FIXTURE_MODE: '1',
      GAME_ACCOUNT_TEST_OPERATION_RUNNER: fakeOperationRunner,
      GAME_ACCOUNT_TEST_CLEANUP_RUNNER: fakeCleanupRunner,
      GAME_ACCOUNT_FAKE_CLEANUP_LOG: cleanupLog,
      GAME_ACCOUNT_FAKE_STATE: statePath,
      GAME_ACCOUNT_FAKE_OPERATION_LOG: operationLog,
      ...extraEnv,
    },
  });
  return { result, artifactPath, reportPath, operationLog };
}

function cleanupEntryCount() {
  return fs.existsSync(cleanupLog) ? fs.readFileSync(cleanupLog, 'utf8').trim().split('\n').filter(Boolean).length : 0;
}

function assertHandoffStopsImmediately(scenario, beforeCleanup, expectedLastOperation) {
  assert.equal(scenario.result.status, 1, scenario.result.stderr || 'browser control handoff must stop orchestration');
  assert.equal(fs.existsSync(scenario.artifactPath), false, 'handoff before finalization must not emit a recommendation artifact');
  const operations = fs.readFileSync(scenario.operationLog, 'utf8').trim().split('\n').filter(Boolean);
  assert.equal(operations.at(-1), expectedLastOperation, 'no browser operation may run after handoff');
  assert.equal(cleanupEntryCount(), beforeCleanup + 1, 'handoff path must invoke dedicated cleanup once');
}

try {
  const defaults = runScenario('default-counts', {}, [], { useDefaultCounts: true });
  assert.equal(defaults.result.status, 0, defaults.result.stderr || defaults.result.stdout);
  const defaultArtifact = JSON.parse(fs.readFileSync(defaults.artifactPath, 'utf8'));
  assert.equal(defaultArtifact.coverage_plan.completeness_gates.detail_required_for_top_n_per_platform, 10);
  assert.equal(defaultArtifact.coverage_plan.completeness_gates.min_display_candidates_per_platform, 10);
  assert.equal(defaultArtifact.presentation.per_platform_requested, 10);
  assert.deepEqual(defaultArtifact.presentation.per_platform_rendered, { pxb7: 10, pzds: 10 });
  for (const attempt of defaultArtifact.platform_attempts) {
    assert.equal(attempt.result_count, 20, `${attempt.platform} must retain spare list candidates`);
    assert.equal(attempt.detail_attempts.length, 10, `${attempt.platform} must check ten details by default`);
    assert.ok(attempt.detail_attempts.every((detail) => detail.status === 'success'));
    assert.equal(new Set(attempt.detail_attempts.map((detail) => detail.listing_id)).size, 10);
    const rows = defaultArtifact.platform_shortlists[attempt.platform].display_candidates;
    assert.equal(new Set(rows.map((row) => row.listing_id)).size, 10);
    for (const row of rows) assert.ok(defaultArtifact.final_response.includes(row.listing_id));
  }
  assert.equal(defaultArtifact.quality_gate.redo_required, false);

  const fallback = runScenario('pzds-fallback', { GAME_ACCOUNT_FAKE_PZDS_FAIL_ONCE: '1' });
  assert.equal(fallback.result.status, 0, fallback.result.stderr || fallback.result.stdout || 'fixture orchestration failed');
  const artifact = JSON.parse(fs.readFileSync(fallback.artifactPath, 'utf8'));
  assert.equal(artifact.schema_version, '3.0');
  assert.equal(artifact.quality_gate.redo_required, false);
  assert.equal(artifact.cleanup_reports[0].ok, true);
  assert.equal(artifact.presentation.per_platform_requested, 3, 'explicit display overrides must remain supported');
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.detail_attempts.length === 2), 'explicit detail overrides must remain supported');
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.operation_verified === true));
  assert.deepEqual(artifact.platform_attempts.map((attempt) => attempt.operation), ['pxb7/arknights-list', 'pzds/arknights-list']);
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.operations.length === 2));
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.operation_references.length >= 2));
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.ego_task_space_id === 501));
  assert.ok(artifact.platform_attempts.find((attempt) => attempt.platform === 'pzds').list_attempts.some((attempt) => attempt.recovered_by_fallback === true));
  assert.ok(artifact.platform_attempts.every((attempt) => attempt.detail_attempts.every((detail) => detail.operation.endsWith('/arknights-detail'))));

  const detailFailure = runScenario('detail-failure', { GAME_ACCOUNT_FAKE_DETAIL_FAIL: '1' });
  assert.equal(detailFailure.result.status, 1, 'detail failures must block the releasable artifact');
  const detailArtifact = JSON.parse(fs.readFileSync(detailFailure.artifactPath, 'utf8'));
  assert.equal(detailArtifact.cleanup_reports[0].ok, true, 'detail failure path must still close the task space');
  assert.ok(detailArtifact.platform_attempts.every((attempt) => attempt.detail_attempts.every((detail) => detail.status === 'error')));
  assert.equal(detailArtifact.quality_gate.redo_required, true);

  const cleanupFailure = runScenario('cleanup-failure', { GAME_ACCOUNT_FAKE_CLEANUP_FAIL: '1' });
  assert.equal(cleanupFailure.result.status, 1, 'cleanup failure must block final delivery');
  const cleanupArtifact = JSON.parse(fs.readFileSync(cleanupFailure.artifactPath, 'utf8'));
  assert.equal(cleanupArtifact.cleanup_reports[0].ok, false);
  assert.ok(cleanupArtifact.optimizer_report.findings.some((finding) => finding.id === 'runtime-browser-session-cleanup-missing'));
  assert.equal(cleanupArtifact.quality_gate.redo_required, true);

  const beforeTakeover = cleanupEntryCount();
  const takeover = runScenario('user-takeover', { GAME_ACCOUNT_FAKE_TAKEOVER: '1' });
  assertHandoffStopsImmediately(takeover, beforeTakeover, 'pxb7/arknights-list');
  const cleanupEntries = fs.readFileSync(cleanupLog, 'utf8').trim().split('\n').filter(Boolean);
  assert.equal(cleanupEntries.at(-1), 'fixture-user-takeover');

  const beforePzdsTakeover = cleanupEntryCount();
  const pzdsTakeover = runScenario('pzds-list-takeover', {
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pzds/arknights-list',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '1',
  });
  assertHandoffStopsImmediately(pzdsTakeover, beforePzdsTakeover, 'pzds/arknights-list');
  assert.deepEqual(
    fs.readFileSync(pzdsTakeover.operationLog, 'utf8').trim().split('\n'),
    ['pxb7/arknights-list', 'pzds/arknights-list'],
    'PZDS handoff must not trigger the fallback operation',
  );

  const beforePinnedTakeover = cleanupEntryCount();
  const pinnedTakeover = runScenario('pinned-detail-takeover', {
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pxb7/arknights-detail',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '1',
  }, ['--listing-url', 'https://www.pxb7.com/product/9000000000000000001/1']);
  assertHandoffStopsImmediately(pinnedTakeover, beforePinnedTakeover, 'pxb7/arknights-detail');

  const beforeDetailTakeover = cleanupEntryCount();
  const detailTakeover = runScenario('shortlist-detail-takeover', {
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pxb7/arknights-detail',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '1',
  });
  assertHandoffStopsImmediately(detailTakeover, beforeDetailTakeover, 'pxb7/arknights-detail');

  const beforeHealthTakeover = cleanupEntryCount();
  const healthTakeover = runScenario('health-check-takeover', {
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pzds/arknights-list',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '2',
  });
  assertHandoffStopsImmediately(healthTakeover, beforeHealthTakeover, 'pzds/arknights-list');

  const expansionEnv = {
    GAME_ACCOUNT_FAKE_REQUEST: '明日方舟1000元左右，战力优先，预算内没有合适账号时允许扩价',
    GAME_ACCOUNT_FAKE_PRICE_BASE: '3000',
  };
  const beforeExpansionListTakeover = cleanupEntryCount();
  const expansionListTakeover = runScenario('expansion-list-takeover', {
    ...expansionEnv,
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pxb7/arknights-list',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '2',
  });
  assertHandoffStopsImmediately(expansionListTakeover, beforeExpansionListTakeover, 'pxb7/arknights-list');

  const beforeExpansionDetailTakeover = cleanupEntryCount();
  const expansionDetailTakeover = runScenario('expansion-detail-takeover', {
    ...expansionEnv,
    GAME_ACCOUNT_FAKE_TAKEOVER_OPERATION: 'pxb7/arknights-detail',
    GAME_ACCOUNT_FAKE_TAKEOVER_OCCURRENCE: '3',
  });
  assertHandoffStopsImmediately(expansionDetailTakeover, beforeExpansionDetailTakeover, 'pxb7/arknights-detail');

  console.log('Arknights selection orchestration fixture validation passed');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
