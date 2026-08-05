#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { scoreListing } from './validate-sample.mjs';

const args = process.argv.slice(2);
function readArg(name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

const input = readArg('--input');
if (!input) {
  console.error('Usage: evaluate-listing.mjs --input <listing.json|-> [--out <evaluation.json>]');
  process.exit(2);
}

const raw = input === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(input), 'utf8');
const parsed = JSON.parse(raw);
const listings = Array.isArray(parsed) ? parsed : Array.isArray(parsed.listings) ? parsed.listings : [parsed];
const evaluations = listings.map((listing) => {
  const score = scoreListing(listing);
  return {
    schema_version: '2.0',
    game: 'zenless-zone-zero',
    listing: {
      id: listing.id ?? listing.listing_id ?? null,
      platform: listing.platform ?? null,
      url: listing.url ?? null,
      price: listing.price ?? null,
      currency: listing.currency ?? 'CNY',
      server: listing.server ?? null,
      region: listing.region ?? listing.game_assets?.region ?? null,
      published_at: listing.published_at ?? null,
      listed_at_raw: listing.listed_at_raw ?? null,
      platform_verified_at: listing.platform_verified_at ?? null,
    },
    zenless_zone_zero_score: {
      asset_score: score.components.agentScore,
      engine_score: score.components.engineScore,
      team_score: score.components.teamScore,
      resource_score: score.components.resourceScore,
      progression_score: score.components.progressionScore,
      price_fit_score: score.components.priceFitScore,
      account_hygiene_score: score.components.accountHygieneScore,
      comfort_score: score.components.comfortScore,
      risk_penalty: score.components.riskPenalty,
      confidence_penalty: score.components.missingPenalty,
      final_score: score.final_score,
      confidence: score.confidence,
      community_comparison: score.community_comparison,
      highlights: score.highlights,
      concerns: score.concerns,
      missing_fields: score.missing_fields,
    },
  };
});

const output = evaluations.length === 1 ? evaluations[0] : { evaluations };
const serialized = `${JSON.stringify(output, null, 2)}\n`;
const outputPath = readArg('--out');
if (outputPath) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serialized);
}
process.stdout.write(serialized);
