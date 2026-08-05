#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { parseSelectionProfile } from './parse-selection-profile.mjs';

const args = process.argv.slice(2);
const repoRoot = process.cwd();

function readArg(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function hasFlag(name) {
  return args.includes(name);
}

function usage() {
  console.error([
    'Usage: node skills/game-account-select/scripts/create-run-artifact.mjs --game <game> --user-request <text> [options]',
    '',
    'Options:',
    '  --target-skill <skill>      Target skill path or id',
    '  --budget-max <amount>      Primary budget max in CNY',
    '  --flex-max <amount>        Flexible budget max in CNY',
    '  --allow-budget-flex        Mark budget flex as allowed',
    '  --expand-budget            Explicitly enable automatic out-of-budget exact-match search',
    '  --no-expand-budget         Disable automatic price expansion for this run',
    '  --expansion-max <amount>   Optional ceiling for out-of-budget search',
    '  --profile-confirmed        Resolve an already displayed objective conflict; complete profiles freeze automatically',
    '  --platforms <a,b,c>        Override minimum platform coverage',
    '  --community-sources <a,b>  Override minimum community coverage',
    '  --out <path>               Write JSON to this path',
    '  --json                     Print JSON to stdout'
  ].join('\n'));
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function knownSkillFor(game) {
  const normalized = String(game).toLowerCase();
  const known = [
    [/wuthering|鸣潮/, 'skills/game-account-wuthering-waves'],
    [/arknights|明日方舟/, 'skills/game-account-arknights'],
    [/neverness|异环/, 'skills/game-account-neverness-to-everness'],
    [/zenless|zzz|绝区零/, 'skills/game-account-zenless-zone-zero']
  ];
  const match = known.find(([pattern]) => pattern.test(normalized));
  if (match) return match[1];
  const slug = slugify(game);
  return slug ? `skills/game-account-${slug}` : 'unknown';
}

function splitList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPlatformPriority() {
  const priorityPath = path.resolve(repoRoot, 'skills/game-account-toolkit/references/platform-priority.json');
  if (!fs.existsSync(priorityPath)) return ['pxb7', 'pzds'];
  const parsed = JSON.parse(fs.readFileSync(priorityPath, 'utf8'));
  return parsed.required_default_coverage ?? ['pxb7', 'pzds'];
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

const game = readArg('--game');
const userRequest = readArg('--user-request') ?? readArg('--request');

if (!game || !userRequest || hasFlag('--help') || hasFlag('-h')) {
  usage();
  process.exit(!game || !userRequest ? 2 : 0);
}

const budgetMax = readArg('--budget-max');
const flexMax = readArg('--flex-max');
const expansionMax = readArg('--expansion-max');
const parsedProfile = parseSelectionProfile(userRequest);
const targetSkill = readArg('--target-skill') ?? knownSkillFor(game);
const defaultPlatformCoverage = [...new Set([...readPlatformPriority(), ...parsedProfile.platforms])];
const requiredPlatforms = splitList(
  readArg('--platforms'),
  defaultPlatformCoverage
);
const communitySources = splitList(readArg('--community-sources'), ['bilibili', 'youtube']);
const runId = `gas-${slugify(game) || 'game'}-${nowStamp()}`;
const primaryMax = budgetMax == null ? parsedProfile.budget.primary_max : Number(budgetMax);
if (budgetMax != null && (!Number.isFinite(primaryMax) || primaryMax < 0)) {
  console.error('--budget-max must be a non-negative number');
  process.exit(2);
}
const flexibleMax = flexMax == null
  ? (hasFlag('--allow-budget-flex') && Number.isFinite(primaryMax)
      ? Math.round(primaryMax * 1.25)
      : parsedProfile.budget.flex_max)
  : Number(flexMax);
if (flexMax != null && (!Number.isFinite(flexibleMax) || flexibleMax < 0)) {
  console.error('--flex-max must be a non-negative number');
  process.exit(2);
}
if (expansionMax != null && (!Number.isFinite(Number(expansionMax)) || Number(expansionMax) < 0)) {
  console.error('--expansion-max must be a non-negative number');
  process.exit(2);
}
const budgetWasMissing = parsedProfile.budget.target == null && parsedProfile.budget.primary_max == null;
const clarificationRequired = parsedProfile.clarification_required
  .filter((item) => !(item === 'budget' && budgetMax != null))
  .filter((item) => !(item === 'objective_conflict' && hasFlag('--profile-confirmed')));
const expansionDisabled = hasFlag('--no-expand-budget');
const expansionExplicit = hasFlag('--expand-budget') || expansionMax != null;
const expansionDefaultForOverride = budgetWasMissing && budgetMax != null && !parsedProfile.budget_expansion.explicitly_strict;
const expansionEnabled = !expansionDisabled && (parsedProfile.budget_expansion.enabled || expansionExplicit || expansionDefaultForOverride);
const selectionProfile = {
  ...parsedProfile,
  platforms: requiredPlatforms,
  clarification_required: clarificationRequired,
  confirmation_required: clarificationRequired.length > 0,
  budget: {
    ...parsedProfile.budget,
    target: budgetWasMissing && budgetMax != null ? primaryMax : parsedProfile.budget.target,
    primary_min: budgetWasMissing && budgetMax != null ? 0 : parsedProfile.budget.primary_min,
    primary_max: primaryMax,
    flex_min: budgetWasMissing && budgetMax != null ? 0 : parsedProfile.budget.flex_min,
    flex_max: flexibleMax,
    interpretation: budgetWasMissing && budgetMax != null ? 'cli_override_ceiling' : parsedProfile.budget.interpretation,
  },
  budget_expansion: {
    ...parsedProfile.budget_expansion,
    enabled: expansionEnabled,
    directions: expansionEnabled ? (parsedProfile.budget_expansion.directions?.length ? parsedProfile.budget_expansion.directions : ['lower', 'higher']) : [],
    max_price: expansionMax == null ? parsedProfile.budget_expansion.max_price : Number(expansionMax),
    authorization: expansionDisabled ? 'disabled_by_user' : expansionExplicit ? 'user_explicit' : expansionDefaultForOverride ? 'default_fallback' : parsedProfile.budget_expansion.authorization,
    explicitly_strict: expansionDisabled || parsedProfile.budget_expansion.explicitly_strict,
  },
};
const profileDigest = crypto.createHash('sha256').update(JSON.stringify(selectionProfile)).digest('hex');
const profileStatus = selectionProfile.clarification_required.length
  ? 'needs_clarification'
  : 'confirmed';

const platformTasks = requiredPlatforms.map((platform) => ({
  id: `platform-${platform}-list`,
  type: 'platform_listing',
  source: platform,
  priority: 'required',
  start_path: platform === 'user_provided' ? 'user_material' : 'natural_navigation',
  success_signal: 'read traceable listing cards with url/source id, price, title, server/risk hints, and candidate count',
  fallback_order: ['verified_adapter', 'chrome_use_dom', 'browser_dom', 'user_material'],
  wait_budget_ms: 15000,
  required_fields: ['url', 'title', 'price', 'platform', 'source_status'],
  confidence_cap_if_missing: 'medium'
}));

const communityTasks = communitySources.map((source) => ({
  id: `community-${source}-meta`,
  type: 'community_evidence',
  source,
  priority: source === 'youtube' ? 'preferred' : 'required',
  start_path: 'search',
  success_signal: 'capture reviewable source URL plus meta/team/signature/risk notes relevant to candidate assets',
  fallback_order: ['chrome_use_dom', 'browser_dom', 'page_metadata', 'guide_site', 'official_source', 'user_material'],
  wait_budget_ms: 15000,
  required_fields: ['url', 'title', 'evidence_note', 'status'],
  confidence_cap_if_missing: source === 'youtube' ? 'medium' : 'low'
}));

const artifact = {
  run_id: runId,
  started_at: new Date().toISOString(),
  finished_at: null,
  game,
  target_skill: targetSkill,
  user_request: userRequest,
  selection_profile: selectionProfile,
  profile_confirmation: {
    status: profileStatus,
    confirmed_at: profileStatus === 'confirmed' ? new Date().toISOString() : null,
    confirmation_mode: hasFlag('--profile-confirmed') ? 'user_confirmed_conflict' : 'automatic_complete_profile',
    profile_digest: profileDigest,
    clarification_required: selectionProfile.clarification_required,
  },
  profile_isolation: {
    persistence_scope: 'run_only',
    durable_updates_from_profile: [],
    rule: 'Budget, objective weights, server preferences, risk tolerance, and user hard conditions stay in this run artifact.',
  },
  budget: {
    currency: 'CNY',
    target: selectionProfile.budget.target,
    primary_min: selectionProfile.budget.primary_min,
    primary_max: primaryMax,
    flex_min: selectionProfile.budget.flex_min,
    flex_max: flexibleMax,
    allow_budget_flex: hasFlag('--allow-budget-flex') || flexibleMax != null
  },
  budget_expansion: selectionProfile.budget_expansion,
  success_criteria: {
    game,
    budget: {
      target: selectionProfile.budget.target,
      primary_min: selectionProfile.budget.primary_min,
      primary_max: primaryMax,
      flex_min: selectionProfile.budget.flex_min,
      flex_max: flexibleMax
    },
    hard_conditions: selectionProfile.hard_conditions,
    soft_preferences: [
      selectionProfile.objective,
      ...Object.entries(selectionProfile.priorities).map(([key, value]) => `${key}:${value}`),
      ...(selectionProfile.soft_preferences ?? []).map((item) => `${item.type}:${item.preference}`),
    ],
    risk_tolerance: selectionProfile.risk_tolerance,
    minimum_source_coverage: {
      platforms: requiredPlatforms,
      community_sources: communitySources
    },
    completion_conditions: [
      'primary recommendations satisfy hard conditions or the artifact explains why none were found',
      'required default platforms are attempted, read successfully, or downgraded with evidence',
      'community confidence is capped according to source coverage',
      'all recommendation tiers preserve url or traceable source id',
      'optimizer and evaluator gates run on this raw artifact'
    ]
  },
  capabilities: {},
  query_plan: {
    hard_filters: selectionProfile.hard_conditions,
    soft_preferences: {
      priorities: selectionProfile.priorities,
      account_preferences: selectionProfile.soft_preferences ?? [],
    },
    budget_layers: {
      primary_budget: {
        min: selectionProfile.budget.primary_min,
        max: primaryMax,
      },
      flex_budget: {
        min: selectionProfile.budget.flex_min,
        max: flexibleMax,
      },
      excluded_price: null
    },
    budget_expansion: selectionProfile.budget_expansion
  },
  coverage_plan: {
    intent_summary: userRequest,
    source_tasks: [...platformTasks, ...communityTasks],
    completeness_gates: {
      platforms_required: requiredPlatforms,
      detail_required_for_top_n: 3,
      community_sources_required: communitySources,
      url_required_for_all_tiers: true
    },
    stop_rules: [
      'stop retrying a source after one failed path and one independent fallback',
      'stop expanding sources when success criteria are met and new data would be duplicate',
      'stop and downgrade when login, verification, wrong-game route, or platform safety boundary blocks access'
    ]
  },
  coverage_gaps: [],
  platform_attempts: [],
  community_attempts: [],
  recommendations: [],
  backup_listings: [],
  near_match_listings: [],
  budget_breakthrough_listings: [],
  budget_comparison: null,
  excluded_listings: [],
  final_response_draft: '',
  missing_fields: [],
  community_evidence: null,
  rule_update_suggestions: [],
  knowledge_update_candidates: [],
  user_feedback: [],
  evaluation_reports: [],
  cleanup_reports: []
};

const outPath = readArg('--out');
if (outPath) {
  const absoluteOut = path.resolve(repoRoot, outPath);
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
  fs.writeFileSync(absoluteOut, `${JSON.stringify(artifact, null, 2)}\n`);
}

if (hasFlag('--json') || !outPath) {
  console.log(JSON.stringify(artifact, null, 2));
} else {
  console.log(outPath);
}
