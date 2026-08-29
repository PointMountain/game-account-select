#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGameFinalizer } from '../../game-account-toolkit/scripts/validate-game-finalizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
validateGameFinalizer({
  finalizerPath: path.join(__dirname, 'finalize-evaluation-run.mjs'),
  fixturePath: path.join(__dirname, '..', 'test-fixtures', 'wuthering-waves-run-artifact.json'),
  expectedTargetSkill: 'skills/game-account-wuthering-waves',
});
console.log('Wuthering Waves finalizer validation passed');
