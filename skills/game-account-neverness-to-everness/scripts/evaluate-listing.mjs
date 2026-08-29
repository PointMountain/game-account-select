#!/usr/bin/env node
import { runListingEvaluator } from '../../game-account-toolkit/scripts/evaluate-listings.mjs';
import { scoreListing } from './validate-sample.mjs';

process.exitCode = runListingEvaluator({
  game: 'neverness-to-everness',
  scoreKey: 'neverness_to_everness_score',
  scoreListing,
});
