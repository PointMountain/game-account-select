#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizePriorities, parseSelectionProfile } from '../../game-account-select/scripts/parse-selection-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'operator-value-map.json'), 'utf8'));

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(Number(value) || 0, min), max);

function normalizeName(name) {
  const clean = String(name ?? '').trim();
  return knowledge.aliases?.[clean] ?? clean;
}

function operatorKnowledge(operator) {
  const name = normalizeName(operator?.name);
  const known = knowledge.operators?.[name] ?? null;
  return {
    name,
    acquisition_type: known?.acquisition_type ?? operator?.acquisition_type ?? operator?.category ?? 'unknown',
    collector_value: Number(known?.collector_value ?? 10),
    combat_value: Number(known?.combat_value ?? 45),
    story_value: Number(known?.story_value ?? known?.combat_value ?? 45),
    meta_tier: known?.meta_tier ?? 'unrated',
    roles: Array.isArray(known?.roles) ? known.roles : [],
    progression_dependency: known?.progression_dependency ?? 'unknown',
    evidence_as_of: known?.evidence_as_of ?? null,
    known: Boolean(known),
  };
}

function progressRatio(operator) {
  const elite = Number(operator?.elite ?? 0);
  const elitePart = elite >= 2 ? 0.55 : elite >= 1 ? 0.25 : 0.05;
  const masteryPart = operator?.mastery == null ? 0 : clamp(operator.mastery, 0, 3) / 3 * 0.3;
  const modulePart = operator?.module == null ? 0 : clamp(operator.module, 0, 3) / 3 * 0.15;
  return clamp(elitePart + masteryPart + modulePart, 0, 1);
}

function isUsable(operator) {
  return Number(operator?.elite ?? 0) >= 2 || operator?.usable === true;
}

function rarityScore(operators) {
  const value = operators
    .map((operator) => {
      const meta = operatorKnowledge(operator);
      if (!['limited', 'collab'].includes(meta.acquisition_type)) return 0;
      const scarcity = meta.acquisition_type === 'collab' ? 1.15 : 1;
      return meta.collector_value * scarcity;
    })
    .sort((a, b) => b - a)
    .slice(0, 12)
    .reduce((sum, item) => sum + item, 0);
  return clamp(100 * (1 - Math.exp(-value / 350)));
}

const ROLE_GROUPS = {
  deployment: ['deployment'],
  laneholding: ['laneholding'],
  physical_damage: ['physical_damage'],
  arts_damage: ['arts_damage'],
  sustain: ['sustain'],
  utility: ['control', 'fast_redeploy', 'support'],
};

function combatOperator(operator) {
  const meta = operatorKnowledge(operator);
  const progression = progressRatio(operator);
  const communityValue = meta.combat_value * 0.55 + meta.story_value * 0.45;
  return {
    operator,
    ...meta,
    progression,
    usable: isUsable(operator),
    effective_value: communityValue * (0.25 + progression * 0.75),
  };
}

function roleCoverage(profiles) {
  const roles = {};
  for (const [role, acceptedTags] of Object.entries(ROLE_GROUPS)) {
    const candidates = profiles
      .filter((profile) => profile.roles.some((tag) => acceptedTags.includes(tag)))
      .map((profile) => ({
        name: profile.name,
        usable: profile.usable,
        quality: profile.usable ? profile.story_value * (0.4 + profile.progression * 0.6) : 0,
      }))
      .sort((a, b) => b.quality - a.quality);
    const best = candidates[0] ?? null;
    roles[role] = {
      covered: Boolean(best && best.quality >= 55),
      best_operator: best?.name ?? null,
      quality: Number((best?.quality ?? 0).toFixed(2)),
    };
  }
  const rows = Object.values(roles);
  const coveredCount = rows.filter((row) => row.covered).length;
  const qualityScore = rows.reduce((sum, row) => sum + clamp(row.quality / 85 * 100), 0) / rows.length;
  return {
    score: clamp(coveredCount / rows.length * 70 + qualityScore * 0.3),
    covered_count: coveredCount,
    required_count: rows.length,
    missing_roles: Object.entries(roles).filter(([, value]) => !value.covered).map(([role]) => role),
    roles,
  };
}

