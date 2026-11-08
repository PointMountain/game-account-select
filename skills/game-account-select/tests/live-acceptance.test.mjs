import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseZzzOperation } from '../scripts/parsers/zzz-parsers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function runOperation({ body, snapshot }) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'operation-page-evidence-'));
  try {
    const knowledge = path.join(temporary, 'knowledge');
    const site = path.join(knowledge, 'references/sites/pzds');
    fs.mkdirSync(path.join(site, 'operations'), { recursive: true });
    fs.writeFileSync(path.join(knowledge, 'SKILL.md'), 'test operation knowledge');
    fs.writeFileSync(path.join(knowledge, 'references/sites/index.md'), '[pzds](pzds/index.md)');
    fs.writeFileSync(path.join(site, 'index.md'), '[list](operations/wuthering-waves-list.md)');
    fs.writeFileSync(path.join(site, 'operations/wuthering-waves-list.md'), [
      '---', 'site: pzds', 'operation: wuthering-waves-list', 'status: verified', '---',
      '## 检查点', '- 核对鸣潮页面', '## 成功标准', '返回唯一商品与价格。',
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'page.json'), JSON.stringify({ body, snapshot }));
    const binary = path.join(temporary, 'ego-browser');
    fs.writeFileSync(binary, `#!${process.execPath}
import fs from 'node:fs';
import vm from 'node:vm';
const fixture = JSON.parse(fs.readFileSync(process.env.OPERATION_TEST_PAGE, 'utf8'));
const rows = [{ goodsNo: 'MC_TEST_1', price: 600, title: '80级，具名角色，星声156', simpleMessage: '官服' }];
const document = { title: '商品列表 • 盼之账号', body: { innerText: fixture.body },
  querySelector: () => ({ __vue__: { goodsList: rows, hasMore: false } }) };
let tick = 0;
const pageContext = { document, window: { __NUXT__: { data: [{ goodsList: rows }] } },
  Date: { now: () => tick += 5000 }, setTimeout: (resolve) => resolve() };
const page = { goto: async () => {},
  evaluate: async (source, argument) => typeof source === 'function'
    ? vm.runInNewContext('(' + source.toString() + ')(argument)', { ...pageContext, argument })
    : vm.runInNewContext(source, pageContext),
  url: async () => 'https://www.pzds.com/goodsList/303',
  title: async () => document.title, snapshot: async () => fixture.snapshot };
const script = fs.readFileSync(0, 'utf8');
await vm.runInNewContext('(async () => {' + script + '\\n})()', {
  taskSpace: async () => ({ page: () => page, spaceId: 7, name: 'test-space' }), console,
});
`, { mode: 0o755 });
    const run = spawnSync(process.execPath, [
      path.join(root, 'skills/game-account-select/scripts/query.mjs'),
      '--operation', 'pzds/wuthering-waves-list', '--task-space', '7', '--limit', '1',
      '--task-space-disposition', 'keep', '--json',
    ], {
      cwd: root, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PATH: `${temporary}${path.delimiter}${process.env.PATH}`,
        GAME_ACCOUNT_EGO_OPS_DIR: knowledge, OPERATION_TEST_PAGE: path.join(temporary, 'page.json') },
    });
    assert.ok(run.stdout, run.stderr);
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('a game signal beyond the bounded snapshot still validates actual page identity', () => {
  const report = runOperation({ body: `${'导航'.repeat(2500)}鸣潮商品列表`, snapshot: '导航'.repeat(2500) });
  assert.equal(report.ok, true, JSON.stringify(report.reasons));
  assert.equal(report.data[0].listingId, 'MC_TEST_1');
  assert.equal(report.data[0].priceCny, 600);
});

test('a blocker beyond the snapshot is rejected even when valid game rows exist', () => {
  const report = runOperation({ body: `鸣潮${'导航'.repeat(2500)}请完成人机验证`, snapshot: `鸣潮${'导航'.repeat(2500)}` });
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes('verification_or_blocker_detected'));
  assert.equal(report.data, null);
});

test('a wrong game is rejected when rows and URLs otherwise look valid', () => {
  const report = runOperation({ body: '其它游戏商品列表', snapshot: '其它游戏商品列表' });
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes('expected_page_signal_missing'));
});

test('PZDS ZZZ retains number-first encrypted tapes and label-first asset totals', () => {
  const [listing] = parseZzzOperation('pzds/zzz-detail', {
    url: 'https://www.pzds.com/goodsDetails/QLTEST/6', title: '商品详情 • 盼之账号',
    text: '绝区零 账号编号QLTEST\nQLTEST 号 52级，10黄，菲林88，248加密母带，S级代理人5，S级音擎3，S级邦布2\n¥260',
    titleNodes: [{ title: '雨果', text: '0+1' }],
  });
  assert.equal(listing.resources.encryptedMasterTape, 248);
  assert.equal(listing.counts.sAgents, 5);
  assert.equal(listing.counts.sWEngines, 3);
  assert.equal(listing.counts.sBangboo, 2);
});

test('a nearby unrelated count cannot become an encrypted-tape balance', () => {
  const [listing] = parseZzzOperation('pzds/zzz-detail', {
    url: 'https://www.pzds.com/goodsDetails/QLTEST/6', title: '商品详情 • 盼之账号',
    text: '绝区零 账号编号QLTEST\n加密母带未披露，248个S级代理人\n¥260',
    titleNodes: [{ title: '雨果', text: '0+1' }],
  });
  assert.equal(listing.resources.encryptedMasterTape, null);
});

