#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseArknightsOperation } from '../ego-operations/arknights-parsers.mjs';
import { buildBrowserScript } from '../ego-operations/browser-scripts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(__dirname, 'run-ego-operation.mjs');

const parsedList = parseArknightsOperation('pxb7/arknights-list', {
  rows: [{
    productId: '123',
    price: 30000,
    guarantee: 1,
    attrNameList: ['官方账号'],
    showTitle: '75级，14六星；六星干员：闪灵，早露；合成玉数量：16185；源石数量：0；联动干员：；时装：',
  }],
}, { limit: 5 });

assert.deepEqual(parsedList[0].operatorNames, ['闪灵', '早露'], 'resource fields must not leak into operator names');

const recommendationIsolated = parseArknightsOperation('pxb7/arknights-detail', {
  url: 'https://www.pxb7.com/product/777/1',
  primaryText: '明日方舟 商品详情 主体字段加载不完整',
  text: '明日方舟 商品详情 主体字段加载不完整\n商品推荐\n￥999；六星干员：维什戴尔；时装：典藏',
  images: [],
}, {});
assert.equal(recommendationIsolated[0].priceCny, null, 'recommended products must not supply the target listing price');
assert.deepEqual(recommendationIsolated[0].operatorNames, [], 'recommended products must not supply target listing operators');
assert.equal(recommendationIsolated[0].status.sourceStatus, 'partial', 'incomplete target details must remain partial');

const parsedPzdsList = parseArknightsOperation('pzds/arknights-list', {
  rows: [{
    goodsNo: 'MRTEST1',
    price: 1888,
    simpleMessage: '官服',
    title: '80级，六星20，限定六星8，精二15，合成玉30000，源石50，时装12(动态2)',
    onStandTime: '2026-08-30 10:00:00',
  }],
  paginationPartial: false,
  loadedRowCount: 1,
  matchingRowCount: 1,
}, { limit: 5 });
assert.equal(parsedPzdsList[0].listingId, 'MRTEST1');
assert.equal(parsedPzdsList[0].priceCny, 1888);
assert.equal(parsedPzdsList[0].url, 'https://www.pzds.com/goodsDetails/MRTEST1/6');
assert.equal(parsedPzdsList[0].status.sourceStatus, 'success');

const pzdsDetailRaw = {
  url: 'https://www.pzds.com/goodsDetails/MRTEST1/6',
  details: {
    goodsNo: 'MRTEST1',
    price: 1888,
    simpleMessage: '官服',
    title: '明日方舟账号，六星20，限定六星8，时装12(动态2)',
    description: '【等级】80【六星干员数量】20【限定六星干员数量】8【精二六星数量】15【合成玉】30000【源石】50',
    compensation: true,
    shotTypeName: '官方',
  },
  assets: [{ name: '维什戴尔', code: 'MR1001', cornerMark: '精二', url: 'https://example.invalid/wisadel.png' }],
  domAssets: [],
  assetTabState: { activated: true, resourceCount: 1, domCardCount: 0 },
};
const parsedPzdsDetail = parseArknightsOperation('pzds/arknights-detail', pzdsDetailRaw, {});
assert.equal(parsedPzdsDetail[0].listingId, 'MRTEST1');
assert.equal(parsedPzdsDetail[0].priceCny, 1888);
assert.deepEqual(parsedPzdsDetail[0].operatorNames, ['维什戴尔']);
assert.equal(parsedPzdsDetail[0].status.sourceStatus, 'success');

