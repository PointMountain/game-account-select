#!/usr/bin/env node
import { runListingEvaluator } from '../../game-account-toolkit/scripts/evaluate-listings.mjs';
import { scoreListing } from './validate-sample.mjs';

process.exitCode = runListingEvaluator({
  game: 'wuthering-waves',
  scoreKey: 'wuthering_waves_score',
  scoreListing,
});