function combatBreakdown(operators) {
  const profiles = operators.map(combatOperator);
  const recommended = profiles
    .filter((profile) => ['apex', 'core', 'strong'].includes(profile.meta_tier))
    .sort((a, b) => b.effective_value - a.effective_value);
  const metaValues = recommended.slice(0, 8).map((profile) => profile.effective_value);
  const depthValues = profiles.map((profile) => profile.effective_value).sort((a, b) => b - a).slice(0, 10);
  const metaCoreScore = clamp(metaValues.reduce((sum, value) => sum + value, 0) / 8);
  const depthScore = clamp(depthValues.reduce((sum, value) => sum + value, 0) / 10);
  const coverage = roleCoverage(profiles);
  const ready = recommended.filter((profile) => profile.usable);
  const unready = recommended.filter((profile) => !profile.usable && ['apex', 'core'].includes(profile.meta_tier));
  return {
    score: clamp(metaCoreScore * 0.55 + coverage.score * 0.3 + depthScore * 0.15),
    meta_core_score: metaCoreScore,
    role_coverage_score: coverage.score,
    roster_depth_score: depthScore,
    ready_recommended_operators: ready.slice(0, 10).map((profile) => profile.name),
    unready_meta_operators: unready.slice(0, 8).map((profile) => profile.name),
    role_coverage: coverage,
    profiles,
  };
}

function progressionScore(profiles) {
  if (!profiles.length) return 0;
  const valuable = profiles
    .filter((profile) => ['apex', 'core', 'strong'].includes(profile.meta_tier))
    .sort((a, b) => b.story_value - a.story_value)
    .slice(0, 12);
  const valuableWeight = valuable.reduce((sum, profile) => sum + profile.story_value, 0);
  const valuableScore = valuableWeight
    ? valuable.reduce((sum, profile) => sum + profile.progression * profile.story_value, 0) / valuableWeight * 100
    : 0;
  const general = profiles.map((profile) => profile.progression).sort((a, b) => b - a).slice(0, 12);
  const generalScore = general.reduce((sum, value) => sum + value, 0) / general.length * 100;
  return clamp(valuableScore * 0.7 + generalScore * 0.3);
}

function pushReadiness(combat, progression, operators) {
  const explicitEliteCount = operators.filter((operator) => operator?.elite != null).length;
  if (!operators.length || explicitEliteCount === 0) {
    return {
      status: 'unverified',
      score: 0,
      penalty: 20,
      ready_recommended_count: 0,
      role_coverage_count: 0,
      missing_roles: Object.keys(ROLE_GROUPS),
    };
  }
  const readyCount = combat.ready_recommended_operators.length;
  const roleCount = combat.role_coverage.covered_count;
  const score = clamp(combat.meta_core_score * 0.5 + combat.role_coverage_score * 0.35 + progression * 0.15);
  let status = 'not_ready';
  let penalty = 25;
  if (score >= 60 && readyCount >= 4 && roleCount >= 5) {
    status = 'ready';
    penalty = 0;
  } else if (score >= 42 && readyCount >= 2 && roleCount >= 4) {
    status = 'partial';
    penalty = clamp(12 - (score - 42) * 0.35, 4, 12);
  }
  return {
    status,
    score: Number(score.toFixed(4)),
    penalty: Number(penalty.toFixed(4)),
    ready_recommended_count: readyCount,
    role_coverage_count: roleCount,
    missing_roles: combat.role_coverage.missing_roles,
  };
}

