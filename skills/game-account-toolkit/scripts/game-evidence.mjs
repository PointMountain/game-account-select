import fs from 'node:fs';
import { assessClaim, validateEvidence } from './community-evidence.mjs';
import { fieldEvidenceStatus } from './field-evidence.mjs';

export const gameEvidenceConfig = {
  'zenless-zone-zero': { label: '绝区零', roster: 'agents', duplicates: 'mindscape', equipment: 'w_engines', resources: 'resources', risk: 'risk', riskFields: ['email_status', 'hoyoverse_binding', 'psn_binding', 'tap_binding', 'guarantee', 'official_verification'] },
  'wuthering-waves': { label: '鸣潮', roster: 'characters', duplicates: 'resonance_chain', equipment: 'weapons_or_equipment', resources: 'premium_currency', risk: 'game_specific', riskFields: ['binding', 'guarantee', 'official_verification'] },
  'neverness-to-everness': { label: '异环', roster: 's_characters', duplicates: 'awakening', equipment: 's_arc_plates', resources: 'resources', risk: 'account', riskFields: ['account_type', 'tap_binding', 'guarantee', 'official_verification'] },
};
const array = (value) => Array.isArray(value) ? value : [];
const unique = (items) => [...new Set(items)];
const readField = (object, field) => field.split('.').reduce((value, key) => value != null && Object.hasOwn(value, key) ? value[key] : undefined, object);

