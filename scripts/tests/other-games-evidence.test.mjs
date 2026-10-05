import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gameEvidenceConfig, assessGameRecommendation, planGameCommunityRefresh} from '../../skills/game-account-toolkit/scripts/game-evidence.mjs';
import {evaluateListings} from '../../skills/game-account-toolkit/scripts/evaluate-listings.mjs';
import {applyGameEvidenceGate} from '../../skills/game-account-toolkit/scripts/finalize-game-evaluation.mjs';
import {validateEvidence} from '../../skills/game-account-toolkit/scripts/community-evidence.mjs';
import {verifyValuationEvidence} from '../../skills/game-account-skill-optimizer/scripts/lib/valuation-evidence.mjs';

// Synthetic evidence tests the protocol, never real game strength or market facts.
const now = '2026-10-05T03:00:00.000Z';
const profile = {source_text: '日常队伍', version_context: 'test-version', persistence_scope: 'run_only'};
const valueAt = (row, field) => field === 'listing_id' ? String(row.id) : field.split('.').reduce((v, k) => v?.[k], row);
const scorer = () => ({final_score: 71, confidence: 'high', components: {asset: 71}, missing_fields: []});

function sample(game) {
  const config = gameEvidenceConfig[game];
  const listing = {id: 'anonymous-sample', platform: 'example', url: 'https://example.invalid/account', price: 500, server: '官服',
    game_assets: {
      [config.roster]: [{name: 'Core', [config.duplicates]: 2}, {name: 'Support', [config.duplicates]: 0}],
      [config.equipment]: [{name: 'Equipment'}],
      [config.resources]: {test_currency: 100},
      [config.risk]: Object.fromEntries(config.riskFields.map((field) => [field, field === 'official_verification' ? true : field === 'guarantee' ? 'retrieval_compensation' : 'clean'])),
    }};
  const evidence = {schema_version: 1, game, version_context: 'test-version',
    sources: ['one', 'two'].map((id) => ({id, publisher: id, url: `https://example.invalid/${id}`, published_at: '2026-10-04T00:00:00Z', observed_at: now,
      content_kind: 'body', excerpt: 'Synthetic test team and requirements.', version_context: 'test-version'})),
    claims: [{id: 'team', kind: 'team_recommendation', subject: 'Synthetic team', status: 'supported', as_of: now,
      version_context: 'test-version', contexts: ['story'], source_ids: ['one', 'two'], members: ['Core', 'Support'],
      equipment: ['Equipment'], requirements: [{member: 'Core', field: config.duplicates, minimum: 2}]}]};
  const gate = assessGameRecommendation(game, listing, {profile, evidence, now});
  listing.field_evidence = gate.field_checks.map(({field}) => ({field, value: valueAt(listing, field), listing_id: listing.id,
    source_url: listing.url, observed_at: now, method: 'platform_detail', quote: 'Synthetic source field'}));
  return {listing, evidence};
}

