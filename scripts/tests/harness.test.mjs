import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextFor, dependencyClosure, gateCommands } from '../lib/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('game changes route to local contract gates; shared and unknown changes broaden verification', () => {
  const game = contextFor(root, ['skills/game-account-arknights/scripts/score-listings.mjs']);
  assert.deepEqual(game.gates, ['verify:harness', 'skill:game-account-arknights']);
  assert.ok(game.read.includes('skills/game-account-arknights/references/valuation-rules.md'));
  assert.equal(game.live_required, false);
  const shared = contextFor(root, ['skills/game-account-toolkit/scripts/finalize-game-evaluation.mjs']);
  assert.ok(shared.gates.includes('verify:skills'));
  assert.ok(contextFor(root, ['new-root-code.mjs']).gates.includes('verify:skills'));
});
test('operation and query changes require explicit live evidence', () => {
  for (const file of ['skills/game-account-toolkit/ego-operations/browser-scripts.mjs', 'skills/game-account-toolkit/references/operation-support-matrix.json', 'skills/game-account-arknights/scripts/run-dual-platform-selection.mjs']) {
    assert.equal(contextFor(root, [file]).live_required, true, file);
  }
});
test('dependency closure tolerates mutual quality dependencies and includes their transitive requirements', () => {
  const config = { required: { a: ['b'], b: ['a', 'c'], c: [] }, game_required: ['a'] };
  assert.deepEqual(dependencyClosure(['game'], config), ['a', 'b', 'c', 'game']);
});
test('gate selection never executes artifact-supplied commands or escaped paths', () => {
  assert.throws(() => contextFor(root, ['../other']), /relative/);
  assert.throws(() => gateCommands('skill:foo; touch /tmp/file'), /Unknown gate/);
  assert.deepEqual(gateCommands('verify:skills'), [['npm', ['run', 'verify:skills']]]);
});