export function loadGameEvidence(game) {
  if (!gameEvidenceConfig[game]) return null;
  const file = new URL(`../../game-account-${game}/references/community-evidence.json`, import.meta.url);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export function gamePlayContexts(request = '', explicit) {
  if (Array.isArray(explicit) && explicit.length) return unique(explicit);
  const result = [];
  if (/主线|活动|日常|养老|推图|story/i.test(request)) result.push('story');
  if (/高难|深塔|海墟|式舆|危局|endgame|high_difficulty/i.test(request)) result.push('high_difficulty');
  if (/肉鸽|零号|roguelike/i.test(request)) result.push('roguelike');
  return result.length ? result : ['story'];
}

export function currentTeamClaims(game, evidence, context, now = new Date().toISOString()) {
  if (evidence?.game !== game || !validateEvidence(evidence).valid) return [];
  return evidence.claims.filter((claim) => claim.kind === 'team_recommendation' && assessClaim(claim, evidence, {context, now}).eligible
    && !evidence.claims.some((other) => other.id !== claim.id && other.kind === claim.kind && other.subject === claim.subject
      && other.contexts.includes(context) && (other.status === 'disputed' || (other.status === 'supported'
        && JSON.stringify([other.members, other.requirements, other.equipment]) !== JSON.stringify([claim.members, claim.requirements, claim.equipment])))));
}

// Scores remain historical exploration values. Eligibility is derived independently.
export function assessGameRecommendation(game, listing, { profile = {}, evidence = loadGameEvidence(game), now = new Date().toISOString() } = {}) {
  const config = gameEvidenceConfig[game];
  if (!config) throw new Error(`Unsupported evidence game: ${game}`);
  const assets = listing.game_assets ?? {};
  const roster = array(assets[config.roster]);
  const equipment = array(assets[config.equipment]);
  const contexts = gamePlayContexts(profile.source_text, profile.play_contexts);
  const required = new Map([['listing_id', String(listing.listing_id ?? listing.id ?? '')], ['price', listing.price], ['server', listing.server]]);
  const gaps = [];
  if (!profile.version_context || profile.version_context !== evidence?.version_context || profile.version_context === 'unverified') gaps.push('current_version_unverified');
  if (!Number.isFinite(listing.price) || listing.price <= 0) gaps.push('price_invalid');
  if (listing.hard_filter_passed === false) gaps.push('hard_filter_failed');
  if (Number.isFinite(profile.budget?.primary_min) && listing.price < profile.budget.primary_min) gaps.push('outside_primary_budget');
  if (Number.isFinite(profile.budget?.primary_max) && listing.price > profile.budget.primary_max) gaps.push('outside_primary_budget');
  const add = (field, value = readField(listing, field)) => required.set(field, value ?? null);
  if (!roster.length) gaps.push('named_roster_missing');
  for (const [index, member] of roster.entries()) {
    add(`game_assets.${config.roster}.${index}.name`);
    add(`game_assets.${config.roster}.${index}.${config.duplicates}`);
    if (!member?.name) gaps.push('named_roster_missing');
  }
  for (const [index] of equipment.entries()) {
    add(`game_assets.${config.equipment}.${index}.name`);
    for (const field of ['signature_for', 'fits']) if (equipment[index]?.[field]) add(`game_assets.${config.equipment}.${index}.${field}`);
  }
  for (const [field, value] of Object.entries(assets[config.resources] ?? {})) if (Number(value) > 0) add(`game_assets.${config.resources}.${field}`, value);
  for (const [field, value] of Object.entries(assets.progression ?? {})) if (Number(value) > 0) add(`game_assets.progression.${field}`, value);
  for (const field of config.riskFields) add(`game_assets.${config.risk}.${field}`);
  if (profile.risk_tolerance === 'low') for (const field of config.riskFields.filter((key) => /binding/.test(key))) {
    if (!['clean', 'unbound', 'changeable'].includes(assets[config.risk]?.[field])) gaps.push(`low_risk_binding_unverified:${field}`);
  }
  for (const name of array(profile.must_have)) if (!roster.some((member) => member.name === name)) gaps.push(`required_asset_missing:${name}`);
  for (const name of array(profile.exclusions)) if (roster.some((member) => member.name === name)) gaps.push(`excluded_asset_present:${name}`);
  const hardChecks = [];
  for (const condition of array(profile.hard_conditions)) {
    let satisfied = false;
    if (typeof condition === 'string' && condition.startsWith('server:')) satisfied = listing.server === condition.slice(7);
    else if (condition === 'official_verification:true') satisfied = assets[config.risk]?.official_verification === true;
    else if (condition === 'guarantee:required') satisfied = ['retrieval_compensation', 'insured'].includes(assets[config.risk]?.guarantee);
    hardChecks.push({ condition, satisfied });
    if (!satisfied) gaps.push(`hard_condition_unverified:${typeof condition === 'string' ? condition : JSON.stringify(condition)}`);
  }
  const knowledgeChecks = contexts.map((context) => {
    const claims = currentTeamClaims(game, evidence, context, now);
    const matched = claims.filter((claim) => claim.members.every((name) => roster.some((member) => member.name === name))
      && claim.equipment.every((name) => equipment.some((item) => item.name === name))
      && claim.requirements.every((rule) => rule.field === config.duplicates && roster.some((member) => member.name === rule.member
        && Number.isInteger(member[rule.field]) && member[rule.field] >= rule.minimum)));
    if (!matched.length) gaps.push(`current_team_unverified:${context}`);
    return { context, status: matched.length ? 'verified' : 'unverified', claim_ids: matched.map((claim) => claim.id), source_ids: unique(matched.flatMap((claim) => claim.source_ids)) };
  });
  for (const claim of array(listing.recommendation_claims)) for (const requirement of array(claim.required_fields)) {
    if (typeof requirement?.field !== 'string') { gaps.push('invalid_recommendation_field'); continue; }
    // Compare with actual input; the claim cannot choose its own field value.
    add(requirement.field);
  }
  const fieldChecks = [...required].map(([field, value]) => {
    const check = fieldEvidenceStatus(listing, field, value, now);
    return value === '' || value === 'unknown' ? {...check, status: 'unverified'} : check;
  });
  gaps.push(...fieldChecks.filter((check) => check.status !== 'verified').map((check) => `${check.field}:${check.status}`));
  const eligible = !gaps.length && listing.hard_filter_passed !== false;
  return { schema_version: 1, checked_at: now, status: eligible ? 'verified' : 'pending_verification', eligible,
    contexts, field_checks: fieldChecks, knowledge_checks: knowledgeChecks, hard_checks: hardChecks, gaps: unique(gaps) };
}

export function planGameCommunityRefresh({game, request = '', listings = [], evidence = loadGameEvidence(game), now = new Date().toISOString(), contexts}) {
  const config = gameEvidenceConfig[game];
  if (!config) throw new Error(`Unsupported evidence game: ${game}`);
  const names = unique(listings.flatMap((row) => array((row.source_listing ?? row).game_assets?.[config.roster]).map((member) => member.name)).filter(Boolean));
  const requestedContexts = gamePlayContexts(request, contexts);
  const gaps = requestedContexts.map((context) => {
    const claims = currentTeamClaims(game, evidence, context, now);
    return {context, missing_subjects: names.filter((name) => !claims.some((claim) => claim.members.includes(name))), applied_claim_ids: claims.map((claim) => claim.id)};
  }).filter((gap) => !gap.applied_claim_ids.length || gap.missing_subjects.length);
  return {schema_version: 1, game, generated_at: now, required: !!gaps.length, contexts: requestedContexts, gaps, budget_minutes: 8,
    execution: 'agent_in_current_task_space', tasks: gaps.map((gap) => ({...gap,
      query: `${config.label} ${now.slice(0, 7)} ${gap.context === 'story' ? '主线 活动 日常' : gap.context === 'roguelike' ? '肉鸽' : '高难'} 配队 装备 ${gap.missing_subjects.slice(0,3).join(' ')}`.trim(),
      required_content: ['适用版本与原始发布日期', '两位独立作者的正文、字幕或清晰图表', '队友、装备与练度条件'],
      stop_rule: '同一来源失败一次换独立来源；耗尽8分钟预算保留待核实' }))};
}
