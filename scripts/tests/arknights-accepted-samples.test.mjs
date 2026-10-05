import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rankListings } from '../../skills/game-account-arknights/scripts/score-listings.mjs';

const file = new URL('../../skills/game-account-arknights/test-fixtures/accepted-samples-2026-10-05.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));

function listings() {
  return fixture.listings.map((sample) => ({
    listing_id: sample.id,
    platform: sample.platform,
    url: `https://example.invalid/${sample.id}`,
    price: sample.price,
    server: sample.server,
    game_assets: {
      operators: sample.operators.map(([name, elite, mastery, module]) => ({ name, elite, mastery, module })),
      resources: structuredClone(sample.resources),
      skins: [...sample.skins],
      collab_completion: { ...sample.collab_completion },
      limited_completion: { ...sample.limited_completion },
      risk: { ...sample.risk },
      platform_facts: { counts: { ...sample.counts } },
    },
  }));
}

for (const scenario of fixture.scenarios) {
  test(`reviewed historical samples retain ${scenario.name} ordering with frozen inputs`, () => {
    const ranked = rankListings(listings(), scenario.profile, {
      knowledge: fixture.knowledge,
      evidence: fixture.evidence,
      now: fixture.observed_at,
    });
    assert.deepEqual(ranked.map((row) => row.listing_id), scenario.expected_order);
    for (const row of ranked) {
      assert.equal(Number(row.final_score.toFixed(2)), scenario.expected_rounded_scores[row.listing_id]);
      assert.equal(row.recommendation_gate.status, scenario.expected_status);
      assert.ok(row.recommendation_gate.knowledge_checks.some((check) => check.status === 'unverified'));
      assert.ok(row.missing_fields.includes('operator_mastery_module'));
      assert.ok(row.risk_facts.includes('real_name_unknown'));
    }
  });
}

test('reviewed samples keep unknown progression and separate elite-two count scopes', () => {
  const pzds = fixture.listings.filter((row) => row.platform === 'pzds');
  assert.deepEqual(pzds.map((row) => [row.counts.elite2, row.counts.elite2SixStar]), [[66, 55], [95, 57]]);
  for (const sample of fixture.listings) {
    assert.ok(sample.operators.every(([, , mastery, module]) => mastery === null && module === null));
    assert.equal(sample.risk.real_name_status, 'unknown');
  }
});

test('sample approval remains regression-only and never supplies current community consensus', () => {
  assert.equal(fixture.acceptance.status, 'reviewed_without_objections');
  assert.equal(fixture.acceptance.persistence_scope, 'regression_only');
  assert.deepEqual(fixture.evidence.claims, []);
  assert.ok(fixture.scenarios.every((scenario) => scenario.profile.persistence_scope === 'run_only'));
  assert.ok(fixture.listings.every((row) => /^sample-[a-d]$/.test(row.id)));
  assert.doesNotMatch(JSON.stringify(fixture.listings), /https?:\/\/|\/Users\/|image_url|seller|listingId|productCode/);
});
