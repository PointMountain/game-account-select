import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFreshness } from '../scripts/freshness.mjs';
import { loadGame, shortlist, renderMarkdown } from '../scripts/shortlist.mjs';

function fixture({ evidence, signals }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freshness-'));
  const dir = path.join(root, 'references/games/demo');
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ game: 'demo', signals }));
  fs.writeFileSync(path.join(dir, 'data/community-evidence.json'), JSON.stringify(evidence));
  return root;
}
const today = new Date('2026-11-09T12:00:00');
const namedSignal = (as_of) => [{ id: 'limited', label: '限定', objective: 'rarity', names: ['A'], scale: 1, as_of }];
const currentEvidence = () => ({
  updated_at: '2026-11-07', version_context: '3.4',
  sources: ['one', 'two'].map((id) => ({ id, publisher: id, url: `https://example.invalid/${id}`,
    published_at: '2026-11-06T00:00:00Z', observed_at: '2026-11-07T00:00:00Z',
    content_kind: 'body', excerpt: 'Synthetic evidence.', version_context: '3.4' })),
  claims: [{ id: 'claim', subject: 'A', status: 'supported', as_of: '2026-11-06', version_context: '3.4', contexts: ['story'], source_ids: ['one', 'two'] }],
});

test('fresh evidence with a current supported claim allows high confidence', () => {
  const root = fixture({
    evidence: currentEvidence(),
    signals: namedSignal('2026-11-07'),
  });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.status, 'fresh');
  assert.equal(result.refresh_required, false);
  assert.equal(result.max_confidence, 'high');
});

test('a claim needs two independent recent authors before evidence is fresh', () => {
  for (const mutate of [
    (evidence) => { evidence.sources[1].publisher = evidence.sources[0].publisher; },
    (evidence) => { evidence.sources[1].published_at = '2026-10-01'; },
    (evidence) => { evidence.sources = []; },
    (evidence) => { evidence.sources[1].url = evidence.sources[0].url; },
    (evidence) => { evidence.claims[0].contexts = []; },
  ]) {
    const evidence = currentEvidence();
    mutate(evidence);
    const root = fixture({ evidence, signals: namedSignal('2026-11-07') });
    const result = checkFreshness('demo', { today, root });
    assert.equal(result.status, 'stale');
    assert.equal(result.refresh_required, true);
    assert.equal(result.max_confidence, 'medium');
  }
});

test('a recent snapshot without a current claim still requires a refresh', () => {
  const root = fixture({ evidence: { updated_at: '2026-11-09', version_context: '3.4', claims: [] }, signals: namedSignal('2026-11-09') });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.status, 'stale');
  assert.equal(result.refresh_required, true);
  assert.equal(result.max_confidence, 'medium');
  assert.ok(result.targets.includes('claims'));
});

test('old snapshot, unconfirmed version and stale roster all require refresh before screening', () => {
  const root = fixture({ evidence: { updated_at: '2026-08-03', version_context: 'unverified', claims: [] }, signals: namedSignal('2026-08-03') });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.refresh_required, true);
  assert.equal(result.max_confidence, 'medium');
  assert.deepEqual(result.targets.sort(), ['claims', 'evidence', 'signal:limited', 'version']);
});

test('a refresh attempt logged today stops repeated refreshes but keeps the confidence cap', () => {
  const root = fixture({
    evidence: { updated_at: '2026-08-03', version_context: 'unverified', claims: [], last_refresh_attempt: { date: '2026-11-09', outcome: 'failed' } },
    signals: namedSignal('2026-08-03'),
  });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.status, 'stale_refresh_attempted_today');
  assert.equal(result.refresh_required, false);
  assert.equal(result.max_confidence, 'medium');
});

test('future-dated snapshots and attempts do not prevent a needed refresh', () => {
  const evidence = currentEvidence();
  evidence.updated_at = '2026-11-10';
  evidence.last_refresh_attempt = { date: '2026-11-10', outcome: 'failed' };
  const root = fixture({ evidence, signals: namedSignal('2026-11-10') });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.status, 'stale');
  assert.equal(result.refresh_required, true);
  assert.equal(result.max_confidence, 'medium');
});

test('an unknown game requires setup instead of silently screening', () => {
  assert.equal(checkFreshness('no-such-game').status, 'missing');
});

test('the shortlist report states the data date and confidence cap when data is stale', () => {
  const freshness = { status: 'stale', max_confidence: 'medium', snapshot_date: '2026-08-03', reasons: ['community evidence is 98 days old (> 7)'] };
  const result = shortlist([], loadGame('zenless-zone-zero'), { priorities: { combat: 100 }, budget: {} }, { freshness });
  assert.equal(result.data_freshness.max_confidence, 'medium');
  assert.match(renderMarkdown(result), /数据新鲜度：stale（快照 2026-08-03）/);
});
