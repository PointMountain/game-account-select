#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cleanupScript = path.join(__dirname, 'cleanup-query-session.mjs');
const fixture = path.join(__dirname, '..', 'test-fixtures', 'ego-task-spaces.json');

function runCleanup(extraArgs) {
  const result = spawnSync(process.execPath, [
    cleanupScript,
    '--process-pattern', 'browser-cleanup-test-never-match',
    '--task-spaces-fixture', fixture,
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
assert.deepEqual(safeDefault.ego_task_spaces_requested, [], 'cleanup without an exact task space must be a no-op');
assert.deepEqual(safeDefault.ego_task_space_closures, []);

const exactCleanup = runCleanup(['--task-space', 'gas-arknights-20260829']);
assert.deepEqual(exactCleanup.ego_task_spaces_requested, ['gas-arknights-20260829']);
assert.equal(exactCleanup.ego_task_space_closures[0].matched.id, 42);
assert.equal(exactCleanup.ego_task_space_closures[0].matched.ownership, 'agent');
assert.equal(
  exactCleanup.ego_task_space_closures.some((item) => item.matched?.id === 7),
  false,
  'an unrelated user-owned task space must not be selected by prefix or URL',
);

const duplicateCleanup = runCleanup(['--task-space', '42', '--task-space', '42']);
assert.deepEqual(duplicateCleanup.ego_task_spaces_requested, ['42'], 'duplicate exact targets should be completed once');
assert.equal(duplicateCleanup.ego_task_space_closures[0].matched.name, 'gas-arknights-20260829');

console.log('game-account-toolkit ego-browser cleanup validation passed');
