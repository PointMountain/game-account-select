import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

test('an undisclosed roster stays unknown instead of counting as zero named assets', () => {
  const row = evaluateListing(listing({ title: 'S级代理人20' }), zzz, { priorities: { rarity: 100 } });
  assert.ok(row.missing_fields.includes('虚狩'));
  assert.ok(row.missing_fields.includes('限定 S 代理人'));
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

test('shortlist enforces parsed guarantees, resources, exclusions and unknown hard conditions', () => {
  const profile = parseSelectionProfile('明日方舟预算1000元，合成玉至少50000以上，必须包赔，不要史尔特尔');
  const game = loadGame('arknights');
  const rejected = evaluateListing(listing({
    operatorNames: ['史尔特尔'], resources: { orundum: 1000 }, status: { guarantee: false },
  }), game, profile);
  const unknown = evaluateListing(listing({ operatorNames: ['维什戴尔'] }), game, profile);
  const unknownExclusion = evaluateListing(listing({
    operatorNames: ['维什戴尔'], resources: { orundum: 60000 }, status: { guarantee: true },
  }), game, profile);
  const accepted = evaluateListing(listing({
    operatorNames: ['维什戴尔'], resources: { orundum: 60000 }, status: { guarantee: true, assetRosterComplete: true },
  }), game, profile);
  assert.equal(rejected.hard_ok, false);
  assert.equal(unknown.hard_ok, false);
  assert.equal(unknownExclusion.hard_ok, false);
  assert.equal(accepted.hard_ok, true);
  assert.ok(unknown.missing_fields.includes('合成玉'));
});

test('official verification and complete rosters must be confirmed', () => {
  const game = { game: 'demo', signals: [
    { id: 'collab', label: '联动', objective: 'rarity', names: ['甲甲', '乙乙'], scale: 2 },
    { id: 'limited', label: '限定', objective: 'rarity', names: ['丙丙'], scale: 1 },
  ] };
  const profile = { priorities: { rarity: 100 }, hard_conditions: ['official_verification:true', 'collab_complete:true', 'limited_complete:true'] };
  const fresh = { signals: [{ id: 'collab', stale: false }, { id: 'limited', stale: false }], targets: [] };
  const complete = listing({ operatorNames: ['甲甲', '乙乙', '丙丙'], status: { officialVerification: true } });
  const partial = listing({ operatorNames: ['甲甲'], status: {} });
  assert.equal(evaluateListing(complete, game, profile, { freshness: fresh }).hard_ok, true);
  assert.equal(evaluateListing(partial, game, profile, { freshness: fresh }).hard_ok, false);
  assert.equal(evaluateListing(complete, game, profile, { freshness: { signals: fresh.signals } }).hard_ok, false);
  assert.equal(evaluateListing(complete, game, profile, { freshness: { ...fresh, targets: ['version'] } }).hard_ok, false);
  assert.equal(evaluateListing(complete, game, profile, { freshness: { ...fresh, signals: [{ id: 'collab', stale: true }, { id: 'limited', stale: false }] } }).hard_ok, false);
  assert.equal(shortlist([complete], game, profile, { freshness: { ...fresh, targets: ['version'] } }).primary.length, 0);
});

test('asset requirements recognize aliases but do not count negated text or an unknown server', () => {
  const profile = { priorities: { rarity: 100 }, must_have: ['星见雅'] };
  const absent = evaluateListing(listing({ title: '不含星见雅' }), zzz, profile);
  const present = evaluateListing(listing({ title: '含星见雅' }), zzz, profile);
  const unknownServer = evaluateListing(listing({ agentStatuses: { 星见雅: '0' } }), zzz, { ...profile, hard_conditions: ['server:官服'] });
  const alias = evaluateListing(listing({ operatorNames: ['假日威龙陈'] }), loadGame('arknights'), { priorities: { rarity: 100 }, must_have: ['水陈'] });
  assert.equal(absent.hard_ok, false);
  assert.ok(!absent.highlights.some((text) => text.includes('星见雅')));
  assert.equal(present.hard_ok, true);
  assert.equal(unknownServer.hard_ok, false);
  assert.equal(alias.hard_ok, true);
});

test('an unconfirmed required asset is reported as needing verification', () => {
  const profile = { priorities: { rarity: 100 }, must_have: ['星见雅'], budget: { primary_max: 1000 } };
  const result = shortlist([listing({ agentStatuses: { 仪玄: '0' } })], zzz, profile);
  assert.match(renderMarkdown(result), /星见雅待核实/);
});

test('strict budgets and explicit expansion caps apply to every displayed site list', () => {
  const strict = parseSelectionProfile('绝区零预算500元，绝不超预算');
  const expensive = listing({ priceCny: 2000, agentStatuses: { 星见雅: '0' } });
  const strictResult = shortlist([expensive], zzz, strict);
  assert.equal(strictResult.by_site.pzds.length, 0);
  assert.equal(strictResult.budget_expansion.length, 0);

  const capped = parseSelectionProfile('绝区零预算500元，超预算最高到600元，必须有星见雅');
  const affordable = listing({ listingId: 'WITHIN_CAP', url: 'https://www.pzds.com/goodsDetails/WITHIN_CAP/6', priceCny: 550, agentStatuses: { 星见雅: '0' } });
  const cappedResult = shortlist([expensive, affordable], zzz, capped);
  assert.deepEqual(cappedResult.budget_expansion.map((row) => row.listing_id), ['WITHIN_CAP']);
  assert.deepEqual(cappedResult.by_site.pzds.map((row) => row.listing_id), ['WITHIN_CAP']);
});

test('a listing with an undisclosed price remains visible as pending', () => {
  const profile = parseSelectionProfile('绝区零预算500元，绝不超预算');
  const result = shortlist([listing({ priceCny: null, agentStatuses: { 星见雅: '0' } })], zzz, profile);
  assert.equal(result.primary.length, 0);
  assert.ok(result.pending_by_site.pzds[0].missing_fields.includes('价格'));
});

test('adding a detail preserves list-only resources and guarantees for the same listing', () => {
  const profile = parseSelectionProfile('明日方舟预算1500元，优先合成玉');
  const listRow = listing({ resources: { orundum: 12015 }, status: { guarantee: true } });
  const detailRow = listing({ operatorNames: ['维什戴尔'], resources: { orundum: null }, status: { sourceStatus: 'success' } });
  const result = shortlist([listRow, detailRow], loadGame('arknights'), profile);
  assert.equal(result.counts.unique, 1);
  assert.equal(result.primary[0].guarantee, true);
  assert.ok(result.primary[0].highlights.includes('合成玉 12015'));
  assert.ok(!result.primary[0].missing_fields.includes('合成玉'));
});

test('the shortlist CLI combines list and detail files without losing resources', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortlist-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const profile = parseSelectionProfile('明日方舟预算1500元，优先合成玉');
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile));
  fs.writeFileSync(path.join(dir, 'list.json'), JSON.stringify({ data: [listing({ resources: { orundum: 12015 } })] }));
  fs.writeFileSync(path.join(dir, 'detail.json'), JSON.stringify({ data: [listing({ operatorNames: ['维什戴尔'] })] }));
  const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/shortlist.mjs');
  const run = spawnSync(process.execPath, [cli, '--profile', path.join(dir, 'profile.json'),
    '--listings', path.join(dir, 'list.json'), '--listings', path.join(dir, 'detail.json')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.counts.unique, 1);
  assert.ok(result.primary[0].highlights.includes('合成玉 12015'));
});