for (const game of Object.keys(gameEvidenceConfig)) {
  const scoreKey = game.replaceAll('-', '_') + '_score';
  test(`${game}: evaluator preserves facts and historical scores but gates current recommendations`, () => {
    const {listing, evidence} = sample(game);
    const evaluated = evaluateListings({game, scoreKey, scoreListing: scorer, inputValue: listing, profile, evidence, now})[0];
    assert.equal(evaluated.recommendation_gate.eligible, true);
    assert.equal(evaluated[scoreKey].final_score, 71);
    assert.equal(evaluated[scoreKey].score_basis, 'historical_baseline');
    assert.deepEqual(evaluated.source_listing, listing);
    const unknown = evaluateListings({game, scoreKey, scoreListing: scorer, inputValue: listing, profile, evidence: {...evidence, claims: []}, now})[0];
    assert.equal(unknown.recommendation_gate.status, 'pending_verification');
    assert.equal(unknown[scoreKey].confidence, 'low');
    assert.equal(unknown[scoreKey].final_score, 71);
  });

  test(`${game}: stale, conflicting, seller-only and wrong-account proofs fail closed`, () => {
    for (const mutate of [
      (row) => {row.field_evidence[0].observed_at = '2026-10-03T00:00:00Z';},
      (row) => {row.field_evidence[0].listing_id = 'another-account';},
      (row) => {row.field_evidence[0].method = 'seller_claim';},
      (row) => {row.field_evidence.push({...row.field_evidence[1], value: 1});},
      (row) => {row.game_assets[gameEvidenceConfig[game].roster][0][gameEvidenceConfig[game].duplicates] = null;},
    ]) {
      const {listing, evidence} = sample(game); mutate(listing);
      assert.equal(assessGameRecommendation(game, listing, {profile, evidence, now}).eligible, false);
    }
  });

  test(`${game}: date, game, version, author independence, mode and equipment remain separate gates`, () => {
    for (const mutate of [
      (e) => {e.sources[0].published_at = '2026-09-01T00:00:00Z';},
      (e) => {e.sources[1].publisher = e.sources[0].publisher;},
      (e) => {e.game = 'Arknights';},
      (e) => {e.claims[0].contexts = ['high_difficulty'];},
      (e) => {e.version_context = 'another-version';},
      (e) => {e.claims[0].equipment = ['Absent Equipment'];},
      (e) => {e.claims.push({...e.claims[0], id: 'dispute', status: 'disputed'});},
    ]) {
      const {listing, evidence} = sample(game); mutate(evidence);
      assert.equal(assessGameRecommendation(game, listing, {profile, evidence, now}).eligible, false);
    }
    const {listing, evidence} = sample(game);
    assert.equal(assessGameRecommendation(game, listing, {evidence, now}).eligible, false, 'current run version is required');
    assert.equal(assessGameRecommendation(game, listing, {profile: {...profile, hard_conditions: ['unimplemented:condition']}, evidence, now}).eligible, false);
    assert.equal(assessGameRecommendation(game, listing, {profile: {...profile, budget: {primary_max: 100}}, evidence, now}).eligible, false);
  });

  test(`${game}: finalizer ignores cached eligibility and retains every pending account`, () => {
    const {listing, evidence} = sample(game);
    const row = evaluateListings({game, scoreKey, scoreListing: scorer, inputValue: listing, profile, evidence, now})[0];
    row.listing.price = 1;
    row[scoreKey].final_score = 999;
    row.source_listing.field_evidence = [];
    const artifact = {evaluations: [row], recommendations: [row], best_value_listing: row,
      selection_profile: profile, user_request: profile.source_text, community_evidence: evidence};
    applyGameEvidenceGate(artifact, {targetSkill: `skills/game-account-${game}`, scoreKey, scoreListing: scorer}, {now});
    assert.equal(artifact.recommendations.length, 0);
    assert.equal(artifact.best_value_listing, null);
    assert.equal(artifact.pending_verification.length, 1);
    assert.equal(artifact.evaluations[0][scoreKey].confidence, 'low');
    assert.equal(artifact.evaluations[0].listing.price, 500);
    assert.equal(artifact.evaluations[0][scoreKey].final_score, 71);
    assert.equal(artifact.evaluations[0].recommendation_gate.status, 'pending_verification');
  });

  test(`${game}: refresh plan targets this game's uncovered roster and requested mode`, () => {
    const {listing, evidence} = sample(game);
    const plan = planGameCommunityRefresh({game, request: '高难', listings: [listing], evidence, now});
    assert.equal(plan.required, true);
    assert.deepEqual(plan.contexts, ['high_difficulty']);
    assert.ok(plan.tasks[0].query.startsWith(gameEvidenceConfig[game].label));
    assert.deepEqual(plan.gaps[0].missing_subjects, ['Core', 'Support']);
  });
}

test('team evidence rejects missing members and invalid progression schemas', () => {
  const {evidence} = sample('zenless-zone-zero');
  evidence.claims[0].requirements[0].minimum = 999;
  assert.equal(validateEvidence(evidence).valid, false);
  evidence.claims[0].members = [];
  assert.equal(validateEvidence(evidence).valid, false);
  evidence.claims[0].members = 42;
  assert.equal(validateEvidence(evidence).valid, false);
});

