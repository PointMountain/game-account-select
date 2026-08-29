#!/usr/bin/env node
import { finalizeGameEvaluation } from '../../game-account-toolkit/scripts/finalize-game-evaluation.mjs';

process.exitCode = finalizeGameEvaluation({
  gameLabel: '鸣潮',
  scoreKey: 'wuthering_waves_score',
  targetSkill: 'skills/game-account-wuthering-waves',
});
