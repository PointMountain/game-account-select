import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = (script, env) => spawnSync(process.execPath, [path.join(root, 'scripts', script)], { encoding: 'utf8', env: { ...process.env, ...env } });

test('link prunes broken links to removed repo skills, links the current skill, and keeps unrelated entries', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-links-'));
  try {
    fs.symlinkSync(path.join(root, 'skills', 'game-account-toolkit'), path.join(target, 'game-account-toolkit'), 'dir');
    fs.mkdirSync(path.join(target, 'other-skill'));
    fs.symlinkSync(os.tmpdir(), path.join(target, 'external-link'), 'dir');
    const linked = run('link-local-skills.js', { SKILL_LINK_TARGETS: target });
    assert.equal(linked.status, 0, linked.stderr);
    const [report] = JSON.parse(linked.stdout);
    assert.deepEqual(report.pruned_stale, ['game-account-toolkit']);
    assert.deepEqual(report.linked, ['game-account-select']);
    assert.equal(fs.realpathSync(path.join(target, 'game-account-select')), fs.realpathSync(path.join(root, 'skills/game-account-select')));
    assert.ok(fs.existsSync(path.join(target, 'other-skill')));
    assert.ok(fs.lstatSync(path.join(target, 'external-link')).isSymbolicLink());
    const unlinked = JSON.parse(run('unlink-local-skills.js', { SKILL_LINK_TARGETS: target }).stdout);
    assert.deepEqual(unlinked[0].removed, ['game-account-select']);
    assert.ok(fs.existsSync(path.join(target, 'external-link')));
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
