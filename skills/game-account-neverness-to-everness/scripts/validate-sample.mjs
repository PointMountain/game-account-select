#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateListings } from '../../game-account-toolkit/scripts/evaluate-listings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'neverness-validation-sample.json'), 'utf8'));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const characters = assets.s_characters ?? [];
  const arcPlates = assets.s_arc_plates ?? [];
  const resources = assets.resources ?? {};
  const account = assets.account ?? {};
  const highlights = [];
  const concerns = [];
  const missingFields = [];

  let characterScore = 0;
  if (characters.length) {
    for (const character of characters) {
      characterScore += 6 + Math.min(Number(character.awakening ?? 0), 2);
      highlights.push(`${character.name} is a named S character`);
    }
  } else if (assets.s_character_count_claim) {
    characterScore += Math.min(Number(assets.s_character_count_claim), 3);
    concerns.push('S character count is claimed without names');
    missingFields.push('named S characters');
  }
  characterScore = clamp(characterScore, 0, 30);

  let arcScore = 0;
  for (const arc of arcPlates) {
    if (arc.fits && characters.some((character) => character.name === arc.fits)) {
      arcScore += 7;
      highlights.push(`${arc.name} fits ${arc.fits}`);
    } else {
      arcScore += 3;
      concerns.push(`${arc.name} fit is unclear`);
    }
  }
  if (!arcPlates.length) missingFields.push('named S arc plates');
  arcScore = clamp(arcScore, 0, 20);

  const awakeningScore = clamp(characters.reduce((sum, character) => sum + Number(character.awakening ?? 0) * 3, 0), 0, 15);
  if (awakeningScore > 0) highlights.push('Awakening data is disclosed');

  const ringStones = Number(resources.ring_stones ?? 0);
  const crystals = Number(resources.crystals ?? 0);
  const solidDice = Number(resources.solid_dice ?? 0);
  const tripleKeys = Number(resources.triple_keys ?? 0);
  let resourceScore = 0;
  if (ringStones || crystals || solidDice || tripleKeys) {
    resourceScore = clamp(Math.floor(ringStones / 4000) + Math.floor(crystals / 20) + Math.floor(solidDice / 5) + tripleKeys, 1, 15);
    highlights.push('Pull and progression resources are disclosed');
  } else {
    missingFields.push('ring stones / crystals / dice / keys');
  }

  let accountFitScore = 5;
  if (account.account_type === 'official' && account.tap_binding === 'clean') accountFitScore = 10;
  if (account.account_type === 'unknown') {
    accountFitScore = 1;
    missingFields.push('account type');
  }
  if (account.protagonist) highlights.push(`Protagonist is disclosed as ${account.protagonist}`);
  else missingFields.push('protagonist choice');

  const priceFitScore = characterScore >= 20 && arcScore >= 14 ? 8 : characterScore >= 15 ? 5 : 1;

  let riskPenalty = 0;
  if (account.tap_binding === 'bound') {
    riskPenalty += 18;
    concerns.push('TAP binding raises retrieval risk');
  } else if (account.tap_binding === 'unknown') {
    riskPenalty += 12;
    missingFields.push('TAP binding status');
  }
  if (account.account_type === 'perfect' || listing.server !== '官服') {
    riskPenalty += 10;
    concerns.push('Account type or server may not match user preference');
  }
  if (account.guarantee === 'none' || account.guarantee === 'unknown') {
    riskPenalty += account.guarantee === 'none' ? 10 : 8;
    missingFields.push('retrieval compensation');
  }
  if (!account.official_verification) {
    riskPenalty += 8;
    missingFields.push('official verification');
  }

  let missingPenalty = 0;
  if (missingFields.includes('named S characters')) missingPenalty += 12;
  if (missingFields.includes('named S arc plates')) missingPenalty += 10;
  if (missingFields.includes('ring stones / crystals / dice / keys')) missingPenalty += 6;
  if (missingFields.includes('account type')) missingPenalty += 8;

  const rawScore = characterScore + arcScore + awakeningScore + resourceScore + accountFitScore + priceFitScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);
  const hasNamedCoreAssets = characters.length > 0 && arcPlates.length > 0;
  const communityComparison = characterScore >= 20 && arcScore >= 14 && riskPenalty < 8
    ? 'strong alignment'
    : !hasNamedCoreAssets || missingPenalty >= 20
      ? riskPenalty >= 20
        ? 'conflicts with community valuation; also risk-conflicted'
        : 'conflicts with community valuation'
      : riskPenalty >= 20
        ? 'asset-positive but risk-conflicted'
        : 'partial alignment';
  const confidence = missingPenalty >= 18 || riskPenalty >= 25 ? 'low' : missingPenalty >= 8 || riskPenalty >= 10 ? 'medium' : 'high';

  return {
    id: listing.id,
    asset_quality_score: characterScore + arcScore + awakeningScore,
    asset_score: characterScore + arcScore + awakeningScore,
    resource_score: resourceScore,
    progression_score: awakeningScore,
    profile_score: rawScore,
    risk_penalty: riskPenalty,
    missing_data_penalty: missingPenalty,
    confidence_penalty: missingPenalty,
    rule_update_suggestion: missingFields.includes('named S characters') || missingFields.includes('named S arc plates')
      ? 'Collect named asset evidence before changing durable valuation weights.'
      : null,
    final_score: finalScore,
    community_comparison: communityComparison,
    confidence,
    components: { characterScore, arcScore, awakeningScore, resourceScore, accountFitScore, priceFitScore, riskPenalty, missingPenalty },
    missing_fields: [...new Set(missingFields)],
    highlights,
    concerns
  };
}

export function runValidation() {
const results = fixture.listings.map(scoreListing).sort((a, b) => b.final_score - a.final_score);
for (const [index, result] of results.entries()) {
  console.log(`${index + 1}. ${result.id} (${result.final_score}) - ${result.community_comparison}`);
  console.log(`   confidence: ${result.confidence}`);
  console.log(`   components: ${JSON.stringify(result.components)}`);
  console.log(`   missing: ${result.missing_fields.join(', ') || 'none'}`);
}

if (results.some((result) => !result.id || Number.isNaN(result.final_score))) throw new Error('Invalid Neverness validation result');
if (results[0]?.id !== fixture.expected_top_id) throw new Error(`Expected ${fixture.expected_top_id}, got ${results[0]?.id ?? 'none'}`);
const sCountTrap = results.find((result) => result.id === 's-count-trap');
if (!sCountTrap?.community_comparison.includes('conflicts with community valuation')) {
  throw new Error('Expected vague S-count listing to conflict with community valuation');
}
if (sCountTrap.asset_quality_score <= 0 || sCountTrap.asset_quality_score <= sCountTrap.final_score) {
  throw new Error('Expected vague S-count listing to preserve intrinsic asset value independently from penalties');
}
const normalizedTrap = evaluateListings({
  game: 'neverness-to-everness',
  scoreKey: 'neverness_to_everness_score',
  scoreListing,
  inputValue: fixture.listings.find((listing) => listing.id === 's-count-trap'),
})[0].neverness_to_everness_score;
if (Object.keys(normalizedTrap.base_dimensions).some((key) => /risk|missing/i.test(key))) {
  throw new Error('Expected shared evaluator base_dimensions to exclude risk and missing-data penalties');
}
if (normalizedTrap.asset_quality_score <= normalizedTrap.final_score || normalizedTrap.risk_penalty <= 0) {
  throw new Error('Expected shared evaluator to preserve intrinsic asset quality and independent penalties');
}

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks vague S-count accounts.`);
return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runValidation();
