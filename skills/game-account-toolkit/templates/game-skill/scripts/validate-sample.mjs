#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', '{{slug}}-validation-sample.json'), 'utf8'));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const namedAssets = assets.named_core_assets ?? [];
  const resources = assets.resources ?? {};
  const risk = assets.risk ?? {};
  const missingFields = [];
  const concerns = [];
  const highlights = [];

  let assetScore = 0;
  if (namedAssets.length) {
    assetScore = clamp(namedAssets.length * 9, 0, 35);
    highlights.push('Named core assets are disclosed');
  } else {
    assetScore = Math.min(Number(assets.count_claim ?? 0), 3);
    concerns.push('Rare asset count is claimed without names');
    missingFields.push('named core assets');
  }

  const premiumCurrency = Number(resources.premium_currency ?? 0);
  const pullTickets = Number(resources.pull_tickets ?? 0);
  let resourceScore = 0;
  if (premiumCurrency || pullTickets) {
    resourceScore = clamp(Math.floor(premiumCurrency / 4000) + Math.floor(pullTickets / 10), 1, 15);
    highlights.push('Pull resources are disclosed');
  } else {
    missingFields.push('premium currency / pull tickets');
  }

  let riskPenalty = 0;
  if (risk.binding === 'unknown') {
    riskPenalty += 12;
    missingFields.push('binding status');
  } else if (risk.binding === 'bound') {
    riskPenalty += 20;
    concerns.push('Account binding raises retrieval risk');
  }
  if (risk.guarantee === 'unknown' || risk.guarantee === 'none') {
    riskPenalty += risk.guarantee === 'none' ? 10 : 8;
    missingFields.push('retrieval compensation');
  }
  if (!risk.official_verification) {
    riskPenalty += 8;
    missingFields.push('official verification');
  }

  const missingPenalty = missingFields.includes('named core assets') ? 18 : missingFields.length * 3;
  const finalScore = clamp(assetScore + resourceScore + 10 - riskPenalty - missingPenalty, 0, 100);
  const communityComparison = namedAssets.length
    ? riskPenalty >= 20 ? 'asset-positive but risk-conflicted' : 'strong alignment'
    : 'conflicts with community valuation';

  return {
    id: listing.id,
    final_score: finalScore,
    confidence: missingPenalty >= 15 || riskPenalty >= 20 ? 'low' : 'high',
    community_comparison: communityComparison,
    missing_fields: [...new Set(missingFields)],
    highlights,
    concerns
  };
}

const results = fixture.listings.map(scoreListing).sort((a, b) => b.final_score - a.final_score);
for (const [index, result] of results.entries()) {
  console.log(`${index + 1}. ${result.id} (${result.final_score}) - ${result.community_comparison}`);
}

if (results[0]?.id !== fixture.expected_top_id) {
  throw new Error(`Expected ${fixture.expected_top_id}, got ${results[0]?.id ?? 'none'}`);
}

console.log(`Validation passed: ${fixture.expected_top_id} outranks count-only accounts.`);
