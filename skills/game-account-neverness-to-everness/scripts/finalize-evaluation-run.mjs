#!/usr/bin/env node
import { finalizeGameEvaluation } from '../../game-account-toolkit/scripts/finalize-game-evaluation.mjs';

process.exitCode = finalizeGameEvaluation({
  gameLabel: '异环',
  scoreKey: 'neverness_to_everness_score',
  targetSkill: 'skills/game-account-neverness-to-everness',
});
