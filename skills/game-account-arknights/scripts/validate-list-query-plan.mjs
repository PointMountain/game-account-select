#!/usr/bin/env node
import assert from 'node:assert/strict';

import { buildListQueryPlan } from './list-query-plan.mjs';

const pxb7Plan = buildListQueryPlan({
  platform: 'pxb7',
  limit: 20,
  batchCount: 3,
  displayCount: 5,
  detailCount: 10,
});
assert.deepEqual(pxb7Plan.map(({ page, limit }) => ({ page, limit })), [
  { page: 1, limit: 20 },
  { page: 2, limit: 20 },
  { page: 3, limit: 20 },
]);
assert.ok(pxb7Plan.every((item) => item.strategy === 'paged_requests'));

const pzdsPlan = buildListQueryPlan({
  platform: 'pzds',
  limit: 20,
  batchCount: 3,
  displayCount: 5,
  detailCount: 10,
});
assert.equal(pzdsPlan.length, 1, 'PZDS batches must share one browser scan instead of restarting the page per batch');
assert.deepEqual(pzdsPlan[0], {
  page: 1,
  limit: 30,
  logical_batch_count: 3,
  strategy: 'single_accumulating_scan',
});

const boundedPzdsPlan = buildListQueryPlan({
  platform: 'pzds',
  limit: 60,
  batchCount: 3,
  displayCount: 15,
  detailCount: 20,
});
assert.equal(boundedPzdsPlan[0].limit, 60, 'PZDS accumulated scan must respect the adapter maximum');

console.log('Validation passed: PZDS uses one accumulating scan while PXB7 keeps cheap paged requests.');
