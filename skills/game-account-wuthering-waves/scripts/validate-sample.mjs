#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '..', 'test-fixtures', 'wuthering-waves-validation-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const highValue = new Set([
  'Hiyuki',
  'Aemeath',
  'Lynae',
  'Mornye',
  'Augusta',
  'Cartethyia',
  'Shorekeeper',
  'Galbrena',
  'Qiuyuan',
  'Phrolova',
  'Iuno'
]);

const mediumValue = new Set([
  'Zani',
  'Phoebe',
  'Carlotta',
  'Camellya',
  'Changli',
  'Jiyan',
  'Verina',
  'Cantarella',
  'Zhezhi',
  'Yinlin',
  'Jinhsi'
]);

const trapAssets = new Set(['Lingyang', 'Calcharo', 'Jianxin', 'Encore']);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const characters = assets.characters ?? [];
  const weapons = assets.weapons_or_equipment ?? [];
  const currency = assets.premium_currency ?? {};
  const gameSpecific = assets.game_specific ?? {};

  const highlights = [];
  const concerns = [];
  const missingFields = [];
  let limitedCoreScore = 0;
  let mediumAssetScore = 0;
  let trapScore = 0;

  for (const character of characters) {
    const name = character.name;
    const chain = Number(character.resonance_chain ?? 0);

    if (highValue.has(name)) {
      limitedCoreScore += 9 + Math.min(chain, 2) * 2;
      highlights.push(`${name} matches high-value community tier`);
    } else if (mediumValue.has(name)) {
      mediumAssetScore += 5 + Math.min(chain, 1);
      highlights.push(`${name} matches medium-value community tier`);
    } else if (trapAssets.has(name) || character.category === 'standard') {
      trapScore += Math.min(2, 1 + Math.floor(chain / 4));
      concerns.push(`${name} high resonance is treated as low-value standard/trap asset`);
    } else {
      mediumAssetScore += 2;
      concerns.push(`${name} is not covered by the current community snapshot`);
    }
  }

  const limitedScore = clamp(limitedCoreScore + mediumAssetScore + trapScore, 0, 35);

  const highCoreCount = characters.filter((character) => highValue.has(character.name)).length;
  const mediumCount = characters.filter((character) => mediumValue.has(character.name)).length;
  let teamScore = 0;
  if (highCoreCount >= 4) {
    teamScore = 18;
    highlights.push('Multiple high-value cores can anchor current-version teams');
  } else if (highCoreCount >= 2) {
    teamScore = 12;
    highlights.push('Some high-value cores are present, but team completeness needs checking');
  } else if (highCoreCount === 1 || mediumCount >= 3) {
    teamScore = 7;
    concerns.push('Roster has usable assets but lacks a clear current high-value team core');
  } else {
    teamScore = 3;
    concerns.push('Roster mostly relies on raw count or standard-character duplicates');
  }

  let weaponScore = 0;
  for (const weapon of weapons) {
    if (weapon.signature_for && highValue.has(weapon.signature_for)) {
      weaponScore += 6;
      highlights.push(`${weapon.signature_for} has signature weapon`);
    } else if (weapon.signature_for && mediumValue.has(weapon.signature_for)) {
      weaponScore += 3;
      highlights.push(`${weapon.signature_for} has matching 5-star weapon`);
    } else {
      weaponScore += 1;
      concerns.push('Generic 5-star weapon has limited valuation impact without a matched core');
    }
  }
  weaponScore = clamp(weaponScore, 0, 15);

  const astrite = Number(currency.astrite ?? 0);
  const radiantTide = Number(currency.radiant_tide ?? 0);
  const forgingTide = Number(currency.forging_tide ?? 0);
  const afterglowCoral = Number(currency.afterglow_coral ?? 0);
  let resourceScore = 0;
  if (astrite || radiantTide || forgingTide || afterglowCoral) {
    resourceScore = clamp(
      Math.floor(astrite / 2500) + Math.floor((radiantTide + forgingTide) / 10) + Math.floor(afterglowCoral / 120),
      1,
      15
    );
    highlights.push('Pull resources are disclosed and add future banner flexibility');
  } else {
    missingFields.push('premium currency / tides / coral');
  }

  let priceFitScore = 6;
  if (listing.price <= 200 && highCoreCount >= 2) priceFitScore = 10;
  if (listing.price > 240 && highCoreCount >= 4) priceFitScore = 8;
  if (highCoreCount === 0 && listing.price >= 180) priceFitScore = 1;

  let riskPenalty = 0;
  if (gameSpecific.binding === 'tap_bound') {
    riskPenalty += 18;
    concerns.push('TAP binding raises retrieval risk');
  } else if (gameSpecific.binding === 'unknown') {
    riskPenalty += 12;
    missingFields.push('TAP/Wegame/PS5 binding status');
  } else if (gameSpecific.binding === 'clean') {
    highlights.push('Binding status is disclosed as clean');
  }

  if (gameSpecific.guarantee === 'none' || gameSpecific.guarantee === 'unknown') {
    riskPenalty += gameSpecific.guarantee === 'none' ? 10 : 8;
    missingFields.push('retrieval compensation');
  }

  if (!gameSpecific.official_verification) {
    riskPenalty += 8;
    missingFields.push('official verification');
  }

  if (listing.server && listing.server !== '官服') {
    riskPenalty += 8;
    concerns.push(`${listing.server} may not match official-server preference`);
  }

  let missingPenalty = 0;
  if (missingFields.includes('premium currency / tides / coral')) missingPenalty += 6;
  if (weapons.length === 0) {
    missingPenalty += 7;
    missingFields.push('weapon / signature weapon details');
  }
  if (missingFields.includes('TAP/Wegame/PS5 binding status')) missingPenalty += 10;

  const rawScore = limitedScore + teamScore + weaponScore + resourceScore + priceFitScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);

  let communityComparison = 'partial alignment';
  if (highCoreCount >= 4 && weaponScore >= 8 && riskPenalty <= 5) communityComparison = 'strong alignment';
  if (riskPenalty >= 20) communityComparison = 'asset-positive but risk-conflicted';
  if (highCoreCount === 0 || trapScore > limitedCoreScore) {
    communityComparison = riskPenalty >= 20
      ? 'conflicts with community valuation; also risk-conflicted'
      : 'conflicts with community valuation';
  }

  const confidence = missingPenalty >= 15 || riskPenalty >= 25
    ? 'low'
    : missingPenalty >= 8 || riskPenalty >= 10
      ? 'medium'
      : 'high';

  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    final_score: finalScore,
    components: {
      limited_score: limitedScore,
      team_score: teamScore,
      weapon_score: weaponScore,
      resource_score: resourceScore,
      price_fit_score: priceFitScore,
      risk_penalty: riskPenalty,
      missing_penalty: missingPenalty
    },
    confidence,
    community_comparison: communityComparison,
    highlights,
    concerns,
    missing_fields: [...new Set(missingFields)]
  };
}

