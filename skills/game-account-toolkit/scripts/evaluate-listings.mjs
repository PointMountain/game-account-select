#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { assessGameRecommendation, gameEvidenceConfig } from './game-evidence.mjs';

function readArg(args, name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

export function normalizeListing(listing) {
  return {
    id: listing.id ?? listing.listing_id ?? null,
    platform: listing.platform ?? listing.source ?? null,
    url: listing.url ?? listing.href ?? null,
    price: listing.price ?? null,
    currency: listing.currency ?? 'CNY',
    server: listing.server ?? null,
    region: listing.region ?? listing.game_assets?.region ?? null,
    published_at: listing.published_at ?? null,
    listed_at_raw: listing.listed_at_raw ?? null,
    platform_verified_at: listing.platform_verified_at ?? null,
  };
}

function numericScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function splitDimensions(components = {}) {
  const baseDimensions = {};
  let inferredAssetQuality = 0;
  let inferredResourceScore = 0;
  let inferredProfileScore = 0;
  for (const [key, value] of Object.entries(components ?? {})) {
    const score = numericScore(value);
    const normalized = key.replaceAll('_', '').toLowerCase();
    if (normalized.includes('riskpenalty') || normalized.includes('missingpenalty')) continue;
    baseDimensions[key] = score;
    inferredProfileScore += score;
    if (normalized.includes('resource')) inferredResourceScore += score;
    if (!normalized.includes('resource') && !normalized.includes('price') && !normalized.includes('fit')) {
      inferredAssetQuality += score;
    }
  }
  return { baseDimensions, inferredAssetQuality, inferredResourceScore, inferredProfileScore };
}

function componentTotal(components, pattern) {
  return Object.entries(components ?? {}).reduce((total, [key, value]) => (
    pattern.test(key.replaceAll('_', '').toLowerCase()) ? total + numericScore(value) : total
  ), 0);
}

export function evaluateListings({ game, scoreKey, scoreListing, inputValue, profile = inputValue?.selection_profile ?? {}, evidence, now }) {
  const listings = Array.isArray(inputValue)
    ? inputValue
    : Array.isArray(inputValue?.listings)
      ? inputValue.listings
      : [inputValue];

  return listings.map((listing) => {
    const result = scoreListing(listing);
    const gate = gameEvidenceConfig[game] ? assessGameRecommendation(game, listing, { profile, evidence, now }) : null;
    const dimensions = splitDimensions(result.components);
    const riskPenalty = result.risk_penalty
      ?? result.components?.riskPenalty
      ?? result.components?.risk_penalty
      ?? 0;
    const missingDataPenalty = result.missing_data_penalty
      ?? result.components?.missingPenalty
      ?? result.components?.missing_penalty
      ?? 0;
    const assetQualityScore = result.asset_quality_score ?? result.asset_score ?? dimensions.inferredAssetQuality;
    return {
      schema_version: '3.0',
      game,
      listing: normalizeListing(listing),
      ...(gate ? {
        source_listing: structuredClone(listing),
        evidence_policy: { version: 1 },
        recommendation_gate: gate,
      } : {}),
      [scoreKey]: {
        ...(gate ? { score_basis: 'historical_baseline', recommendation_gate: gate } : {}),
        base_dimensions: dimensions.baseDimensions,
        profile_score: result.profile_score ?? dimensions.inferredProfileScore,
        asset_quality_score: assetQualityScore,
        asset_score: result.asset_score ?? assetQualityScore,
        resource_score: result.resource_score ?? dimensions.inferredResourceScore,
        team_score: result.team_score ?? componentTotal(result.components, /team/),
        engine_score: result.engine_score ?? componentTotal(result.components, /engine|weapon/),
        progression_score: result.progression_score ?? componentTotal(result.components, /progression|awakening/),
        price_fit_score: result.price_fit_score ?? componentTotal(result.components, /pricefit/),
        risk_penalty: riskPenalty,
        missing_data_penalty: missingDataPenalty,
        confidence_penalty: result.confidence_penalty ?? missingDataPenalty,
        final_score: result.final_score,
        confidence: gate && !gate.eligible ? 'low' : result.confidence,
        community_comparison: gate ? (gate.eligible ? '当前队伍适用证据已核实；分数为历史基线' : '当前适用证据待核实；分数仅供历史初筛') : result.community_comparison,
        highlights: result.highlights ?? [],
        concerns: [...(result.concerns ?? []), ...(gate?.gaps ?? [])],
        missing_fields: [...new Set([...(result.missing_fields ?? []), ...(gate?.gaps ?? [])])],
        rule_update_suggestion: result.rule_update_suggestion ?? null,
      },
    };
  });
}

export function runListingEvaluator({ game, scoreKey, scoreListing, args = process.argv.slice(2) }) {
  const input = readArg(args, '--input');
  if (!input) {
    console.error('Usage: evaluate-listing.mjs --input <listing.json|-> [--out <evaluation.json>]');
    return 2;
  }

  const raw = input === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(input), 'utf8');
  const evidencePath = readArg(args, '--evidence');
  const profilePath = readArg(args, '--profile');
  const evaluations = evaluateListings({ game, scoreKey, scoreListing, inputValue: JSON.parse(raw),
    evidence: evidencePath ? JSON.parse(fs.readFileSync(path.resolve(evidencePath), 'utf8')) : undefined,
    profile: profilePath ? JSON.parse(fs.readFileSync(path.resolve(profilePath), 'utf8')) : undefined,
  });
  const output = evaluations.length === 1 ? evaluations[0] : { evaluations };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  const outputPath = readArg(args, '--out');
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, serialized);
  }
  process.stdout.write(serialized);
  return 0;
}
