import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assessClaim, resolveContextKnowledge, playContexts, validateEvidence } from '../../skills/game-account-toolkit/scripts/community-evidence.mjs';
import { fieldEvidenceStatus, assessRecommendation, detailFieldEvidence } from '../../skills/game-account-arknights/scripts/recommendation-evidence.mjs';
import { createSelectionCheckpoint } from '../../skills/game-account-toolkit/scripts/selection-checkpoint.mjs';
import { captureBaseline, checkProtectedRegressions, rollbackTargets } from '../../skills/game-account-skill-optimizer/scripts/lib/learning-baseline.mjs';
import { snapshot } from '../../skills/game-account-skill-optimizer/scripts/lib/learning-store.mjs';
import { parseArknightsOperation } from '../../skills/game-account-toolkit/ego-operations/arknights-parsers.mjs';
import { mergeFieldReviews } from '../../skills/game-account-arknights/scripts/field-reviews.mjs';
import { scoreListing } from '../../skills/game-account-arknights/scripts/score-listings.mjs';
import { applyRecommendationGate } from '../../skills/game-account-arknights/scripts/apply-recommendation-gate.mjs';
import { planCommunityRefresh } from '../../skills/game-account-toolkit/scripts/plan-community-refresh.mjs';
import { verifyValuationEvidence } from '../../skills/game-account-skill-optimizer/scripts/lib/valuation-evidence.mjs';

const now = '2026-10-05T00:00:00Z';
function evidence() {
  return { schema_version: 1, game: 'Arknights', version_context: 'synthetic-test-version', updated_at: '2026-10-04',
    sources: ['one', 'two'].map((id) => ({ id, url: `https://${id}.example.invalid/guide`, publisher: id, published_at: '2026-10-04', observed_at: now,
      content_kind: 'body', excerpt: 'Synthetic fixture only: operator works in story mode.', version_context: 'synthetic-test-version' })),
    claims: [{ id: 'story-core', kind: 'operator_valuation', subject: '测试干员', contexts: ['story'], status: 'supported', as_of: '2026-10-04', version_context: 'synthetic-test-version', source_ids: ['one', 'two'], values: { combat_value: 90, meta_tier: 'core' } }] };
}
const knowledge = { operators: { 测试干员: { combat_value: 45, acquisition_type: 'standard', collector_value: 0 } } };

test('PZDS keeps elite-two total distinct from elite-two six-stars and excludes resource tails from skins', () => {
  const [row] = parseArknightsOperation('pzds/arknights-detail', { url: 'https://www.pzds.com/goodsDetails/TEST/6', details: { goodsNo: 'TEST', price: 3200, title: '六星137，精二184，时装247(动态50)', description: '【精二六星数量】118' } });
  assert.equal(row.counts.elite2, 184);
  assert.equal(row.counts.elite2SixStar, 118);
  const [list] = parseArknightsOperation('pzds/arknights-list', { rows: [{ goodsNo: 'TEST', price: 1000, title: '特典时装:自由//失效·史尔特尔,合成玉369,龙门币99.5万' }] });
  assert.deepEqual(list.skins, ['自由//失效·史尔特尔']);
});

test('image reviews preserve conflicting values and reject evidence from another image', () => {
  const row = { listing_id: 'TEST', url: 'https://example.invalid/TEST', game_assets: { operators: [{ name: '测试干员', elite: 2, module: 1 }], platform_facts: { verification_image_urls: ['https://image.example.invalid/one'] } } };
  const review = { listing_id: 'TEST', source_url: row.url, field: 'operators.测试干员.module', value: 3, method: 'image_review', image_url: 'https://image.example.invalid/one', image_sha256: 'a'.repeat(64), region: [0.1, 0.1, 0.3, 0.3], quote: '测试干员 模组3', observed_at: now };
  const merged = mergeFieldReviews(row, [review]);
  assert.equal(merged.game_assets.operators[0].module, 1);
  assert.equal(fieldEvidenceStatus(merged, review.field, 1, now).status, 'conflicting');
  assert.throws(() => mergeFieldReviews(row, [{ ...review, image_url: 'https://image.example.invalid/other' }]), /Invalid image review/);
});

