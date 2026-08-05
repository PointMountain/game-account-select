#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  parseTitleAgent,
  parseTitleSnapshot,
} from '../opencli-adapters/games/zenless-zone-zero/clis/pxb7/zzz-detail-title-parser.js';

const primaryTitleText = '【JJBOL4373】女主，S级代理人：满命雅，满命叶瞬光，满命蕾米埃尔，2命仪玄，2命维琳娜；S级音擎：精5嵌合编译器，精1霰落星殿，精1青溟笼舍；详情看图【国际服】【字母Q邮箱】【自主截图】';

assert.deepEqual(parseTitleAgent('满命雅'), { name: '星见雅', dupes: 6, raw: '满命雅' });
assert.deepEqual(parseTitleAgent('2命仪玄'), { name: '仪玄', dupes: 2, raw: '2命仪玄' });

const row = parseTitleSnapshot(primaryTitleText);

assert.equal(row.listingId, 'JJBOL4373');
assert.deepEqual(row.agentStatuses, {
  星见雅: '6',
  叶瞬光: '6',
  蕾米埃尔: '6',
  仪玄: '2',
  维琳娜: '2',
});
assert.deepEqual(row.sWEngineNames, ['嵌合编译器', '霰落星殿', '青溟笼舍']);

console.log(JSON.stringify({
  ok: true,
  listing_id: row.listingId,
  agent_statuses: row.agentStatuses,
  s_w_engine_names: row.sWEngineNames,
  full_mindscape_normalized: true,
}, null, 2));