for (const operation of [
  'pxb7/arknights-list',
  'pxb7/arknights-detail',
  'pzds/arknights-list',
  'pzds/arknights-detail',
  'pxb7/zzz-detail',
  'pzds/zzz-detail',
  'generic/semantic-search',
]) {
  const script = buildBrowserScript(operation, { limit: 5, page: 1 });
  assert.doesNotThrow(() => new Function(`return ${script};`), `${operation} browser script must parse`);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ego-operation-validation-'));
const fixturePath = path.join(temporaryRoot, 'mismatched-detail.json');
const egoOpsRoot = path.join(temporaryRoot, 'ego-ops');
const siteRoot = path.join(egoOpsRoot, 'references', 'sites');
const pxb7Root = path.join(siteRoot, 'pxb7');
const pzdsRoot = path.join(siteRoot, 'pzds');
const pxb7OperationRoot = path.join(pxb7Root, 'operations');
const pzdsOperationRoot = path.join(pzdsRoot, 'operations');
fs.mkdirSync(pxb7OperationRoot, { recursive: true });
fs.mkdirSync(pzdsOperationRoot, { recursive: true });
fs.writeFileSync(path.join(egoOpsRoot, 'SKILL.md'), '# Deterministic ego-ops fixture\n');
fs.writeFileSync(path.join(siteRoot, 'index.md'), '# Sites\n\n- [pxb7](pxb7/index.md)\n- [pzds](pzds/index.md)\n');
fs.writeFileSync(path.join(pxb7Root, 'index.md'), '# PXB7\n\n- [arknights-list](operations/arknights-list.md)\n- [arknights-detail](operations/arknights-detail.md)\n');
fs.writeFileSync(path.join(pzdsRoot, 'index.md'), '# PZDS\n\n- [arknights-list](operations/arknights-list.md)\n- [arknights-detail](operations/arknights-detail.md)\n');
for (const [root, site] of [[pxb7OperationRoot, 'pxb7'], [pzdsOperationRoot, 'pzds']]) {
  for (const mode of ['list', 'detail']) {
    fs.writeFileSync(path.join(root, `arknights-${mode}.md`), [
      '---',
      `site: ${site}`,
      `operation: arknights-${mode}`,
      '---',
      '',
      '## 检查点',
      '',
      '- 页面域名和游戏身份匹配',
      '- 商品编号和主体字段可读',
      '',
      '## 成功标准',
      '',
      '返回匹配商品编号、价格和来源链接。',
      '',
    ].join('\n'));
  }
}
const spawnOptions = {
  encoding: 'utf8',
  env: { ...process.env, GAME_ACCOUNT_EGO_OPS_DIR: egoOpsRoot },
};
fs.writeFileSync(fixturePath, JSON.stringify({
  page: { url: 'https://www.pxb7.com/product/123/1', title: '明日方舟 商品详情' },
  semantic: '明日方舟 商品详情',
  raw: {
    url: 'https://www.pxb7.com/product/999/1',
    text: '￥300；六星干员：闪灵；联动干员：；时装：',
    images: [],
  },
}));

try {
  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/buy/10053/1', title: '明日方舟账号列表' },
    semantic: '明日方舟账号列表',
    raw: {
      rows: [{ productId: '123', price: 30000, guarantee: 1, attrNameList: ['官方账号'], showTitle: '75级，14六星；六星干员：闪灵，早露；合成玉数量：16185；源石数量：0；联动干员：；时装：' }],
    },
  }));
  const pxb7List = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-list',
    '--raw-fixture', fixturePath,
    '--limit', '5',
    '--json',
  ], spawnOptions);
  assert.equal(pxb7List.status, 0, pxb7List.stderr || 'PXB7 list fixture must pass');
  const pxb7ListReport = JSON.parse(pxb7List.stdout);
  assert.equal(pxb7ListReport.data[0].listingId, '123');
  assert.equal(pxb7ListReport.data[0].priceCny, 300);
  assert.equal(pxb7ListReport.ego_ops.knowledge_status, 'verified_operation_available');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/product/123/1', title: '明日方舟 商品详情' },
    semantic: '明日方舟 商品详情',
    raw: {
      url: 'https://www.pxb7.com/product/999/1',
      text: '￥300；六星干员：闪灵；联动干员：；时装：',
      images: [],
    },
  }));
  const mismatch = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-detail',
    '--input', 'https://www.pxb7.com/product/123/1',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(mismatch.status, 1, 'detail operation must reject a different parsed listing id');
  const report = JSON.parse(mismatch.stdout);
  assert.ok(report.reasons.includes('listing_id_mismatch'), 'detail mismatch reason must be explicit');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/product/777/1', title: '明日方舟 商品详情' },
    semantic: '明日方舟 商品详情',
    raw: {
      url: 'https://www.pxb7.com/product/777/1',
      primaryText: '明日方舟 商品详情 主体字段加载不完整',
      text: '明日方舟 商品详情 主体字段加载不完整\n商品推荐\n￥999；六星干员：维什戴尔；时装：典藏',
      images: [],
    },
  }));
  const recommendationLeak = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-detail',
    '--input', 'https://www.pxb7.com/product/777/1',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(recommendationLeak.status, 1, 'recommendation-only detail must fail closed');
  const recommendationLeakReport = JSON.parse(recommendationLeak.stdout);
  assert.ok(recommendationLeakReport.reasons.includes('detail_source_partial'));

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/product/999/1', title: '其它游戏 商品详情' },
    semantic: '其它游戏 商品详情',
    raw: {
      url: 'https://www.pxb7.com/product/999/1',
      text: '￥300；六星角色：示例；商品详情',
      images: [],
    },
  }));
  const wrongGame = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-detail',
    '--input', 'https://www.pxb7.com/product/999/1',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(wrongGame.status, 1, 'same-domain detail from another game must fail page identity');
  const wrongGameReport = JSON.parse(wrongGame.stdout);
  assert.ok(wrongGameReport.reasons.includes('expected_page_signal_missing'), 'wrong-game identity reason must be explicit');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/product/999/1', title: '明日方舟 商品详情' },
    semantic: '明日方舟 商品详情 滑块验证',
    raw: {
      url: 'https://www.pxb7.com/product/999/1',
      text: '明日方舟 商品详情 滑块验证；￥300；六星干员：闪灵；联动干员：；时装：',
      images: [],
    },
  }));
  const blockerWithExpectedSignals = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-detail',
    '--input', 'https://www.pxb7.com/product/999/1',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(blockerWithExpectedSignals.status, 1, 'verification overlays must fail even when stale expected page signals remain visible');
  const blockerReport = JSON.parse(blockerWithExpectedSignals.stdout);
  assert.ok(blockerReport.reasons.includes('verification_or_blocker_detected'), 'verification blocker reason must be explicit');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pxb7.com/product/999/1', title: '明日方舟 商品详情' },
    semantic: '明日方舟 商品详情',
    raw: {
      url: 'https://www.pxb7.com/product/999/1',
      text: '￥300；六星干员：闪灵；联动干员：；时装：',
      images: [],
    },
  }));
  const verified = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/arknights-detail',
    '--input', 'https://www.pxb7.com/product/999/1',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(verified.status, 0, 'matching detail fixture should pass');
  const verifiedReport = JSON.parse(verified.stdout);
  assert.equal(verifiedReport.ego_ops.knowledge_status, 'verified_operation_available');
  assert.equal(verifiedReport.ego_ops.progressive_read.length, 3, 'runner must progressively read global index, site index, and one operation');
  assert.ok(verifiedReport.ego_ops.knowledge_sha256, 'runner must digest the consumed operation knowledge');
  assert.equal(verifiedReport.task_card.knowledge_checkpoints.length, 2, 'all ego-ops checkpoints must enter the task card');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pzds.com/goodsList/84/6/headerSearch', title: '明日方舟账号列表 - 盼之' },
    semantic: '明日方舟账号列表',
    raw: {
      rows: [{ goodsNo: 'MRTEST1', price: 1888, simpleMessage: '官服', title: '80级，六星20，限定六星8，精二15，合成玉30000，源石50，时装12(动态2)' }],
      paginationPartial: false,
      loadedRowCount: 1,
      matchingRowCount: 1,
    },
  }));
  const pzdsList = spawnSync(process.execPath, [
    runner,
    '--operation', 'pzds/arknights-list',
    '--raw-fixture', fixturePath,
    '--limit', '5',
    '--json',
  ], spawnOptions);
  assert.equal(pzdsList.status, 0, pzdsList.stderr || 'PZDS list fixture must pass');
  const pzdsListReport = JSON.parse(pzdsList.stdout);
  assert.equal(pzdsListReport.data[0].listingId, 'MRTEST1');
  assert.equal(pzdsListReport.data[0].url, 'https://www.pzds.com/goodsDetails/MRTEST1/6');
  assert.equal(pzdsListReport.ego_ops.knowledge_status, 'verified_operation_available');

  fs.writeFileSync(fixturePath, JSON.stringify({
    page: { url: 'https://www.pzds.com/goodsDetails/MRTEST1/6', title: '明日方舟账号详情 - 盼之' },
    semantic: '明日方舟 账号详情',
    raw: pzdsDetailRaw,
  }));
  const pzdsDetail = spawnSync(process.execPath, [
    runner,
    '--operation', 'pzds/arknights-detail',
    '--input', 'https://www.pzds.com/goodsDetails/MRTEST1/6',
    '--raw-fixture', fixturePath,
    '--json',
  ], spawnOptions);
  assert.equal(pzdsDetail.status, 0, pzdsDetail.stderr || 'PZDS detail fixture must pass');
  const pzdsDetailReport = JSON.parse(pzdsDetail.stdout);
  assert.equal(pzdsDetailReport.data[0].listingId, 'MRTEST1');
  assert.deepEqual(pzdsDetailReport.data[0].operatorNames, ['维什戴尔']);
  assert.equal(pzdsDetailReport.ego_ops.knowledge_status, 'verified_operation_available');

  const explorationBlocked = spawnSync(process.execPath, [
    runner,
    '--operation', 'pxb7/zzz-detail',
    '--input', 'https://www.pxb7.com/product/123/1',
    '--json',
  ], spawnOptions);
  assert.equal(explorationBlocked.status, 1, 'an exploration-only operation must fail closed by default');
  const explorationReport = JSON.parse(explorationBlocked.stdout);
  assert.ok(explorationReport.reasons.includes('ego_ops_operation_not_verified'), 'unverified operation reason must be explicit');
  assert.equal(explorationReport.execution.command, 'ego-browser not started', 'fail-closed validation must not open ego-browser');
  assert.equal(explorationReport.completion, null, 'fail-closed validation must not start a cleanup browser process');
  assert.equal(explorationReport.ego_ops.manifest_availability, 'exploration_only');
  assert.equal(explorationReport.ego_ops.exploration_authorized, false);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('ego operation parser and object-identity validation passed');
