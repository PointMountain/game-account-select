import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('query policy scans source while leaving raw run evidence outside the policy scan', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'query-stack-scope-'));
  try {
    fs.cpSync(root, temporary, {
      recursive: true,
      filter: (source) => !['.git', '.harness', 'node_modules'].includes(path.basename(source)),
    });
    const token = ['ji', 'na'].join('');
    fs.mkdirSync(path.join(temporary, '.harness'));
    fs.writeFileSync(path.join(temporary, '.harness', 'evidence.json'), JSON.stringify({ public_image_path: token }));
    const validate = () => spawnSync(process.execPath, [path.join(temporary, 'skills/game-account-toolkit/scripts/validate-query-stack.mjs')], { encoding: 'utf8' });
    const evidenceRun = validate();
    assert.equal(evidenceRun.status, 0, evidenceRun.stderr);
    fs.writeFileSync(path.join(temporary, 'policy-negative.json'), JSON.stringify({ forbidden_transport: token }));
    const sourceRun = validate();
    assert.equal(sourceRun.status, 1);
    assert.match(sourceRun.stderr, /policy-negative\.json: banned content token/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
