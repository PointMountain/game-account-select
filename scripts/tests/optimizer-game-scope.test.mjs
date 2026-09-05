import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('team-specific character heuristics only apply to their game', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'optimizer-game-scope-'));
  const analyze = (game, skill, response) => {
    const input = path.join(temporary, 'run.json');
    fs.writeFileSync(input, JSON.stringify({ game, target_skill: `skills/${skill}`, user_request: '账号筛选', final_response: response }));
    const result = spawnSync(process.execPath, [path.join(root, 'skills/game-account-skill-optimizer/scripts/analyze-run.mjs'), '--input', input, '--json'], { encoding: 'utf8' });
    return JSON.parse(result.stdout).findings.map((finding) => finding.id);
  };
  try {
    assert.ok(!analyze('Arknights', 'game-account-arknights', '雷狼龙S空爆与虎狼丸未确认，需要补齐联动名单。').includes('valuation-independent-team-completeness'));
    assert.ok(analyze('绝区零', 'game-account-zenless-zone-zero', '三队共享辅助，无法确认三支独立队伍完整。').includes('valuation-independent-team-completeness'));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