test('learning gate rejects unsupported cross-game evidence updates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'other-games-learning-'));
  try {
    const file = 'skills/game-account-wuthering-waves/references/community-evidence.json';
    const {evidence} = sample('wuthering-waves');
    evidence.sources[1].publisher = evidence.sources[0].publisher;
    fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
    fs.writeFileSync(path.join(root, file), JSON.stringify(evidence));
    assert.throws(() => verifyValuationEvidence(root, {}, [file]), /Current independent valuation evidence missing/);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

for (const [game, fixture] of Object.entries({
  'zenless-zone-zero': 'zenless-zone-zero', 'wuthering-waves': 'wuthering-waves', 'neverness-to-everness': 'neverness',
})) {
  test(`${game}: real CLI/finalizer chain preserves delivery hash and pending reasons`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'other-games-cli-'));
    const run = (script, args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
    try {
      const source = JSON.parse(fs.readFileSync(`skills/game-account-${game}/test-fixtures/${fixture}-run-artifact.json`, 'utf8'));
      const inputPath = path.join(root, 'input.json');
      const outputPath = path.join(root, 'evaluation.json');
      const {listing} = sample(game);
      fs.writeFileSync(inputPath, JSON.stringify(listing));
      const evaluated = run(`skills/game-account-${game}/scripts/evaluate-listing.mjs`, ['--input', inputPath, '--out', outputPath]);
      assert.equal(evaluated.status, 0, evaluated.stderr);
      const evaluation = JSON.parse(fs.readFileSync(outputPath));
      assert.equal(evaluation.recommendation_gate.eligible, false);
      source.evaluations = [evaluation];
      source.community_evidence = {schema_version: 1, game, version_context: 'unverified', sources: [], claims: []};
      source.community_attempts = [{source: 'synthetic-test-source', status: 'limited', result_count: 1, note: 'Synthetic evidence was read but did not establish current consensus.'}];
      delete source.run_id;
      fs.writeFileSync(inputPath, JSON.stringify(source));
      const finalized = run(`skills/game-account-${game}/scripts/finalize-evaluation-run.mjs`, ['--input', inputPath]);
      assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
      const artifact = JSON.parse(fs.readFileSync(inputPath));
      assert.equal(artifact.recommendations.length, 0);
      assert.equal(artifact.pending_verification.length, 1);
      assert.match(artifact.final_response, /anonymous-sample 待核实/);
      assert.equal(artifact.delivery_contract.final_response_sha256, crypto.createHash('sha256').update(artifact.final_response).digest('hex'));
    } finally {fs.rmSync(root, {recursive: true, force: true});}
  });
}

test('real v1 closeout collects learning in an isolated repository and keeps report hashes stable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-learning-closeout-'));
  try {
    for (const name of ['skills', 'scripts', 'docs']) fs.cpSync(name, path.join(root, name), {recursive: true});
    for (const name of ['package.json', 'CONTEXT.md', 'AGENTS.md', 'CLAUDE.md']) if (fs.existsSync(name)) fs.copyFileSync(name, path.join(root, name));
    const source = JSON.parse(fs.readFileSync('skills/game-account-wuthering-waves/test-fixtures/wuthering-waves-run-artifact.json'));
    source.run_id = 'isolated-learning-regression';
    source.evidence_policy = {version: 1};
    source.community_attempts = [{source: 'synthetic-test-source', status: 'limited', result_count: 1}];
    const file = path.join(root, '.harness', 'run.json');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(source));
    const run = () => spawnSync(process.execPath, [path.join(root, 'skills/game-account-wuthering-waves/scripts/finalize-evaluation-run.mjs'), '--input', file],
      {cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
    const first = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const artifact = JSON.parse(fs.readFileSync(file));
    assert.equal(artifact.self_improve.learning.status, 'collected');
    assert.equal(JSON.parse(fs.readFileSync(artifact.self_improve.learning.repair_plan)).execution, 'agent_in_current_session');
    assert.ok(fs.existsSync(path.join(root, '.harness/learning.json')));
    assert.equal(artifact.delivery_contract.final_response_sha256, crypto.createHash('sha256').update(artifact.final_response).digest('hex'));
    const second = run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(fs.readFileSync(file)).final_response, artifact.final_response);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