test('stale publications cannot become current by rereading or changing snapshot updated_at', () => {
  const snapshot = evidence();
  assert.equal(assessClaim(snapshot.claims[0], snapshot, { now }).eligible, true);
  for (const source of snapshot.sources) source.published_at = '2026-08-02';
  snapshot.updated_at = now;
  assert.equal(assessClaim(snapshot.claims[0], snapshot, { now }).eligible, false);
  assert.deepEqual(resolveContextKnowledge(knowledge, snapshot, { now }).applied_claim_ids, []);
});

test('two links by one publisher, title-only sources, future dates and wrong versions cannot support valuation', () => {
  for (const mutate of [
    (s) => { s.sources[1].publisher = 'one'; },
    (s) => { s.sources[1].content_kind = 'title'; },
    (s) => { s.claims[0].as_of = '2026-10-06'; },
    (s) => { s.sources[1].version_context = 'old'; },
  ]) {
    const sample = evidence(); mutate(sample);
    assert.equal(assessClaim(sample.claims[0], sample, { now }).eligible, false);
  }
});

test('context knowledge changes scoring inputs only in the supported mode; disputes remain unapplied', () => {
  const sample = evidence();
  assert.equal(resolveContextKnowledge(knowledge, sample, { now }).knowledge.operators.测试干员.combat_value, 90);
  assert.equal(resolveContextKnowledge(knowledge, sample, { now, context: 'roguelike' }).knowledge.operators.测试干员.combat_value, 45);
  sample.claims.push({ ...sample.claims[0], id: 'disputed', values: { combat_value: 30 } });
  assert.equal(resolveContextKnowledge(knowledge, sample, { now }).knowledge.operators.测试干员.combat_value, 45);
  assert.equal(knowledge.operators.测试干员.combat_value, 45);
  assert.deepEqual(playContexts('明日方舟肉鸽和高难'), ['roguelike', 'high_difficulty']);
});

function listing() {
  return { listing_id: 'TEST-1', price: 1000, url: 'https://example.invalid/TEST-1', hard_filter_passed: true, game_assets: {}, field_evidence: [
    { field: 'price', value: 1000, listing_id: 'TEST-1', source_url: 'https://example.invalid/TEST-1', observed_at: now, method: 'platform_detail', quote: '1000' },
    { field: 'listing_id', value: 'TEST-1', listing_id: 'TEST-1', source_url: 'https://example.invalid/TEST-1', observed_at: now, method: 'platform_detail', quote: 'TEST-1' },
  ] };
}

test('main recommendation checks proof, not seller labels; wrong-listing evidence and conflicts fail closed', () => {
  const row = listing();
  const profile = { priorities: { rarity: 100 }, hard_conditions: [], play_contexts: ['story'] };
  assert.equal(assessRecommendation(row, profile, knowledge, null, { now }).eligible, true);
  row.field_evidence[0].listing_id = 'OTHER';
  assert.equal(fieldEvidenceStatus(row, 'price', 1000, now).status, 'unverified');
  row.field_evidence[0].listing_id = 'TEST-1';
  row.field_evidence.push({ ...row.field_evidence[0], value: 1200 });
  assert.equal(fieldEvidenceStatus(row, 'price', 1000, now).status, 'conflicting');
  row.field_evidence = row.field_evidence.map((field) => ({ ...field, method: 'seller_claim' }));
  assert.equal(assessRecommendation(row, profile, knowledge, null, { now }).eligible, false);
});

test('unclaimed fields need not block; explicitly claimed modules must have evidence', () => {
  const row = listing();
  const profile = { priorities: { rarity: 100 }, hard_conditions: [] };
  assert.equal(assessRecommendation(row, profile, knowledge, null, { now }).eligible, true);
  row.recommendation_claims = [{ required_fields: [{ field: 'operators.测试干员.module', value: 3 }] }];
  assert.equal(assessRecommendation(row, profile, knowledge, null, { now }).eligible, false);
});