function estimatedPulls(resources) {
  const orundum = Number(resources?.orundum ?? 0);
  const prime = Number(resources?.originite_prime ?? 0);
  const tenPullTickets = Number(resources?.ten_pull_tickets ?? 0);
  const singleTickets = Number(resources?.single_pull_tickets ?? resources?.headhunting_permits ?? 0);
  return Math.max(0, (orundum + prime * 180) / 600 + tenPullTickets * 10 + singleTickets);
}

function resourceScore(resources) {
  return clamp(estimatedPulls(resources) / 150 * 100);
}

function skinScore(skins, declaredCount = null) {
  const rows = Array.isArray(skins) ? skins : [];
  const specialBonus = rows.reduce((sum, skin) => {
    const value = typeof skin === 'string' ? skin : `${skin?.type ?? ''} ${skin?.name ?? ''}`;
    if (/dynamic|动态/i.test(value)) return sum + 3;
    if (/collab|联动|联名/i.test(value)) return sum + 2.5;
    if (/rare|稀有|绝版/i.test(value)) return sum + 1.5;
    return sum;
  }, 0);
  const count = Math.max(rows.length, Number(declaredCount) || 0);
  const breadthScore = 100 * (1 - Math.exp(-count / 85));
  return clamp(breadthScore + Math.min(12, specialBonus));
}

function budgetTier(price, budget) {
  if (!Number.isFinite(Number(price)) || budget?.primary_max == null) return { tier: 'unscoped', score: 50, delta: null };
  const numericPrice = Number(price);
  const target = Number(budget.target ?? budget.primary_max);
  const primary = numericPrice >= Number(budget.primary_min ?? 0) && numericPrice <= Number(budget.primary_max);
  const flexible = numericPrice >= Number(budget.flex_min ?? budget.primary_min ?? 0) && numericPrice <= Number(budget.flex_max ?? budget.primary_max);
  if (primary) {
    const min = Number(budget.primary_min ?? 0);
    const max = Number(budget.primary_max);
    const span = Math.max(1, max - min);
    return { tier: 'primary', score: clamp(100 - (numericPrice - min) / span * 30), delta: numericPrice - target };
  }
  if (flexible) return { tier: 'flex_budget', score: 40, delta: numericPrice - target };
  return { tier: 'excluded_price', score: 0, delta: numericPrice - target };
}

function rawRisk(listing) {
  const risk = listing?.game_assets?.risk ?? listing?.risk ?? {};
  let penalty = 0;
  const facts = [];
  if (risk.real_name_status === 'unknown' || risk.real_name_status == null) { penalty += 15; facts.push('real_name_unknown'); }
  if (risk.guarantee === 'none') { penalty += 10; facts.push('no_retrieval_guarantee'); }
  else if (risk.guarantee === 'unknown' || risk.guarantee == null) { penalty += 8; facts.push('guarantee_unknown'); }
  if (!risk.official_verification) { penalty += 8; facts.push('official_verification_missing'); }
  if (listing?.server && listing.server !== '官服') { penalty += 8; facts.push(`server:${listing.server}`); }
  return { penalty: clamp(penalty, 0, 40), facts };
}

function missingPenalty(listing) {
  const assets = listing?.game_assets ?? {};
  const operators = Array.isArray(assets.operators) ? assets.operators : [];
  const missing = [];
  let penalty = 0;
  if (!operators.length) { penalty += 20; missing.push('operators'); }
  if (operators.length && operators.every((operator) => operator.elite == null)) {
    penalty += 12;
    missing.push('operator_elite_status');
  } else if (operators.some((operator) => operator.mastery == null || operator.module == null)) {
    penalty += 6;
    missing.push('operator_mastery_module');
  }
  if (!assets.resources || Object.keys(assets.resources).length === 0) { penalty += 6; missing.push('resources'); }
  return { penalty: clamp(penalty, 0, 25), missing };
}

