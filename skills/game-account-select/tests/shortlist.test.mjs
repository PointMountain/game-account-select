import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateListing, loadGame, resolveGame, shortlist, renderMarkdown } from '../scripts/shortlist.mjs';
import { parseSelectionProfile } from '../scripts/profile.mjs';

const gamesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../references/games');

test('every game directory has a loadable game.json, index and refresh operation', () => {
  for (const slug of fs.readdirSync(gamesRoot).filter((name) => fs.statSync(path.join(gamesRoot, name)).isDirectory())) {
    const game = loadGame(slug);
    assert.equal(game.game, slug);
    assert.ok(game.signals.length > 0, slug);
    for (const signal of game.signals) assert.ok(['rarity', 'combat', 'progression', 'resources', 'skins'].includes(signal.objective), `${slug}:${signal.id}`);
    assert.ok(fs.existsSync(path.join(gamesRoot, slug, 'index.md')));
    assert.ok(fs.existsSync(path.join(gamesRoot, slug, 'operations/refresh-evidence.md')));
    assert.equal(resolveGame(game.label), slug);
  }
});

const zzz = loadGame('zenless-zone-zero');
const listing = (overrides) => ({ listingId: 'A', priceCny: 500, url: 'https://www.pzds.com/goodsDetails/A/6', title: '', ...overrides });

test('named void hunters and signature engines outrank count-only listings', () => {
  const profile = parseSelectionProfile('绝区零 600元左右 虚狩多');
  const named = listing({ listingId: 'N', agentStatuses: { 星见雅: '2+1', 仪玄: '0' }, sWEngineNames: [] });
  const countOnly = listing({ listingId: 'C', title: 'S级代理人20 极品号' });
  const result = shortlist([countOnly, named], zzz, profile);
  assert.equal(result.primary[0].listing_id, 'N');
  assert.ok(result.primary[0].highlights.some((h) => h.includes('星见雅')));
});

test('single-character names never match free text and missing fields are reported, not rewarded', () => {
  const row = evaluateListing(listing({ title: '照片齐全 简单号' }), zzz, { priorities: { rarity: 100 } });
  assert.ok(!row.highlights.some((h) => /照|简/.test(h)), JSON.stringify(row.highlights));
  assert.ok(row.missing_fields.includes('区服'));
  assert.ok(row.missing_fields.includes('平台验号时间'));
});

test('must-have assets are hard filters; budget expansion finds the cheapest satisfying listing', () => {
  const profile = { ...parseSelectionProfile('绝区零 300元左右'), must_have: ['星见雅'] };
  const rows = [
    listing({ listingId: 'IN', priceCny: 300, agentStatuses: { 仪玄: '0' } }),
    listing({ listingId: 'HI', priceCny: 900, agentStatuses: { 星见雅: '0' } }),
    listing({ listingId: 'MID', priceCny: 600, agentStatuses: { 星见雅: '0' } }),
  ];
  const result = shortlist(rows, zzz, profile);
  assert.equal(result.primary.length, 0);
  assert.deepEqual(result.budget_expansion.map((r) => r.listing_id), ['MID', 'HI']);
  assert.equal(result.near_matches[0].listing_id, 'IN');
  assert.match(renderMarkdown(result), /预算内满足硬条件（0）/);
});

test('hard server condition filters by listing or binding server; ZZZ email risk words are surfaced', () => {
  const profile = { priorities: { combat: 100 }, hard_conditions: ['server:官服'], budget: {} };
  const official = evaluateListing(listing({ binding: { server: '米哈游官服', email: '邮箱未绑定' } }), zzz, profile);
  const bilibili = evaluateListing(listing({ server: 'B服', title: '邮箱不出售' }), zzz, profile);
  assert.equal(official.hard_ok, true);
  assert.ok(official.risk_positive.includes('邮箱未绑定'));
  assert.equal(bilibili.hard_ok, false);
  assert.ok(bilibili.risk_negative.includes('邮箱不出售'));
});

test('the profile stays run-only', () => {
  assert.equal(parseSelectionProfile('明日方舟 1000元 限定多').persistence_scope, 'run_only');
});
