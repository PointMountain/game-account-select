#!/usr/bin/env node
import { finalizeGameEvaluation } from '../../game-account-toolkit/scripts/finalize-game-evaluation.mjs';

process.exitCode = finalizeGameEvaluation({
  gameLabel: '{{game_name}}',
  scoreKey: '{{slug}}_score'.replaceAll('-', '_'),
  targetSkill: 'skills/game-account-{{slug}}',
});
