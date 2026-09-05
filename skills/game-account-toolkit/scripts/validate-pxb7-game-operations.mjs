import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizePxb7GameList } from '../ego-operations/pxb7-parsers.mjs';
import { parseZzzOperation } from '../ego-operations/zzz-parsers.mjs';
import { parseGenericGameOperation } from '../ego-operations/generic-game-parsers.mjs';
import { buildBrowserScript } from '../ego-operations/browser-scripts.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(dirname, '../test-fixtures/pxb7-game-details.json'), 'utf8'));
const list = normalizePxb7GameList({ rows: [
  { productId: '9000000000000000001', price: 12950, showTitle: '账号一' },
  { productId: '9000000000000000001', price: 12950, showTitle: '账号一' },
  { productId: '9000000000000000002', price: 30000, showTitle: '账号二' },
  { productId: '9000000000000000003', price: 6500, showTitle: '账号三' },
  { productId: '9000000000000000004', price: null, showTitle: '缺价账号' },
] }, { minPrice: 100, maxPrice: 300, sort: 'priceDesc' });
assert.deepEqual(list.map((row) => row.priceCny), [300, 129.5], 'CNY cents, bounds, deduplication and ordering');
assert.equal(list[1].listingId, '9000000000000000001', 'numeric IDs must retain string precision');

for (const [slug, gameId, query] of [['zzz', '10312', '绝区零'], ['wuthering-waves', '10302', '鸣潮'], ['neverness-to-everness', '10630', '异环']]) {
  const script = buildBrowserScript(`pxb7/${slug}-list`, { minPrice: 100, maxPrice: 300, limit: 45, page: 2 });
  const requests = [];
  const fakeFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return { ok: true, json: async () => ({ data: { list: Array.from({ length: 20 }, (_, index) => ({ gameId, productId: `${body.pageIndex}-${index}`, price: 12950, showTitle: `${query}账号` })) } }) };
  };
  const raw = await new Function('fetch', `return ${script};`)(fakeFetch);
  assert.equal(raw.rows.length, 45);
  assert.deepEqual(requests.map((request) => request.pageIndex), [2, 3, 4], 'pagination honors the requested start page');
  assert.ok(requests.every((request) => request.gameId === gameId && request.query === query));
  assert.deepEqual(requests[0].filterDTOList, [{ attrId: 'price', attrType: 3, attrValList: ['100', '300'] }]);
  await assert.rejects(new Function('fetch', `return ${script};`)(async () => ({ ok: true, json: async () => ({ data: { list: [{ gameId: 'wrong-game' }] } }) })), /different game/);
}

const zzz = parseZzzOperation('pxb7/zzz-detail', fixtures.zzz)[0];
assert.equal(zzz.listingId, '9000000000000000001');
assert.equal(zzz.productCode, 'JJTEST1', 'display code must be separate from canonical product ID');
assert.equal(zzz.priceCny, 129.5);
assert.deepEqual(zzz.agentStatuses, { 星见雅: '6+1', 仪玄: '2' });
assert.deepEqual(zzz.sWEngineNames, ['霰落星殿'], 'unlabelled cards and skins are not W-Engines');
assert.equal(zzz.resources.polychrome, 750, 'film negatives must not be parsed as Polychrome');

const wuwa = parseGenericGameOperation('pxb7/wuthering-waves-detail', fixtures['wuthering-waves'])[0];
assert.deepEqual(wuwa.assets.map((asset) => [asset.name, asset.kind, asset.advancement]), [['爱弥斯', 'character', 3], ['安可', 'character', 2], ['千古洑流', 'weapon', 2]]);
const nte = parseGenericGameOperation('pxb7/neverness-to-everness-detail', fixtures['neverness-to-everness'])[0];
assert.deepEqual(nte.assets.map((asset) => [asset.name, asset.kind, asset.advancement]), [['小吱', 'character', 5], ['浔', 'character', 2], ['思考喵', 'arc', 4], ['茶花会', 'arc', 1]], 'NTE S-grade weapon cards represent Arcs');

for (const slug of Object.keys(fixtures)) {
  const parse = slug === 'zzz' ? parseZzzOperation : parseGenericGameOperation;
  const raw = fixtures[slug];
  const row = parse(`pxb7/${slug}-detail`, raw)[0];
  assert.equal(row.status.sourceStatus, 'success');
  const incomplete = parse(`pxb7/${slug}-detail`, {
    ...raw, primaryText: '主体商品加载不完整\n充值包赔 ￥2000', primaryTitleText: '',
    text: raw.primaryText, agentCards: [], wEngineCards: [], titleNodes: [], assetCards: [],
  })[0];
  assert.equal(incomplete.priceCny, null, 'insurance amount and unrelated full-page text cannot supply target price');
  assert.equal(incomplete.status.sourceStatus, 'partial');
  const titleOnly = parse(`pxb7/${slug}-detail`, { ...raw, agentCards: [], wEngineCards: [], titleNodes: [], assetCards: [] })[0];
  assert.equal(titleOnly.status.sourceStatus, 'success', 'explicit title asset lists remain usable when report cards are absent');
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pxb7-game-validation-'));
try {
  for (const slug of Object.keys(fixtures)) {
    const raw = fixtures[slug];
    const fixturePath = path.join(temporaryRoot, `${slug}.json`);
    const invoke = (pageTitle, source = raw) => {
      fs.writeFileSync(fixturePath, JSON.stringify({ page: { url: raw.url, title: pageTitle }, semantic: '商品详情', raw: source }));
      const result = spawnSync(process.execPath, [path.join(dirname, 'run-ego-operation.mjs'), '--operation', `pxb7/${slug}-detail`, '--input', raw.url, '--raw-fixture', fixturePath, '--json'], { encoding: 'utf8' });
      return { code: result.status, report: JSON.parse(result.stdout) };
    };
    assert.equal(invoke(raw.title).code, 0, `${slug} detail must pass the actual operation CLI`);
    const wrongGame = invoke('其他游戏账号交易');
    assert.equal(wrongGame.code, 1);
    assert.ok(wrongGame.report.reasons.includes('page_game_mismatch'), 'game names elsewhere in the page cannot override the page identity');
    const wrongId = invoke(raw.title, { ...raw, url: 'https://www.pxb7.com/product/9000000000000000099/1' });
    assert.equal(wrongId.code, 1);
    assert.ok(wrongId.report.reasons.includes('listing_id_mismatch'));
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
console.log('PXB7 three-game list, detail, asset boundaries and CLI regressions passed');
