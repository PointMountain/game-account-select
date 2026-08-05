#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cleanupScript = path.join(__dirname, 'cleanup-query-session.mjs');
const baseline = path.join(__dirname, '..', 'test-fixtures', 'browser-targets-baseline.json');
const afterQuery = path.join(__dirname, '..', 'test-fixtures', 'browser-targets-after-query.json');
const afterQueryWindows = path.join(__dirname, '..', 'test-fixtures', 'browser-windows-after-query.json');

function runCleanup(extraArgs) {
  const result = spawnSync(process.execPath, [
    cleanupScript,
    '--session-prefix', '',
    '--process-pattern', 'browser-cleanup-test-never-match',
    '--targets-fixture', afterQuery,
    '--windows-fixture', afterQueryWindows,
    '--dry-run',
    '--json',
    ...extraArgs,
  ], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 4,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const safeDefault = runCleanup([]);
assert.deepEqual(safeDefault.cdp_targets_closed, [], 'default cleanup must not close URL-matching user tabs');

const baselineCleanup = runCleanup(['--baseline', baseline, '--close-new-query-targets']);
assert.deepEqual(
  baselineCleanup.cdp_targets_closed.map((item) => item.targetId).sort(),
  ['RUN-BLANK', 'RUN-PXB7'],
  'baseline cleanup must close only new query pages and OpenCLI blank placeholders',
);
assert.equal(
  baselineCleanup.cdp_targets_closed.some((item) => item.targetId === 'USER-PXB7'),
  false,
  'a platform tab that existed before the run belongs to the user',
);
assert.deepEqual(
  baselineCleanup.chrome_windows_closed.map((item) => item.windowId).sort(),
  ['RUN-BLANK-WINDOW', 'RUN-PZDS-WINDOW'],
  'baseline cleanup must close new automation-only Chrome windows, including the standalone blank popup',
);
assert.equal(
  baselineCleanup.chrome_windows_closed.some((item) => item.windowId === 'USER-WINDOW'),
  false,
  'a Chrome window that existed before the run must be preserved',
);
assert.equal(
  baselineCleanup.chrome_windows_closed.some((item) => item.windowId === 'NEW-MIXED-WINDOW'),
  false,
  'a new mixed window containing an unrelated user tab must be preserved',
);
assert.equal(
  baselineCleanup.cdp_targets_closed.some((item) => item.targetId === 'USER-BLANK'),
  false,
  'a blank tab that existed before the run must be preserved',
);
assert.equal(
  baselineCleanup.cdp_targets_closed.some((item) => item.targetId === 'NEW-UNRELATED'),
  false,
  'a concurrently opened unrelated tab must be preserved',
);

const explicitCleanup = runCleanup(['--target', 'RUN-BLANK']);
assert.deepEqual(
  explicitCleanup.cdp_targets_closed.map((item) => item.targetId),
  ['RUN-BLANK'],
  'explicit target ownership must remain supported',
);

console.log('game-account-toolkit browser cleanup validation passed');