test('community updater preserves machine-readable teams, version and claim/source linkage', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-evidence-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sample = { ...evidence(), consensus: { key_teams: ['synthetic test team'], signature_weapon_notes: ['synthetic requirement'] } };
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(sample));
  const result = spawnSync(process.execPath, ['skills/game-account-community-updater/scripts/update-community-evidence.mjs', '--skill', 'skills/game-account-arknights', '--evidence', path.join(dir, 'input.json'), '--out', path.join(dir, 'out')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'out/community-evidence.json'), 'utf8')), sample);
  assert.match(fs.readFileSync(path.join(dir, 'out/community-evidence.md'), 'utf8'), /synthetic test team/);
});

test('checkpoint resumes successful reads, rejects different profiles and limits retries/time', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-checkpoint-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'run.json');
  let clock = 1000;
  const options = { file, identity: { profile: 'test' }, now: () => clock, budgetMs: 10000 };
  const first = createSelectionCheckpoint(options);
  let calls = 0;
  const good = () => { calls++; return { ok: true, operation_report: { task_space_id: 42 } }; };
  first.execute('list', good);
  const resumed = createSelectionCheckpoint({ ...options, resume: true });
  assert.equal(resumed.execute('list', good).cache_hit, true);
  assert.equal(calls, 1);
  clock += 1000;
  assert.equal(resumed.execute('list', good).observed_at, new Date(1000).toISOString(), 'resuming does not renew fact age');
  assert.equal(resumed.state.task_space_id, 42);
  assert.throws(() => createSelectionCheckpoint({ ...options, identity: {}, resume: true }), /differ/);
  const fail = () => ({ ok: false });
  resumed.execute('failed', fail); resumed.execute('failed', fail);
  assert.equal(resumed.execute('failed', fail).retry_exhausted, true);
  clock += 10001;
  assert.match(resumed.execute('new', good).error_text, /budget_exhausted/);
  resumed.stop('user_control');
  assert.throws(() => createSelectionCheckpoint({ ...options, resume: true }), /explicit user resume/);
});

test('malformed evidence fails closed without throwing; stored current markers do not bypass expiry', () => {
  for (const sample of [null, { claims: 'bad' }, { ...evidence(), claims: [null] }, { ...evidence(), sources: null }, { ...evidence(), claims: [{ ...evidence().claims[0], source_ids: 42 }] }]) {
    assert.equal(validateEvidence(sample).valid, false);
    assert.deepEqual(resolveContextKnowledge(knowledge, sample, { now }).applied_claim_ids, []);
  }
  const forged = structuredClone(knowledge); forged.operators.测试干员.current_claim_id = 'old';
  assert.equal(resolveContextKnowledge(forged, null, { now }).knowledge.operators.测试干员.current_claim_id, undefined);
  const wrong = evidence(); wrong.claims[0].values.requirements = { module: 9 };
  assert.equal(validateEvidence(wrong).valid, false);
  assert.deepEqual(resolveContextKnowledge(knowledge, { ...evidence(), game: 'Other' }, { now, game: 'Arknights' }).applied_claim_ids, []);
});

test('real scoring uses contextual current claims and the finalizer removes stale primary recommendations', () => {
  assert.equal(scoreListing(listing(), { budget: {}, hard_conditions: [] }, { knowledge, evidence: evidence(), now }).recommendation_gate.eligible, false, 'implicit scoring priorities must also be checked');
  const row = listing(); row.platform = 'test';
  row.game_assets.operators = [{ name: '测试干员', elite: 2, mastery: null, module: null }];
  for (const [suffix, value] of [['present', true], ['elite', 2]]) row.field_evidence.push({ ...row.field_evidence[0], field: `operators.测试干员.${suffix}`, value });
  const profile = { priorities: { combat: 100 }, budget: { primary_min: 500, primary_max: 1500 }, hard_conditions: [], play_contexts: ['story'] };
  const current = scoreListing(row, profile, { evidence: evidence(), knowledge, now });
  const historical = scoreListing(row, profile, { evidence: { ...evidence(), claims: [] }, knowledge, now });
  assert.ok(current.base_dimensions.combat > historical.base_dimensions.combat);
  assert.equal(current.recommendation_gate.eligible, true);
  const roguelike = scoreListing(row, { ...profile, play_contexts: ['roguelike'] }, { evidence: evidence(), knowledge, now });
  assert.deepEqual(roguelike.context_scores[0].applied_claim_ids, []);
  const artifact = { evidence_policy: { version: 1 }, selection_profile: profile, recommendations: [row], rankings: [row], best_value_listing: row, platform_shortlists: { test: { qualifying: [row], display_candidates: [row] } } };
  const expired = evidence(); expired.sources.forEach((source) => { source.published_at = '2026-08-02'; });
  applyRecommendationGate(artifact, { evidence: expired, knowledge, now });
  assert.equal(artifact.recommendations.length, 0);
  assert.equal(artifact.best_value_listing, null);
  assert.equal(artifact.pending_verification.length, 1);
  const once = JSON.stringify(artifact);
  applyRecommendationGate(artifact, { evidence: expired, knowledge, now });
  assert.equal(JSON.stringify(artifact), once, 'repeated finalization keeps the same business result');
});

