#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolkitRoot = path.resolve(__dirname, '..');
const matrix = JSON.parse(fs.readFileSync(path.join(toolkitRoot, 'references', 'operation-support-matrix.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(toolkitRoot, 'ego-operations', 'manifest.json'), 'utf8'));

assert.equal(matrix.query_governance, 'ego_ops');
assert.equal(matrix.executor, 'ego_browser');
assert.equal(matrix.unsupported_behavior, 'fail_closed');
assert.equal(manifest.query_governance, 'ego_ops');
assert.equal(manifest.executor, 'ego_browser');

const requiredGames = ['arknights', 'zenless-zone-zero', 'wuthering-waves', 'neverness-to-everness'];
const requiredPlatforms = ['pxb7', 'pzds'];
const requiredModes = ['list', 'detail'];
const matrixOperations = new Set();
const manifestById = new Map((manifest.operations ?? []).map((operation) => [operation.id, operation]));

function assertVerifiedCellMatches(game, platform, mode, capability) {
  const operation = manifestById.get(capability.operation);
  assert.ok(operation, `verified capability names an unknown operation: ${game}/${platform}/${mode}`);
  assert.equal(operation.game, game, `manifest game mismatch for ${game}/${platform}/${mode}`);
  assert.equal(operation.site, platform, `manifest site mismatch for ${game}/${platform}/${mode}`);
  assert.equal(operation.mode, mode, `manifest mode mismatch for ${game}/${platform}/${mode}`);
}

for (const game of requiredGames) {
  assert.ok(matrix.games?.[game], `support matrix missing game: ${game}`);
  for (const platform of requiredPlatforms) {
    assert.ok(matrix.games[game]?.[platform], `support matrix missing ${game}/${platform}`);
    for (const mode of requiredModes) {
      const capability = matrix.games[game][platform][mode];
      assert.ok(capability, `support matrix missing ${game}/${platform}/${mode}`);
      assert.ok(['verified', 'unsupported'].includes(capability.status), `invalid status for ${game}/${platform}/${mode}`);
      if (capability.status === 'verified') {
        assert.ok(capability.operation, `verified capability lacks operation: ${game}/${platform}/${mode}`);
        assertVerifiedCellMatches(game, platform, mode, capability);
        matrixOperations.add(capability.operation);
      } else {
        assert.equal(capability.operation, null, `unsupported capability must not name an operation: ${game}/${platform}/${mode}`);
      }
    }
  }
}

const nonGameOperations = new Set(matrix.non_game_operations ?? []);
const explorationOnlyOperations = new Set(matrix.exploration_only_operations ?? []);
const manifestOperations = new Set((manifest.operations ?? []).map((operation) => operation.id));
const manifestVerifiedOperations = new Set((manifest.operations ?? [])
  .filter((operation) => operation.availability === 'verified')
  .map((operation) => operation.id));
const manifestExplorationOperations = new Set((manifest.operations ?? [])
  .filter((operation) => operation.availability === 'exploration_only')
  .map((operation) => operation.id));
const manifestGenericOperations = new Set((manifest.operations ?? [])
  .filter((operation) => operation.availability === 'generic_readonly')
  .map((operation) => operation.id));
assert.deepEqual([...matrixOperations].sort(), [...manifestVerifiedOperations].sort(), 'verified matrix capabilities must match verified manifest operations');
assert.deepEqual([...explorationOnlyOperations].sort(), [...manifestExplorationOperations].sort(), 'exploration-only operations must match the manifest');
assert.deepEqual([...nonGameOperations].sort(), [...manifestGenericOperations].sort(), 'non-game operations must match the manifest');
const declaredOperations = new Set([...matrixOperations, ...explorationOnlyOperations, ...nonGameOperations]);
assert.deepEqual([...declaredOperations].sort(), [...manifestOperations].sort(), 'support matrix and ego operation manifest must match exactly');

for (const operation of manifest.operations ?? []) {
  if (nonGameOperations.has(operation.id)) continue;
  assert.ok(requiredGames.includes(operation.game), `manifest game is not declared in the support matrix: ${operation.id}`);
  const mode = operation.id.endsWith('-list') ? 'list' : operation.id.endsWith('-detail') ? 'detail' : null;
  assert.equal(operation.mode, mode, `manifest mode mismatch: ${operation.id}`);
  assert.ok(['verified', 'exploration_only'].includes(operation.availability), `invalid game operation availability: ${operation.id}`);
  if (operation.availability === 'verified') assert.ok(matrixOperations.has(operation.id), `verified manifest operation is not published in the support matrix: ${operation.id}`);
  if (operation.availability === 'exploration_only') assert.ok(explorationOnlyOperations.has(operation.id), `exploration-only operation is not declared: ${operation.id}`);
}

assert.throws(
  () => assertVerifiedCellMatches('arknights', 'pxb7', 'list', { operation: 'pzds/arknights-list' }),
  /manifest site mismatch/,
  'swapping operations between platform cells must fail validation',
);
assert.throws(
  () => assertVerifiedCellMatches('arknights', 'pxb7', 'list', { operation: 'pxb7/arknights-detail' }),
  /manifest mode mismatch/,
  'swapping list/detail operations inside one platform must fail validation',
);

console.log(`operation support matrix validated: ${matrixOperations.size} verified game operations, ${explorationOnlyOperations.size} exploration-only operations, ${nonGameOperations.size} non-game operations`);
