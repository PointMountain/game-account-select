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
const today = new Date('2026-11-09T00:00:00Z');
const namedSignal = (as_of) => [{ id: 'limited', label: '限定', objective: 'rarity', names: ['A'], scale: 1, as_of }];

test('fresh evidence with a current supported claim allows high confidence', () => {
  const root = fixture({
    evidence: { updated_at: '2026-11-07', version_context: '3.4', claims: [{ status: 'supported', as_of: '2026-11-06' }] },
    signals: namedSignal('2026-11-07'),
  });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.status, 'fresh');
  assert.equal(result.refresh_required, false);
  assert.equal(result.max_confidence, 'high');
});

test('old snapshot, unconfirmed version and stale roster all require refresh before screening', () => {
  const root = fixture({ evidence: { updated_at: '2026-08-03', version_context: 'unverified', claims: [] }, signals: namedSignal('2026-08-03') });
  const result = checkFreshness('demo', { today, root });
  assert.equal(result.refresh_required, true);
  assert.equal(result.max_confidence, 'medium');
  assert.deepEqual(result.targets.sort(), ['evidence', 'signal:limited', 'version']);
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

test('an unknown game requires setup instead of silently screening', () => {
  assert.equal(checkFreshness('no-such-game').status, 'missing');
});

test('the shortlist report states the data date and confidence cap when data is stale', () => {
  const freshness = { status: 'stale', max_confidence: 'medium', snapshot_date: '2026-08-03', reasons: ['community evidence is 98 days old (> 7)'] };
  const result = shortlist([], loadGame('zenless-zone-zero'), { priorities: { combat: 100 }, budget: {} }, { freshness });
  assert.equal(result.data_freshness.max_confidence, 'medium');
  assert.match(renderMarkdown(result), /数据新鲜度：stale（快照 2026-08-03）/);
});
