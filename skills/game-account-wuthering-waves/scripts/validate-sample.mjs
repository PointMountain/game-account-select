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

const teamArchetypes = [
  {
    label: 'Ai-Mo-Lin',
    members: ['Aemeath', 'Mornye', 'Lynae']
  },
  {
    label: 'Ka-Qian-Xia',
    members: ['Cartethyia', 'Chisa', 'Xia Kong']
  },
  {
    label: 'Jinhsi-Shorekeeper',
    members: ['Jinhsi', 'Shorekeeper']
  },
  {
    label: 'Augusta-Iuno',
    members: ['Augusta', 'Iuno']
  },
  {
    label: 'Hiyuki-core',
    members: ['Hiyuki']
  }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const characters = assets.characters ?? [];
  const weapons = assets.weapons_or_equipment ?? [];
  const currency = assets.premium_currency ?? {};
  const gameSpecific = assets.game_specific ?? {};
  const explicitMissingFields = Array.isArray(listing.missing_fields) ? listing.missing_fields : [];
  const characterNames = new Set(characters.map((character) => character.name));
  const budget = Number(fixture.budget?.max_cny ?? fixture.budget_cny ?? 0);

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
      missingFields.push('community coverage for named new assets');
    }
  }

  const limitedScore = clamp(limitedCoreScore + mediumAssetScore + trapScore, 0, 35);

  let teamArchetypeScore = 0;
  for (const archetype of teamArchetypes) {
    const matched = archetype.members.filter((member) => characterNames.has(member));
    if (archetype.members.length === 1 && matched.length === 1) {
      teamArchetypeScore += 4;
      highlights.push(`${archetype.label} team direction is present`);
    } else if (matched.length === archetype.members.length) {
      teamArchetypeScore += 10;
      highlights.push(`${archetype.label} team archetype is complete`);
    } else if (matched.length >= 2) {
      teamArchetypeScore += 6;
      highlights.push(`${archetype.label} team archetype is partially present`);
    }
  }
  teamArchetypeScore = clamp(teamArchetypeScore, 0, 10);

  const highCoreCount = characters.filter((character) => highValue.has(character.name)).length;
  const mediumCount = characters.filter((character) => mediumValue.has(character.name)).length;
  let teamScore = 0;
  if (highCoreCount >= 4) {
    teamScore = 14;
    highlights.push('Multiple high-value cores can anchor current-version teams');
  } else if (highCoreCount >= 2) {
    teamScore = 10;
    highlights.push('Some high-value cores are present, but team completeness needs checking');
  } else if (highCoreCount === 1 || mediumCount >= 3) {
    teamScore = 6;
    concerns.push('Roster has usable assets but lacks a clear current high-value team core');
  } else {
    teamScore = 3;
    concerns.push('Roster mostly relies on raw count or standard-character duplicates');
  }
  teamScore = clamp(teamScore, 0, 15);

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
  const lunites = Number(currency.lunites ?? currency.lunite ?? 0);
  let resourceScore = 0;
  if (astrite || radiantTide || forgingTide || afterglowCoral || lunites) {
    resourceScore = clamp(
      Math.floor(astrite / 2500)
        + Math.floor((radiantTide + forgingTide) / 10)
        + Math.floor(afterglowCoral / 120)
        + Math.floor(lunites / 200),
      1,
      15
    );
    highlights.push('Pull resources are disclosed and add future banner flexibility');
    if (explicitMissingFields.some((field) => /资源|截图|月相/.test(field))) {
      missingFields.push('resource screenshot confirmation');
    }
  } else {
    missingFields.push('premium currency / tides / coral');
  }

  let priceFitScore = 6;
  const budgetShare = budget > 0 ? listing.price / budget : null;
  if (listing.price <= 200 && highCoreCount >= 2) priceFitScore = 9;
  if (listing.price <= 200 && highCoreCount >= 2 && weapons.length === 0) priceFitScore = 6;
  if (listing.price > 240 && highCoreCount >= 4) priceFitScore = 8;
  if (budgetShare !== null && budgetShare >= 0.65 && budgetShare <= 1 && highCoreCount >= 3 && weapons.length >= 5) priceFitScore = 10;
  if (highCoreCount === 0 && listing.price >= 180) priceFitScore = 1;

  let riskPenalty = 0;
  if (gameSpecific.binding === 'tap_bound') {
    riskPenalty += 18;
    concerns.push('TAP binding raises retrieval risk');
  } else if (gameSpecific.binding === 'partial_clean') {
    riskPenalty += 4;
    missingFields.push('partial third-party binding confirmation');
    highlights.push('Major binding risk is partly disclosed, but third-party links still need confirmation');
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

  if (listing.price <= 250 && highCoreCount >= 2 && weapons.length === 0) {
    riskPenalty += 6;
    concerns.push('Very low price with no weapon ownership details needs extra verification before being treated as best value');
  }

  if (listing.server && listing.server !== '官服') {
    riskPenalty += 8;
    concerns.push(`${listing.server} may not match official-server preference`);
  }

  let missingPenalty = 0;
  if (missingFields.includes('premium currency / tides / coral')) missingPenalty += 6;
  if (missingFields.includes('resource screenshot confirmation')) missingPenalty += 3;
  if (weapons.length === 0) {
    missingPenalty += 7;
    missingFields.push('weapon / signature weapon details');
  }
  if (missingFields.includes('TAP/Wegame/PS5 binding status')) missingPenalty += 10;
  if (missingFields.includes('partial third-party binding confirmation')) missingPenalty += 4;
  for (const field of explicitMissingFields) {
    if (!missingFields.includes(field)) missingFields.push(field);
  }

  const rawScore = limitedScore + teamScore + weaponScore + resourceScore + priceFitScore;
  const teamAdjustedRawScore = rawScore + teamArchetypeScore;
  const finalScore = clamp(teamAdjustedRawScore - riskPenalty - missingPenalty, 0, 100);

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
    : missingPenalty >= 8
      || riskPenalty >= 10
      || missingFields.includes('partial third-party binding confirmation')
      || missingFields.includes('community coverage for named new assets')
      ? 'medium'
      : 'high';

  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    final_score: finalScore,
    components: {
      limited_score: limitedScore,
      team_archetype_score: teamArchetypeScore,
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

const completeTeam = results.find((result) => result.id === 'team-archetype-complete');
const isolatedCarry = results.find((result) => result.id === 'isolated-high-chain-carry');
if (!completeTeam || !isolatedCarry || completeTeam.final_score <= isolatedCarry.final_score) {
  throw new Error('Expected team-archetype-complete to outrank isolated-high-chain-carry');
}

const controlledTeam = results.find((result) => result.id === 'controlled-team-archetype-match');
const controlledLoose = results.find((result) => result.id === 'controlled-loose-high-value');
if (!controlledTeam || !controlledLoose || controlledTeam.components.team_archetype_score <= controlledLoose.components.team_archetype_score || controlledTeam.final_score <= controlledLoose.final_score) {
  throw new Error('Expected controlled team archetype match to outrank comparable loose high-value assets through team_archetype_score');
}

const realRun = results.find((result) => result.id === 'taoshouyou-77175988');
if (!realRun || realRun.final_score < 65 || realRun.confidence !== 'medium') {
  throw new Error('Expected taoshouyou-77175988 to remain a medium-confidence strong recommendation');
}
if (!realRun.missing_fields.includes('resource screenshot confirmation') || !realRun.missing_fields.includes('partial third-party binding confirmation')) {
  throw new Error('Expected taoshouyou-77175988 to preserve resource screenshot and binding confirmation gaps');
}

const cheapRisky = results.find((result) => result.id === 'budget-cheap-risky-198');
const budgetComplete = results.find((result) => result.id === 'budget-complete-888');
if (!cheapRisky || !budgetComplete || budgetComplete.final_score <= cheapRisky.final_score) {
  throw new Error('Expected a 700-1000 CNY complete low-risk account to outrank a 198 CNY account with missing weapons/resources in value-for-budget sorting');
}
if (!cheapRisky.missing_fields.includes('weapon / signature weapon details') || cheapRisky.components.risk_penalty < 6) {
  throw new Error('Expected cheap risky account to carry weapon-detail gaps and extra low-price risk penalty');
}

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks raw-count/standard-dupe accounts.`);