function hardFilter(listing, profile, operatorNames) {
  const reasons = [];
  const matchesOperatorToken = (name, token) => {
    const normalizedName = normalizeName(name);
    const normalizedToken = normalizeName(token);
    if (!normalizedName || !normalizedToken) return false;
    if (normalizedName === normalizedToken) return true;
    return Math.min(normalizedName.length, normalizedToken.length) >= 2
      && (normalizedName.includes(normalizedToken) || normalizedToken.includes(normalizedName));
  };
  for (const required of profile.must_have ?? []) {
    if (!operatorNames.some((name) => matchesOperatorToken(name, required))) reasons.push(`missing:${required}`);
  }
  for (const excluded of profile.exclusions ?? []) {
    if (operatorNames.some((name) => matchesOperatorToken(name, excluded))) reasons.push(`excluded:${excluded}`);
  }
  for (const condition of profile.hard_conditions ?? []) {
    if (condition.startsWith('server:') && listing.server !== condition.slice('server:'.length)) reasons.push(condition);
    if (condition === 'official_verification:true' && !listing?.game_assets?.risk?.official_verification) reasons.push(condition);
    if (condition === 'guarantee:required' && !['retrieval_compensation', 'guaranteed'].includes(listing?.game_assets?.risk?.guarantee)) reasons.push(condition);
    if (condition === 'collab_complete:true' && listing?.game_assets?.collab_completion?.complete !== true) reasons.push(condition);
    if (condition === 'limited_complete:true' && listing?.game_assets?.limited_completion?.complete !== true) reasons.push(condition);
    const orundumRange = condition.match(/^orundum:(\d+)-(\d+)$/);
    if (orundumRange) {
      const value = Number(listing?.game_assets?.resources?.orundum);
      if (!Number.isFinite(value) || value < Number(orundumRange[1]) || value > Number(orundumRange[2])) reasons.push(condition);
    }
    const orundumMinimum = condition.match(/^orundum:(\d+)\+$/);
    if (orundumMinimum) {
      const value = Number(listing?.game_assets?.resources?.orundum);
      if (!Number.isFinite(value) || value < Number(orundumMinimum[1])) reasons.push(condition);
    }
  }
  return { passed: reasons.length === 0, reasons };
}

function riskMultiplier(tolerance) {
  return ({ low: 1.4, medium: 1, high: 0.5, unknown: 1 })[tolerance] ?? 1;
}