test('structured field evidence preserves source paths and ordinary seller names remain unverified', () => {
  const row = listing(); row.game_assets.resources = { orundum: 123 };
  const raw = { listingId: row.listing_id, priceCny: 1000, counts: { orundum: 123 }, operatorNames: ['测试干员'], elite2OperatorNames: ['测试干员'], status: { officialVerification: true } };
  row.field_evidence = detailFieldEvidence(raw, row, now);
  assert.equal(fieldEvidenceStatus(row, 'resources.orundum', 123, now).status, 'verified');
  assert.equal(row.field_evidence.find((proof) => proof.field === 'resources.orundum').source_field, 'counts.orundum');
  assert.ok(row.field_evidence.every((proof) => !Object.hasOwn(proof, 'quote')));
  row.field_evidence = detailFieldEvidence({ ...raw, status: {} }, row, now);
  assert.equal(fieldEvidenceStatus(row, 'operators.测试干员.present', true, now).status, 'unverified');
});

test('refresh plan targets missing requested contexts and never declares titles sufficient', () => {
  const plan = planCommunityRefresh({ request: '明日方舟肉鸽和高难', listings: [{ game_assets: { operators: [{ name: '测试干员' }] } }], evidence: evidence(), knowledge, now });
  assert.equal(plan.required, true);
  assert.deepEqual(plan.contexts, ['roguelike', 'high_difficulty']);
  assert.equal(plan.tasks.length, 2);
  assert.match(plan.tasks[0].query, /测试干员/);
  assert.equal(plan.budget_minutes, 8);
});

test('valuation verification rejects changed numeric facts without matching current independent sources', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-valuation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = 'skills/game-account-arknights/references';
  fs.mkdirSync(path.join(root, directory), { recursive: true });
  const file = `${directory}/operator-value-map.json`;
  fs.writeFileSync(path.join(root, file), JSON.stringify(knowledge));
  const before = snapshot(root); captureBaseline(root, before);
  fs.writeFileSync(path.join(root, file), JSON.stringify({ operators: { 测试干员: { combat_value: 99 } } }));
  assert.throws(() => verifyValuationEvidence(root, before, [file]), /lacks matching current sources/);
});

test('accepted cases are protected and rollback refuses subsequent user edits', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gas-baseline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'skills/demo/test-fixtures'), { recursive: true });
  const source = 'skills/demo/source.mjs';
  const fixture = 'skills/demo/test-fixtures/accepted.json';
  fs.writeFileSync(path.join(root, source), 'before');
  fs.writeFileSync(path.join(root, fixture), '{"accepted":true}');
  const before = snapshot(root);
  captureBaseline(root, before);
  fs.writeFileSync(path.join(root, source), 'after');
  const after = snapshot(root);
  assert.equal(checkProtectedRegressions(before, after).passed, true);
  fs.writeFileSync(path.join(root, fixture), '{}');
  assert.equal(checkProtectedRegressions(before, snapshot(root)).passed, false);
  const receipt = { changed_targets: [source], after_files: { [source]: after[source] } };
  fs.writeFileSync(path.join(root, source), 'user edit');
  assert.throws(() => rollbackTargets(root, before, receipt), /changed since/);
  assert.equal(fs.readFileSync(path.join(root, source), 'utf8'), 'user edit');
  fs.writeFileSync(path.join(root, source), 'after');
  rollbackTargets(root, before, receipt);
  assert.equal(fs.readFileSync(path.join(root, source), 'utf8'), 'before');
});
