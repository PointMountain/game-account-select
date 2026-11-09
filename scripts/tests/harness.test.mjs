import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextFor, gateCommands } from '../lib/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('site and game knowledge changes route to their own index and the knowledge schema', () => {
  const site = contextFor(root, ['skills/game-account-select/references/sites/pzds/operations/zzz-list.md']);
  assert.ok(site.read.includes('skills/game-account-select/references/sites/pzds/index.md'));
  assert.ok(site.read.includes('skills/game-account-select/references/knowledge-schema.md'));
  assert.equal(site.live_required, true);
  const game = contextFor(root, ['skills/game-account-select/references/games/arknights/game.json']);
  assert.ok(game.read.includes('skills/game-account-select/references/games/arknights/index.md'));
  assert.equal(game.live_required, false);
  assert.ok(game.gates.includes('verify:skills'));
});

test('query engine changes require live evidence; docs-only changes stay offline', () => {
  for (const file of ['skills/game-account-select/scripts/query.mjs', 'skills/game-account-select/scripts/parsers/zzz-parsers.mjs', 'skills/game-account-select/references/operations.json']) {
    assert.equal(contextFor(root, [file]).live_required, true, file);
  }
  assert.deepEqual(contextFor(root, ['docs/development/workflow.md']).gates, ['verify:harness']);
});

test('gate selection never executes artifact-supplied commands or escaped paths', () => {
  assert.throws(() => contextFor(root, ['../other']), /relative/);
  assert.throws(() => gateCommands('skill:foo; touch /tmp/file'), /Unknown gate/);
  assert.deepEqual(gateCommands('verify:skills'), [['npm', ['run', 'verify:skills']]]);
});