export function scoreListing(listing, inputProfile) {
  const profile = typeof inputProfile === 'string' ? parseSelectionProfile(inputProfile) : inputProfile;
  const priorities = normalizePriorities(profile?.priorities);
  const assets = listing?.game_assets ?? {};
  const operators = Array.isArray(assets.operators) ? assets.operators : [];
  const budget = budgetTier(listing?.price, profile?.budget ?? {});
  const combat = combatBreakdown(operators);
  const progression = progressionScore(combat.profiles);
  const push = pushReadiness(combat, progression, operators);
  const namedRarity = rarityScore(operators);
  const collabCompletionRatio = Number(assets?.collab_completion?.ratio);
  const limitedCompletionRatio = Number(assets?.limited_completion?.ratio);
  const dimensions = {
    rarity: clamp(Math.max(
      namedRarity,
      Number.isFinite(collabCompletionRatio) ? collabCompletionRatio * 100 : 0,
      Number.isFinite(limitedCompletionRatio) ? limitedCompletionRatio * 100 : 0,
    )),
    combat: combat.score,
    progression,
    resources: resourceScore(assets.resources ?? {}),
    skins: skinScore(assets.skins ?? [], assets?.platform_facts?.counts?.skins),
    price_efficiency: budget.score,
  };
  const profileScore = Object.entries(priorities).reduce((sum, [key, weight]) => sum + dimensions[key] * weight / 100, 0);
  const nonPriceWeight = 100 - priorities.price_efficiency;
  const assetQualityScore = nonPriceWeight > 0
    ? Object.entries(priorities).filter(([key]) => key !== 'price_efficiency').reduce((sum, [key, weight]) => sum + dimensions[key] * weight / nonPriceWeight, 0)
    : 0;
  const risk = rawRisk(listing);
  const missing = missingPenalty(listing);
  const appliedRiskPenalty = risk.penalty * riskMultiplier(profile?.risk_tolerance ?? 'unknown');
  const operatorNames = operators.map((operator) => normalizeName(operator.name));
  const filter = hardFilter(listing, profile, operatorNames);
  const finalScore = filter.passed ? clamp(profileScore - appliedRiskPenalty - missing.penalty - push.penalty) : 0;
  const highlights = [];
  const concerns = [];
  if (combat.ready_recommended_operators.length) highlights.push(`已养成社区推荐核心：${combat.ready_recommended_operators.slice(0, 6).join('、')}`);
  highlights.push(`推图职能覆盖 ${combat.role_coverage.covered_count}/${combat.role_coverage.required_count}`);
  if (push.status !== 'ready') concerns.push(`推图可用度为 ${push.status}，已施加 ${push.penalty.toFixed(2)} 分基础质量罚分`);
  if (combat.unready_meta_operators.length) concerns.push(`未确认可用练度的超大杯/核心：${combat.unready_meta_operators.join('、')}`);
  if (combat.role_coverage.missing_roles.length) concerns.push(`缺少已养成职能：${combat.role_coverage.missing_roles.join('、')}`);

  return {
    ...listing,
    selection_profile: profile,
    base_dimensions: dimensions,
    profile_score: Number(profileScore.toFixed(4)),
    asset_quality_score: Number(assetQualityScore.toFixed(4)),
    asset_score: Number(assetQualityScore.toFixed(4)),
    resource_score: Number(dimensions.resources.toFixed(4)),
    collection_score: Number(dimensions.skins.toFixed(4)),
    progress_score: Number(dimensions.progression.toFixed(4)),
    price_score: Number(dimensions.price_efficiency.toFixed(4)),
    risk_penalty: risk.penalty,
    applied_risk_penalty: Number(appliedRiskPenalty.toFixed(4)),
    risk_facts: risk.facts,
    missing_data_penalty: missing.penalty,
    confidence_penalty: missing.penalty,
    missing_fields: missing.missing,
    combat_breakdown: {
      meta_core_score: Number(combat.meta_core_score.toFixed(4)),
      role_coverage_score: Number(combat.role_coverage_score.toFixed(4)),
      roster_depth_score: Number(combat.roster_depth_score.toFixed(4)),
      ready_recommended_operators: combat.ready_recommended_operators,
      unready_meta_operators: combat.unready_meta_operators,
      role_coverage: combat.role_coverage,
    },
    push_readiness: push,
    playability_penalty: push.penalty,
    highlights,
    concerns,
    hard_filter_passed: filter.passed,
    hard_filter_reasons: filter.reasons,
    budget_tier: budget.tier,
    budget_delta: budget.delta,
    final_score: Number(finalScore.toFixed(4)),
    confidence: missing.penalty >= 14 || push.status === 'unverified' ? 'low' : missing.penalty > 0 || risk.penalty >= 15 || push.status !== 'ready' ? 'medium' : 'high',
  };
}

export function rankListings(listings, profile) {
  return (Array.isArray(listings) ? listings : [])
    .map((listing) => scoreListing(listing, profile))
    .sort((a, b) => Number(b.hard_filter_passed) - Number(a.hard_filter_passed) || b.final_score - a.final_score || b.asset_quality_score - a.asset_quality_score);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const requestIndex = args.indexOf('--request');
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : null;
  const request = requestIndex >= 0 ? args[requestIndex + 1] : null;
  if (!inputPath || !request) {
    console.error('Usage: node score-listings.mjs --input <listings.json> --request <natural language request>');
    process.exit(2);
  }
  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  console.log(JSON.stringify({ selection_profile: parseSelectionProfile(request), rankings: rankListings(input.listings ?? input, request) }, null, 2));
}
