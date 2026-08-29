#!/usr/bin/env node
import { runListingEvaluator } from '../../game-account-toolkit/scripts/evaluate-listings.mjs';
import { scoreListing } from './validate-sample.mjs';

process.exitCode = runListingEvaluator({
  game: 'zenless-zone-zero',
  scoreKey: 'zenless_zone_zero_score',
  scoreListing,
});