const results = fixture.listings.map(scoreListing).sort((a, b) => b.final_score - a.final_score);

for (const [index, result] of results.entries()) {
  console.log(`${index + 1}. ${result.id} (${result.final_score}) - ${result.community_comparison}`);
  console.log(`   confidence: ${result.confidence}`);
  console.log(`   components: ${JSON.stringify(result.components)}`);
  console.log(`   highlights: ${result.highlights.slice(0, 3).join('; ') || 'none'}`);
  console.log(`   concerns: ${result.concerns.slice(0, 3).join('; ') || 'none'}`);
  console.log(`   missing: ${result.missing_fields.join(', ') || 'none'}`);
}

for (const result of results) {
  if (!result.id || Number.isNaN(result.final_score)) {
    throw new Error(`Invalid result for fixture listing: ${JSON.stringify(result)}`);
  }
}

if (results[0]?.id !== fixture.expected_top_id) {
  throw new Error(`Expected ${fixture.expected_top_id} as top result, got ${results[0]?.id ?? 'none'}`);
}

const trap = results.find((result) => result.id === 'standard-dupes-trap');
if (!trap || !trap.community_comparison.includes('conflicts with community valuation')) {
  throw new Error('Expected standard-dupes-trap to conflict with community valuation');
}

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks raw-count/standard-dupe accounts.`);
