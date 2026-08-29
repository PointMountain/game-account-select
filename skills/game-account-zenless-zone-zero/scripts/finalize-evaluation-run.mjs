#!/usr/bin/env node
import { finalizeGameEvaluation } from '../../game-account-toolkit/scripts/finalize-game-evaluation.mjs';

process.exitCode = finalizeGameEvaluation({
  gameLabel: '绝区零',
  scoreKey: 'zenless_zone_zero_score',
  targetSkill: 'skills/game-account-zenless-zone-zero',
});