test('a conflicting list and detail price remains pending for manual verification', () => {
  const profile = parseSelectionProfile('明日方舟预算1500元，优先合成玉');
  const listRow = listing({ priceCny: 500, operatorNames: ['维什戴尔'] });
  const detailRow = listing({ priceCny: 600, operatorNames: ['维什戴尔'] });
  const result = shortlist([listRow, detailRow], loadGame('arknights'), profile);
  assert.equal(result.primary.length, 0);
  assert.ok(result.near_matches[0].unverified_conditions.some((item) => item.includes('价格')));
});

test('count-only accounts stay pending until named assets are available', () => {
  const game = loadGame('neverness-to-everness');
  const profile = { priorities: { rarity: 80, price_efficiency: 20 }, budget: { primary_max: 1000 } };
  const countOnly = listing({ listingId: 'COUNT', title: 'S角色12 S弧盘8', priceCny: 300 });
  const named = listing({ listingId: 'NAMED', url: 'https://www.pzds.com/goodsDetails/NAMED/6', title: 'S角色3', assets: [{ name: '真红' }] });
  const result = shortlist([countOnly, named], game, profile);
  assert.equal(result.primary[0].listing_id, 'NAMED');
  assert.ok(result.near_matches.some((row) => row.listing_id === 'COUNT'));
  assert.equal(shortlist([countOnly], game, profile).primary.length, 0);
});

test('each platform keeps pending candidates available for detail checks', () => {
  const game = loadGame('neverness-to-everness');
  const profile = { priorities: { rarity: 100 }, budget: { primary_max: 1000 } };
  const pxb7 = listing({ listingId: 'PX', url: 'https://www.pxb7.com/product/PX/1', title: 'S角色12' });
  const pzds = listing({ listingId: 'PZ', url: 'https://www.pzds.com/goodsDetails/PZ/6', title: 'S角色10' });
  const result = shortlist([pxb7, pzds], game, profile);
  assert.equal(result.primary.length, 0);
  assert.deepEqual(result.pending_by_site.pxb7.map((row) => row.listing_id), ['PX']);
  assert.deepEqual(result.pending_by_site.pzds.map((row) => row.listing_id), ['PZ']);
});

test('the report distinguishes total matches from the number displayed', () => {
  const profile = { priorities: { rarity: 100 }, budget: { primary_max: 1000 } };
  const rows = [
    listing({ listingId: 'A', agentStatuses: { 星见雅: '0' } }),
    listing({ listingId: 'B', url: 'https://www.pzds.com/goodsDetails/B/6', agentStatuses: { 仪玄: '0' } }),
  ];
  const result = shortlist(rows, zzz, profile, { top: 1 });
  assert.match(renderMarkdown(result), /预算内满足硬条件（2，展示 1）/);
});

test('the documented void-hunter request proceeds without unnecessary objective clarification', () => {
  const profile = parseSelectionProfile('绝区零 800元左右 虚狩多 低风险');
  assert.equal(profile.confirmation_required, false);
  assert.ok(!profile.clarification_required.includes('objective'));
  assert.ok(profile.priorities.combat > 25);
});

test('the profile stays run-only', () => {
  assert.equal(parseSelectionProfile('明日方舟 1000元 限定多').persistence_scope, 'run_only');
});
