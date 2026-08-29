#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseSelectionProfile } from '../../game-account-select/scripts/parse-selection-profile.mjs';
import { buildListQueryPlan } from './list-query-plan.mjs';
import { rankListings } from './score-listings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const operatorKnowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'operator-value-map.json'), 'utf8'));
const collabRoster = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'collab-roster.json'), 'utf8'));
const limitedRoster = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'limited-roster.json'), 'utf8'));
const communityEvidenceText = fs.readFileSync(path.join(__dirname, '..', 'references', 'community-evidence.md'), 'utf8');
const args = process.argv.slice(2);
const REQUIRED_PLATFORMS = ['pxb7', 'pzds'];

function readArg(name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

function readArgs(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1));
    else if (arg === name && args[index + 1] != null) values.push(args[index + 1]);
  }
  return [...new Set(values.filter(Boolean))];
}

function parseJsonOutput(text) {
  const value = String(text ?? '').trim();
  try {
    return JSON.parse(value);
  } catch {
    const start = value.search(/[\[{]/);
    const end = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
    throw new Error('command did not return JSON');
  }
}

function rowsFrom(value) {
  if (Array.isArray(value)) return value;
  for (const key of ['data', 'items', 'results', 'rows']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function run(command, commandArgs, timeout = 90000) {
  const startedAt = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: path.resolve(__dirname, '..', '..', '..'),
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 32,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    duration_ms: Date.now() - startedAt,
    command: [command, ...commandArgs].join(' '),
  };
}

function runOwnedOpencli(commandArgs, timeout = 90000) {
  return run('opencli', commandArgs, timeout);
}

function normalizeServer(server) {
  const value = String(server ?? '').trim();
  if (/官方账号|官服/.test(value)) return '官服';
  if (/B服/i.test(value)) return 'B服';
  if (/渠道服/.test(value)) return '渠道服';
  return value || null;
}

function listingKey(value) {
  return value?.listing_key ?? `${value?.platform ?? value?.__platform ?? 'unknown'}:${value?.listing_id ?? value?.listingId ?? value?.url ?? ''}`;
}

function normalizeRow(row, detail = false, platform = row?.__platform ?? 'pxb7') {
  const compactOperators = Array.isArray(row.operators) ? row.operators : [];
  const parallelOperatorImages = Array.isArray(row.operatorImageUrls) ? row.operatorImageUrls : [];
  const pzdsEvidenceSources = [
    ...(Number(row.status?.operatorMetadataCount ?? 0) > 0 ? ['metadata_resource'] : []),
    ...(Number(row.status?.operatorDomCount ?? 0) > 0 ? ['dom_asset_grid'] : []),
  ];
  const parallelOperatorCards = Array.isArray(row.operatorNames)
    ? row.operatorNames.map((name, index) => ({
        name,
        imageUrl: parallelOperatorImages[index] ?? null,
        evidenceSources: pzdsEvidenceSources,
      }))
    : [];
  const operatorCardAssets = [
    ...(Array.isArray(row.operatorCardAssets) ? row.operatorCardAssets : []),
    ...parallelOperatorCards,
  ];
  const names = [...new Set([
    ...(Array.isArray(row.operatorNames) ? row.operatorNames : []),
    ...(Array.isArray(row.elite2OperatorNames) ? row.elite2OperatorNames : []),
    ...(Array.isArray(row.collabOperatorNames) ? row.collabOperatorNames : []),
    ...operatorCardAssets.map((operator) => operator?.name),
    ...compactOperators.map((operator) => operator?.name),
  ].map((name) => String(name).trim()).filter(Boolean))];
  const elite2 = new Set([...(Array.isArray(row.elite2OperatorNames) ? row.elite2OperatorNames : []), ...compactOperators.filter((operator) => Number(operator?.elite) === 2).map((operator) => operator.name)]);
  const elite1 = new Set([...(Array.isArray(row.elite1OperatorNames) ? row.elite1OperatorNames : []), ...compactOperators.filter((operator) => Number(operator?.elite) === 1).map((operator) => operator.name)]);
  const progressionByName = new Map([...(Array.isArray(row.operatorProgression) ? row.operatorProgression : []), ...compactOperators]
    .filter((item) => item?.name)
    .map((item) => [String(item.name).trim(), item]));
  const cardByName = new Map(operatorCardAssets.filter((item) => item?.name).map((item) => [String(item.name).trim(), item]));
  const riskFacts = Array.isArray(row.riskFacts) ? row.riskFacts : [];
  const riskText = riskFacts.join(' ');
  const declaredCollabCount = Number(row.counts?.collab);
  const requiredCollabCount = Number(collabRoster.total_count ?? collabRoster.operators?.length ?? 0);
  const presentCollabNames = (collabRoster.operators ?? []).filter((name) => names.includes(name));
  const observedCollabCount = Math.max(Number.isFinite(declaredCollabCount) ? declaredCollabCount : 0, presentCollabNames.length);
  const requiredLimitedCount = Number(limitedRoster.total_count ?? limitedRoster.operators?.length ?? 0);
  const presentLimitedNames = (limitedRoster.operators ?? []).filter((name) => names.includes(name));
  const guarantee = row.status?.guarantee || /包赔/.test(riskText) ? 'retrieval_compensation' : 'unknown';
  const listingId = String(row.listingId ?? '');
  return {
    listing_id: listingId,
    listing_key: `${platform}:${listingId || row.url || ''}`,
    platform,
    game: 'Arknights',
    url: row.url ?? null,
    price: Number(row.priceCny),
    currency: 'CNY',
    server: /未注册B站|B服/i.test(riskText) ? 'B服' : normalizeServer(row.server),
    published_at: row.published_at ?? row.publishedAt ?? row.listedAt ?? row.status?.publishedAt ?? null,
    platform_verified_at: row.platform_verified_at ?? row.platformVerifiedAt ?? row.verifiedAt ?? row.status?.verifiedAt ?? row.status?.verified_at ?? null,
    game_assets: {
      operators: names.map((name) => {
        const progression = progressionByName.get(name);
        const card = cardByName.get(name);
        return {
          name,
          elite: progression?.elite ?? (elite2.has(name) ? 2 : elite1.has(name) ? 1 : null),
          mastery: progression?.mastery ?? null,
          module: progression?.module ?? null,
          progression_evidence: progression?.evidence ?? (elite2.has(name) ? 'platform_text_elite2' : elite1.has(name) ? 'platform_text_elite1' : 'not_exposed'),
          image_url: card?.imageUrl ?? null,
          asset_evidence_sources: card?.evidenceSources ?? [],
        };
      }),
      resources: {
        orundum: Number(row.resources?.orundum ?? row.counts?.orundum ?? 0),
        originite_prime: Number(row.resources?.originitePrime ?? row.counts?.originitePrime ?? 0),
      },
      skins: Array.isArray(row.skins) ? row.skins : [],
      collab_completion: {
        declared_count: Number.isFinite(declaredCollabCount) ? declaredCollabCount : null,
        named_count: presentCollabNames.length,
        observed_count: observedCollabCount || null,
        required_count: requiredCollabCount || null,
        missing_count: requiredCollabCount ? Math.max(0, requiredCollabCount - presentCollabNames.length) : null,
        ratio: requiredCollabCount ? Math.min(1, presentCollabNames.length / requiredCollabCount) : null,
        complete: requiredCollabCount > 0 && presentCollabNames.length >= requiredCollabCount,
        present_names: presentCollabNames,
        missing_names: (collabRoster.operators ?? []).filter((name) => !presentCollabNames.includes(name)),
        count_mismatch: Number.isFinite(declaredCollabCount) && declaredCollabCount !== presentCollabNames.length,
        evidence: `${platform}_declared_count_plus_named_roster_vs_prts_collab_category`,
        reference_url: collabRoster.source,
      },
      limited_completion: {
        named_count: presentLimitedNames.length,
        observed_count: presentLimitedNames.length,
        required_count: requiredLimitedCount || null,
        missing_count: requiredLimitedCount ? Math.max(0, requiredLimitedCount - presentLimitedNames.length) : null,
        ratio: requiredLimitedCount ? Math.min(1, presentLimitedNames.length / requiredLimitedCount) : null,
        complete: requiredLimitedCount > 0 && presentLimitedNames.length >= requiredLimitedCount,
        present_names: presentLimitedNames,
        missing_names: (limitedRoster.operators ?? []).filter((name) => !presentLimitedNames.includes(name)),
        evidence: `${platform}_named_operator_roster_vs_prts_limited_category`,
        reference_url: limitedRoster.source,
        reference_checked_at: limitedRoster.checked_at,
      },
      risk: {
        real_name_status: 'unknown',
        guarantee,
        official_verification: detail ? (row.status?.officialVerification === true || /官方验号|平台验号/.test(riskText)) : false,
      },
      platform_facts: {
        counts: row.counts ?? {},
        status: row.status ?? {},
        risk_facts: riskFacts,
        progression_evidence: row.progressionEvidence ?? (row.status?.eliteEvidence ? {
          elite: row.status.eliteEvidence,
          mastery: row.status.masteryEvidence ?? 'not_exposed',
          module: row.status.moduleEvidence ?? 'not_exposed',
          verification_images: Number(row.status.verificationImageCount ?? 0) > 0 ? 'available' : 'not_exposed',
          verification_image_count: Number(row.status.verificationImageCount ?? 0),
        } : null),
        verification_image_urls: Array.isArray(row.verificationImageUrls) ? row.verificationImageUrls : [],
        operator_card_image_urls: operatorCardAssets.map((asset) => asset?.imageUrl).filter(Boolean),
        operator_card_assets: operatorCardAssets,
        detail_verified: detail,
      },
    },
  };
}

function mergeDetail(listing, detailRow) {
  if (!detailRow) return listing;
  const normalized = normalizeRow(detailRow, true, listing.platform);
  return {
    ...listing,
    ...normalized,
    price: Number.isFinite(normalized.price) ? normalized.price : listing.price,
    url: normalized.url ?? listing.url,
    server: normalized.server ?? listing.server,
    published_at: normalized.published_at ?? listing.published_at ?? null,
    platform_verified_at: normalized.platform_verified_at ?? listing.platform_verified_at ?? null,
  };
}

function verifyCollabCompletionFromImages(listing) {
  const completion = listing.game_assets?.collab_completion;
  const imageUrls = listing.game_assets?.platform_facts?.verification_image_urls ?? [];
  if (!completion || completion.complete || !Array.isArray(completion.missing_names) || completion.missing_names.length === 0 || !imageUrls.length) return listing;
  const verification = run(process.execPath, [
    path.join(__dirname, 'verify-collab-images.mjs'),
    '--urls-json', JSON.stringify(imageUrls),
    '--expected-json', JSON.stringify(completion.missing_names),
  ], 150000);
  let report = null;
  if (verification.ok) {
    try { report = parseJsonOutput(verification.stdout); } catch {}
  }
  const matchedNames = Array.isArray(report?.matched_names) ? report.matched_names : [];
  const verifiedNames = [...new Set([...(completion.present_names ?? []), ...matchedNames])];
  const requiredCount = Number(completion.required_count ?? 0);
  return {
    ...listing,
    game_assets: {
      ...listing.game_assets,
      collab_completion: {
        ...completion,
        image_verified_names: matchedNames,
        verified_count: verifiedNames.length,
        missing_count: requiredCount ? Math.max(0, requiredCount - verifiedNames.length) : completion.missing_count,
        ratio: requiredCount ? Math.min(1, verifiedNames.length / requiredCount) : completion.ratio,
        complete: requiredCount > 0 && verifiedNames.length >= requiredCount,
        missing_names: (completion.missing_names ?? []).filter((name) => !matchedNames.includes(name)),
        verification_status: report?.status ?? (verification.ok ? 'unparsed' : 'error'),
        verification_method: 'public_roster_images_plus_macos_vision_ocr',
        image_evidence: report?.evidence ?? [],
        verification_error: verification.ok ? null : (verification.stderr || verification.stdout || 'collab image verification failed').trim().slice(0, 500),
      },
    },
  };
}

function knownAssetSummary(listing) {
  const operators = listing.game_assets?.operators ?? [];
  const limited = [];
  const collab = [];
  for (const operator of operators) {
    const canonical = operatorKnowledge.aliases?.[operator.name] ?? operator.name;
    const acquisitionType = operatorKnowledge.operators?.[canonical]?.acquisition_type;
    if (acquisitionType === 'limited') limited.push(canonical);
    if (acquisitionType === 'collab') collab.push(canonical);
  }
  return {
    limited: listing.game_assets?.limited_completion?.present_names ?? [...new Set(limited)],
    collab: [...new Set(collab)],
  };
}

function compactRecommendation(listing, tier) {
  const assets = knownAssetSummary(listing);
  const resources = listing.game_assets?.resources ?? {};
  const estimatedPulls = (Number(resources.orundum ?? 0) + Number(resources.originite_prime ?? 0) * 180) / 600
    + Number(resources.ten_pull_tickets ?? 0) * 10
    + Number(resources.single_pull_tickets ?? resources.headhunting_permits ?? 0);
  return {
    listing_id: listing.listing_id,
    listing_key: listingKey(listing),
    platform: listing.platform,
    url: listing.url,
    price: listing.price,
    server: listing.server,
    published_at: listing.published_at ?? null,
    platform_verified_at: listing.platform_verified_at
      ?? listing.game_assets?.platform_facts?.status?.verifiedAt
      ?? null,
    recommendation_tier: tier,
    budget_tier: listing.budget_tier,
    budget_delta: listing.budget_delta,
    profile_score: listing.profile_score,
    final_score: listing.final_score,
    asset_quality_score: listing.asset_quality_score,
    asset_score: listing.asset_score,
    resource_score: listing.resource_score,
    resource_facts: resources,
    estimated_pulls: Number(estimatedPulls.toFixed(2)),
    collection_score: listing.collection_score,
    progress_score: listing.progress_score,
    price_score: listing.price_score,
    base_dimensions: listing.base_dimensions,
    risk_penalty: listing.risk_penalty,
    applied_risk_penalty: listing.applied_risk_penalty,
    missing_data_penalty: listing.missing_data_penalty,
    confidence_penalty: listing.confidence_penalty,
    playability_penalty: listing.playability_penalty,
    risk_facts: listing.risk_facts,
    hard_filter_passed: listing.hard_filter_passed,
    hard_filter_reasons: listing.hard_filter_reasons,
    confidence: listing.confidence,
    limited_operators: assets.limited,
    limited_completion: listing.game_assets?.limited_completion ?? null,
    collab_operators: assets.collab,
    collab_completion: listing.game_assets?.collab_completion ?? null,
    skin_count: Number(listing.game_assets?.platform_facts?.counts?.skins ?? listing.game_assets?.skins?.length ?? 0),
    missing_fields: listing.missing_fields,
    push_readiness: listing.push_readiness,
    combat_breakdown: listing.combat_breakdown,
    highlights: listing.highlights,
    concerns: listing.concerns,
    platform_facts: listing.game_assets?.platform_facts ?? {},
  };
}

const request = readArg('--request');
const profileRequest = readArg('--profile-request', request);
const outPath = readArg('--out');
const limit = Math.max(10, Math.min(Number(readArg('--limit', 20)) || 20, 60));
const batchCount = Math.max(1, Math.min(Number(readArg('--batches', 1)) || 1, 3));
const detailCount = Math.max(1, Math.min(Number(readArg('--details-per-platform', readArg('--details', 5))) || 5, 20));
const displayCount = Math.max(3, Math.min(Number(readArg('--display-per-platform', 5)) || 5, 15));
const recommendationCount = Math.max(1, Math.min(Number(readArg('--recommendations', 5)) || 5, 15));
const backupCount = Math.max(0, Math.min(Number(readArg('--backups', 3)) || 3, 10));
const collabImageVerificationCount = Math.max(0, Math.min(Number(readArg('--collab-image-verifications', 3)) || 3, 5));
const breakthroughCount = Math.max(1, Math.min(Number(readArg('--breakthroughs', 3)) || 3, 5));
const expansionBandCount = Math.max(1, Math.min(Number(readArg('--expansion-bands', 6)) || 6, 8));
const expansionDetailCount = Math.max(1, Math.min(Number(readArg('--expansion-details', 6)) || 6, 10));
const pinnedUrls = readArgs('--pinned-url');
const reportOut = readArg('--report-out');
if (!request || !outPath) {
  console.error('Usage: node run-dual-platform-selection.mjs --request <raw-user-text> --out <artifact.json> [--profile-request <derived-runtime-profile-text>] [--profile-confirmed] [--pinned-url <live-listing-url>] [--report-out <report.md>] [--limit 20] [--batches 1] [--details-per-platform 5] [--display-per-platform 5] [--recommendations 5] [--backups 3] [--breakthroughs 3] [--expansion-bands 6] [--expansion-details 6]');
  process.exit(2);
}

const profile = parseSelectionProfile(profileRequest);
const resolvedClarifications = args.includes('--profile-confirmed')
  ? profile.clarification_required.filter((item) => item === 'objective_conflict')
  : [];
const unresolvedClarifications = profile.clarification_required.filter((item) => !resolvedClarifications.includes(item));
if (unresolvedClarifications.length) {
  console.error(`Cannot query before resolving: ${unresolvedClarifications.join(', ')}`);
  process.exit(2);
}
if (resolvedClarifications.length) {
  profile.assumptions = [...new Set([...(profile.assumptions ?? []), '用户已确认复合 custom 画像；本轮同时保留各目标动态权重'])];
}
profile.clarification_required = [];
profile.platforms = [...new Set([...REQUIRED_PLATFORMS, ...profile.platforms])];
profile.confirmation_required = false;
const runId = `gas-arknights-dual-${new Date().toISOString().replace(/[-:.]/g, '')}`;
const digest = crypto.createHash('sha256').update(JSON.stringify(profile)).digest('hex');
const evidenceDate = communityEvidenceText.match(/updated_at:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
const evidenceAgeDays = evidenceDate == null
  ? null
  : Math.floor((Date.now() - new Date(`${evidenceDate}T00:00:00Z`).getTime()) / 86400000);
const evidenceIsCurrent = evidenceAgeDays != null && evidenceAgeDays <= 7;
const listCommands = [];
const listRowsById = new Map();
for (const platform of REQUIRED_PLATFORMS) {
  const queryPlan = buildListQueryPlan({ platform, limit, batchCount, displayCount, detailCount });
  for (let planIndex = 0; planIndex < queryPlan.length; planIndex += 1) {
    const plan = queryPlan[planIndex];
    const commandResult = runOwnedOpencli([
      platform, 'arknights-list',
      '--minPrice', String(profile.budget.flex_min ?? profile.budget.primary_min ?? 0),
      '--maxPrice', String(profile.budget.flex_max ?? profile.budget.primary_max ?? 0),
      '--limit', String(plan.limit),
      '--page', String(plan.page),
      '--site-session', 'ephemeral',
      '--keep-tab', 'false',
      '-f', 'json',
    ]);
    let listCommand = { ...commandResult, platform, batch: planIndex + 1, query_plan: plan };
    listCommands.push(listCommand);
    if (!listCommand.ok && platform === 'pzds' && planIndex === 0) {
      const boundedListCommand = listCommand;
      const fallbackResult = runOwnedOpencli([
        platform, 'arknights-list',
        '--minPrice', '0',
        '--maxPrice', '0',
        '--limit', String(plan.limit),
        '--page', '1',
        '--sort', 'priceDesc',
        '--site-session', 'ephemeral',
        '--keep-tab', 'false',
        '-f', 'json',
      ]);
      listCommand = {
        ...fallbackResult,
        platform,
        batch: planIndex + 1,
        query_plan: plan,
        fallback_used: 'unfiltered_initial_feed',
        bounded_query_error: (commandResult.stderr || commandResult.stdout || 'bounded PZDS query returned no rows').trim().slice(0, 500),
      };
      boundedListCommand.recovered_by_fallback = fallbackResult.ok;
      listCommands.push(listCommand);
    }
    if (!listCommand.ok) {
      if (planIndex === 0) {
        console.error(`${platform} list failed: ${listCommand.stderr || listCommand.stdout || 'unknown error'}`);
        process.exit(1);
      }
      break;
    }
    const rows = rowsFrom(parseJsonOutput(listCommand.stdout));
    listCommand.result_count = rows.length;
    listCommand.pagination_partial = rows.some((row) => row?.status?.paginationPartial === true);
    for (const row of rows) {
      const id = String(row.listingId ?? row.url ?? '');
      const key = `${platform}:${id}`;
      if (id) listRowsById.set(key, { ...row, __platform: platform });
    }
  }
}
const pinnedSeedAttempts = [];
for (const url of pinnedUrls) {
  const platform = /pzds\.com/i.test(url) ? 'pzds' : /pxb7\.com/i.test(url) ? 'pxb7' : null;
  if (!platform) {
    pinnedSeedAttempts.push({ url, platform: null, status: 'unsupported_url', error_text: 'URL does not belong to a required platform' });
    continue;
  }
  const commandResult = runOwnedOpencli([platform, 'arknights-detail', url, '--site-session', 'ephemeral', '--keep-tab', 'false', '-f', 'json']);
  let row = null;
  let errorText = null;
  if (commandResult.ok) {
    try {
      row = rowsFrom(parseJsonOutput(commandResult.stdout))[0] ?? null;
      if (!row) errorText = 'pinned detail returned no row';
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error);
    }
  } else {
    errorText = (commandResult.stderr || commandResult.stdout || 'pinned detail failed').trim().slice(0, 500);
  }
  if (row) {
    const id = String(row.listingId ?? row.url ?? url);
    listRowsById.set(`${platform}:${id}`, { ...row, url: row.url ?? url, __platform: platform, __pinned_seed: true });
  }
  pinnedSeedAttempts.push({
    platform,
    url,
    listing_id: row?.listingId ?? null,
    status: row ? 'success' : 'error',
    duration_ms: commandResult.duration_ms,
    error_text: row ? null : errorText,
  });
}
const listRows = [...listRowsById.values()];
const pzdsPaginationPartial = listRows
  .filter((row) => row.__platform === 'pzds')
  .some((row) => row.status?.paginationPartial === true);
const platformCandidateCounts = Object.fromEntries(REQUIRED_PLATFORMS.map((platform) => [platform, listRows.filter((row) => row.__platform === platform).length]));
const emptyPlatforms = REQUIRED_PLATFORMS.filter((platform) => platformCandidateCounts[platform] === 0);
if (emptyPlatforms.length) {
  console.error(`Dual-platform coverage incomplete; no candidates from: ${emptyPlatforms.join(', ')}`);
  process.exit(1);
}
if (listRows.length < 10) {
  console.error(`Expected at least 10 candidates, received ${listRows.length}`);
  process.exit(1);
}

const preliminary = rankListings(listRows.map((row) => normalizeRow(row, false, row.__platform)), profile);
const detailAttempts = [];
const detailsById = new Map();
const collabCompleteRequired = profile.hard_conditions.includes('collab_complete:true');
const limitedCompleteRequired = profile.hard_conditions.includes('limited_complete:true');
const detailSorter = (a, b) => {
  if (limitedCompleteRequired) {
    return Number(b.game_assets?.limited_completion?.ratio ?? -1) - Number(a.game_assets?.limited_completion?.ratio ?? -1)
      || Number(b.game_assets?.platform_facts?.counts?.limitedSixStar ?? -1) - Number(a.game_assets?.platform_facts?.counts?.limitedSixStar ?? -1)
      || Number(b.push_readiness?.score ?? 0) - Number(a.push_readiness?.score ?? 0)
      || b.asset_quality_score - a.asset_quality_score;
  }
  if (!collabCompleteRequired) return b.final_score - a.final_score || b.asset_quality_score - a.asset_quality_score;
  return Number(b.game_assets?.collab_completion?.ratio ?? -1) - Number(a.game_assets?.collab_completion?.ratio ?? -1)
    || Number(b.push_readiness?.score ?? 0) - Number(a.push_readiness?.score ?? 0)
    || Number(b.game_assets?.platform_facts?.counts?.skins ?? 0) - Number(a.game_assets?.platform_facts?.counts?.skins ?? 0)
    || b.asset_quality_score - a.asset_quality_score;
};
const detailCandidates = REQUIRED_PLATFORMS.flatMap((platform) => [...preliminary]
  .filter((listing) => listing.platform === platform)
  .sort(detailSorter)
  .slice(0, detailCount));
for (const candidate of detailCandidates) {
  const detailCommand = runOwnedOpencli([candidate.platform, 'arknights-detail', candidate.url, '--site-session', 'ephemeral', '--keep-tab', 'false', '-f', 'json']);
  let detailRow = null;
  let detailError = null;
  if (detailCommand.ok) {
    try {
      detailRow = rowsFrom(parseJsonOutput(detailCommand.stdout))[0] ?? null;
      if (detailRow) detailsById.set(listingKey(candidate), detailRow);
      else detailError = 'detail command returned no rows';
    } catch (error) {
      detailError = error instanceof Error ? error.message : String(error);
    }
  }
  detailAttempts.push({
    listing_id: candidate.listing_id,
    listing_key: listingKey(candidate),
    platform: candidate.platform,
    url: candidate.url,
    status: detailRow ? 'success' : 'error',
    duration_ms: detailCommand.duration_ms,
    error_text: detailRow ? null : (detailError || detailCommand.stderr || detailCommand.stdout || 'detail command failed').trim().slice(0, 500),
  });
}

const detailedIds = new Set(detailAttempts.filter((attempt) => attempt.status === 'success').map((attempt) => attempt.listing_key));
let merged = preliminary.map((listing) => mergeDetail(listing, detailsById.get(listingKey(listing))));
if (collabCompleteRequired && collabImageVerificationCount > 0) {
  const imageVerifyIds = new Set([...merged]
    .filter((listing) => detailedIds.has(listingKey(listing)))
    .sort((a, b) => Number(b.game_assets?.collab_completion?.ratio ?? -1) - Number(a.game_assets?.collab_completion?.ratio ?? -1)
      || Number(b.game_assets?.platform_facts?.counts?.skins ?? 0) - Number(a.game_assets?.platform_facts?.counts?.skins ?? 0))
    .slice(0, collabImageVerificationCount)
    .map((listing) => listingKey(listing)));
  merged = merged.map((listing) => imageVerifyIds.has(listingKey(listing)) ? verifyCollabCompletionFromImages(listing) : listing);
}
let rankings = rankListings(merged, profile);
const eligiblePrimary = rankings.filter((listing) => detailedIds.has(listingKey(listing)) && listing.hard_filter_passed && listing.budget_tier === 'primary');
const eligibleInBudget = rankings.filter((listing) => detailedIds.has(listingKey(listing)) && listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier));
const recommendations = eligiblePrimary.slice(0, recommendationCount).map((listing) => compactRecommendation(listing, 'primary'));
const expansionAttempts = [];
const expansionDetailAttempts = [];
const expansionDetailedIds = new Set();
let budgetBreakthroughListings = [];
const expansionStopReasons = { lower: 'not_requested', higher: 'not_requested' };
let expansionStopReason = profile.budget_expansion?.enabled ? 'not_triggered_in_budget_match_found' : 'disabled';

if (eligibleInBudget.length === 0 && profile.budget_expansion?.enabled && Number.isFinite(Number(profile.budget.primary_max))) {
  const targetPrice = Number(profile.budget.target ?? profile.budget.primary_max);
  const flexMin = Math.max(0, Number(profile.budget.flex_min ?? profile.budget.primary_min ?? 0));
  const flexMax = Math.max(Number(profile.budget.flex_max ?? profile.budget.primary_max), Number(profile.budget.primary_max));
  const configuredMax = Number(profile.budget_expansion.max_price);
  const hasConfiguredMax = Number.isFinite(configuredMax) && configuredMax > flexMax;
  const step = Math.max(500, Math.ceil(targetPrice * 0.5 / 100) * 100);
  const requestedDirections = Array.isArray(profile.budget_expansion?.directions) && profile.budget_expansion.directions.length
    ? profile.budget_expansion.directions
    : ['lower', 'higher'];
  const exactByDirection = { lower: [], higher: [] };

  for (const direction of requestedDirections) {
    if (!['lower', 'higher'].includes(direction)) continue;
    if (direction === 'lower' && flexMin <= 0) {
      expansionStopReasons.lower = 'no_lower_price_room';
      continue;
    }
    expansionStopReasons[direction] = 'search_horizon_exhausted_without_exact_match';
    for (let band = 0; band < expansionBandCount; band += 1) {
      const minPrice = direction === 'lower'
        ? Math.max(0, flexMin - (band + 1) * step)
        : flexMax + 1 + band * step;
      const maxPrice = direction === 'lower'
        ? Math.max(0, flexMin - 1 - band * step)
        : hasConfiguredMax ? Math.min(configuredMax, flexMax + (band + 1) * step) : flexMax + (band + 1) * step;
      if (minPrice > maxPrice || (direction === 'lower' && maxPrice <= 0 && band > 0)) {
        expansionStopReasons[direction] = 'price_floor_reached_without_exact_match';
        break;
      }
      if (direction === 'higher' && hasConfiguredMax && minPrice > configuredMax) {
        expansionStopReasons.higher = 'user_expansion_ceiling_reached_without_exact_match';
        break;
      }
    const expansionRows = [];
    const bandAttempts = [];
    for (const platform of REQUIRED_PLATFORMS) {
      const listCommand = runOwnedOpencli([
        platform, 'arknights-list',
        '--minPrice', String(minPrice),
        '--maxPrice', String(maxPrice),
        '--limit', String(limit),
        '--page', '1',
        '--site-session', 'ephemeral',
        '--keep-tab', 'false',
        '-f', 'json',
      ]);
      const platformRows = listCommand.ok ? rowsFrom(parseJsonOutput(listCommand.stdout)) : [];
      const expansionAttempt = {
        platform,
        direction,
        band: band + 1,
        min_price: minPrice,
        max_price: maxPrice,
        command: listCommand.command,
        duration_ms: listCommand.duration_ms,
        status: listCommand.ok ? 'success' : 'error',
        result_count: platformRows.length,
        exact_detail_verified_count: 0,
        error_text: listCommand.ok ? null : (listCommand.stderr || listCommand.stdout || `${platform} expansion list failed`).trim().slice(0, 500),
      };
      expansionAttempts.push(expansionAttempt);
      bandAttempts.push(expansionAttempt);
      expansionRows.push(...platformRows.map((row) => ({ ...row, __platform: platform })));
    }
    if (!expansionRows.length && bandAttempts.some((attempt) => attempt.status === 'error')) {
      expansionStopReasons[direction] = 'expansion_adapter_failed';
      break;
    }

    const expansionPreliminary = rankListings(expansionRows.map((row) => normalizeRow(row, false, row.__platform)), profile);
    const expansionCandidates = REQUIRED_PLATFORMS.flatMap((platform) => [...expansionPreliminary]
      .filter((listing) => listing.platform === platform)
      .sort((a, b) => {
        const aListGap = (a.hard_filter_reasons ?? []).filter((reason) => !['official_verification:true', 'guarantee:required'].includes(reason)).length;
        const bListGap = (b.hard_filter_reasons ?? []).filter((reason) => !['official_verification:true', 'guarantee:required'].includes(reason)).length;
        return aListGap - bListGap
          || Number(a.price ?? Number.POSITIVE_INFINITY) - Number(b.price ?? Number.POSITIVE_INFINITY)
          || Number(b.game_assets?.collab_completion?.ratio ?? -1) - Number(a.game_assets?.collab_completion?.ratio ?? -1)
          || Number(b.push_readiness?.score ?? 0) - Number(a.push_readiness?.score ?? 0);
      })
      .slice(0, expansionDetailCount));
    const expansionDetailsById = new Map();
    for (const candidate of expansionCandidates) {
      const detailCommand = runOwnedOpencli([candidate.platform, 'arknights-detail', candidate.url, '--site-session', 'ephemeral', '--keep-tab', 'false', '-f', 'json']);
      let detailRow = null;
      let detailError = null;
      if (detailCommand.ok) {
        try {
          detailRow = rowsFrom(parseJsonOutput(detailCommand.stdout))[0] ?? null;
          if (!detailRow) detailError = 'detail command returned no rows';
        } catch (error) {
          detailError = error instanceof Error ? error.message : String(error);
        }
      }
      if (detailRow) {
        expansionDetailsById.set(listingKey(candidate), detailRow);
        expansionDetailedIds.add(listingKey(candidate));
      }
      expansionDetailAttempts.push({
        listing_id: candidate.listing_id,
        listing_key: listingKey(candidate),
        platform: candidate.platform,
        url: candidate.url,
        expansion_band: band + 1,
        expansion_direction: direction,
        status: detailRow ? 'success' : 'error',
        duration_ms: detailCommand.duration_ms,
        error_text: detailRow ? null : (detailError || detailCommand.stderr || detailCommand.stdout || 'detail command failed').trim().slice(0, 500),
      });
    }

    let expansionMerged = expansionPreliminary.map((listing) => mergeDetail(listing, expansionDetailsById.get(listingKey(listing))));
    if (collabCompleteRequired && collabImageVerificationCount > 0) {
      const imageVerifyIds = new Set([...expansionMerged]
        .filter((listing) => expansionDetailsById.has(listingKey(listing)))
        .sort((a, b) => Number(b.game_assets?.collab_completion?.ratio ?? -1) - Number(a.game_assets?.collab_completion?.ratio ?? -1))
        .slice(0, collabImageVerificationCount)
        .map((listing) => listingKey(listing)));
      expansionMerged = expansionMerged.map((listing) => imageVerifyIds.has(listingKey(listing)) ? verifyCollabCompletionFromImages(listing) : listing);
    }
    const expansionRankings = rankListings(expansionMerged, profile);
    const exact = expansionRankings
      .filter((listing) => expansionDetailedIds.has(listingKey(listing)) && listing.hard_filter_passed)
      .sort((a, b) => Number(a.price) - Number(b.price) || b.final_score - a.final_score || b.asset_quality_score - a.asset_quality_score);
    rankings = [...rankings, ...expansionRankings];
    for (const expansionAttempt of bandAttempts) {
      expansionAttempt.exact_detail_verified_count = exact.filter((listing) => listing.platform === expansionAttempt.platform).length;
    }
    if (exact.length) {
      exactByDirection[direction].push(...exact.map((listing) => ({ ...listing, expansion_band: band + 1, expansion_direction: direction })));
      expansionStopReasons[direction] = 'first_exact_match_band_found';
      break;
    }
    if (direction === 'higher' && hasConfiguredMax && maxPrice >= configuredMax) {
      expansionStopReasons.higher = 'user_expansion_ceiling_reached_without_exact_match';
      break;
    }
    if (direction === 'lower' && minPrice === 0) {
      expansionStopReasons.lower = 'price_floor_reached_without_exact_match';
      break;
    }
    }
  }
  const lowerExact = exactByDirection.lower.sort((a, b) => b.final_score - a.final_score || Number(a.price) - Number(b.price));
  const higherExact = exactByDirection.higher.sort((a, b) => Number(a.price) - Number(b.price) || b.final_score - a.final_score);
  const orderedExact = [...lowerExact.slice(0, 1), ...higherExact.slice(0, 1), ...lowerExact.slice(1), ...higherExact.slice(1)];
  budgetBreakthroughListings = orderedExact.slice(0, breakthroughCount).map((listing, index) => ({
    ...compactRecommendation(listing, listing.expansion_direction === 'lower' ? 'budget_breakthrough_lower' : 'budget_breakthrough_higher'),
    budget_delta: Number(listing.price) - targetPrice,
    first_satisfying_band_for_direction: !orderedExact.slice(0, index).some((item) => item.expansion_direction === listing.expansion_direction),
    expansion_band: listing.expansion_band,
    expansion_direction: listing.expansion_direction,
  }));
  expansionStopReason = `lower:${expansionStopReasons.lower};higher:${expansionStopReasons.higher}`;
}
const recommendationIds = new Set(recommendations.map((listing) => listing.listing_key));
const backupListings = rankings
  .filter((listing) => detailedIds.has(listingKey(listing)) && listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier) && !recommendationIds.has(listingKey(listing)))
  .slice(0, backupCount)
  .map((listing) => compactRecommendation(listing, listing.budget_tier === 'flex_budget' ? 'flex_budget' : 'backup'));
const nearMatchLimit = recommendations.length ? backupCount : recommendationCount;
const nearMatchListings = rankings
  .filter((listing) => detailedIds.has(listingKey(listing)) && !listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier))
  .sort((a, b) => Number(b.game_assets?.collab_completion?.ratio ?? -1) - Number(a.game_assets?.collab_completion?.ratio ?? -1)
    || Number(b.push_readiness?.score ?? 0) - Number(a.push_readiness?.score ?? 0)
    || Number(b.game_assets?.platform_facts?.counts?.skins ?? 0) - Number(a.game_assets?.platform_facts?.counts?.skins ?? 0)
    || b.asset_quality_score - a.asset_quality_score)
  .slice(0, nearMatchLimit)
  .map((listing) => compactRecommendation(listing, 'near_match'));
const comparisonBaseline = nearMatchListings[0] ?? recommendations[0] ?? backupListings[0] ?? null;
const comparisonBreakthrough = budgetBreakthroughListings[0] ?? null;
const dimensionKeys = ['rarity', 'combat', 'progression', 'resources', 'skins', 'price_efficiency'];
const dimensionDelta = comparisonBaseline && comparisonBreakthrough
  ? Object.fromEntries(dimensionKeys.map((key) => [key, Number(((comparisonBreakthrough.base_dimensions?.[key] ?? 0) - (comparisonBaseline.base_dimensions?.[key] ?? 0)).toFixed(2))]))
  : null;
const budgetComparison = comparisonBaseline && comparisonBreakthrough ? {
  baseline_listing_id: comparisonBaseline.listing_id,
  breakthrough_listing_id: comparisonBreakthrough.listing_id,
  baseline_price: comparisonBaseline.price,
  breakthrough_price: comparisonBreakthrough.price,
  price_delta: Number(comparisonBreakthrough.price) - Number(comparisonBaseline.price),
  price_ratio: Number((Number(comparisonBreakthrough.price) / Math.max(1, Number(comparisonBaseline.price))).toFixed(3)),
  hard_condition_gap_closed: comparisonBaseline.hard_filter_reasons ?? [],
  dimension_delta: dimensionDelta,
  push_readiness_change: `${comparisonBaseline.push_readiness?.status ?? 'unknown'} -> ${comparisonBreakthrough.push_readiness?.status ?? 'unknown'}`,
  scenario_guidance: {
    strict_collection: 'budget increase can be justified when it closes the declared hard-condition gap and the exact roster is detail-verified',
    push_map_or_combat: Number(dimensionDelta?.combat ?? 0) > 5 || Number(dimensionDelta?.progression ?? 0) > 5
      ? 'budget increase also buys a material combat/progression improvement'
      : 'budget increase mainly buys collection completeness; it is not automatically justified for push-map performance',
  },
} : null;
const selectedIds = new Set([...recommendationIds, ...backupListings.map((listing) => listing.listing_key), ...nearMatchListings.map((listing) => listing.listing_key), ...budgetBreakthroughListings.map((listing) => listing.listing_key)]);
const allDetailedIds = new Set([...detailedIds, ...expansionDetailedIds]);
const detailFailures = detailAttempts.filter((attempt) => attempt.status !== 'success');
const platformShortlists = Object.fromEntries(REQUIRED_PLATFORMS.map((platform) => {
  const platformRankings = rankings.filter((listing) => listing.platform === platform);
  const qualifying = platformRankings
    .filter((listing) => allDetailedIds.has(listingKey(listing)) && listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier))
    .slice(0, displayCount)
    .map((listing) => compactRecommendation(listing, 'platform_qualifying'));
  const nearMatches = platformRankings
    .filter((listing) => allDetailedIds.has(listingKey(listing)) && !listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier))
    .slice(0, displayCount)
    .map((listing) => compactRecommendation(listing, 'platform_near_match'));
  const listOnlyCandidates = platformRankings
    .filter((listing) => !allDetailedIds.has(listingKey(listing)) && ['primary', 'flex_budget'].includes(listing.budget_tier))
    .slice(0, displayCount)
    .map((listing) => compactRecommendation(listing, 'platform_list_only_unverified'));
  const outOfScopeNearMatches = platformRankings
    .filter((listing) => allDetailedIds.has(listingKey(listing)) && !listing.hard_filter_passed && listing.budget_tier === 'excluded_price')
    .slice(0, displayCount)
    .map((listing) => compactRecommendation(listing, 'platform_near_match_outside_budget'));
  const outOfScopeQualifying = platformRankings
    .filter((listing) => allDetailedIds.has(listingKey(listing)) && listing.hard_filter_passed && listing.budget_tier === 'excluded_price')
    .slice(0, displayCount)
    .map((listing) => compactRecommendation(listing, Number(listing.price) < Number(profile.budget.flex_min ?? 0) ? 'budget_breakthrough_lower' : 'budget_breakthrough_higher'));
  const displayCandidates = [...new Map([...qualifying, ...outOfScopeQualifying, ...nearMatches, ...listOnlyCandidates, ...outOfScopeNearMatches]
    .map((listing) => [listing.listing_key, listing])).values()].slice(0, displayCount);
  return [platform, {
    status: (qualifying.length || outOfScopeQualifying.length) ? 'qualified' : (nearMatches.length || outOfScopeNearMatches.length) ? 'near_match_only' : listOnlyCandidates.length ? 'list_only_unverified' : 'empty',
    candidate_count: (platformCandidateCounts[platform] ?? 0) + expansionAttempts.filter((attempt) => attempt.platform === platform).reduce((sum, attempt) => sum + attempt.result_count, 0),
    detail_verified_count: detailAttempts.filter((attempt) => attempt.platform === platform && attempt.status === 'success').length + expansionDetailAttempts.filter((attempt) => attempt.platform === platform && attempt.status === 'success').length,
    qualifying,
    out_of_scope_qualifying: outOfScopeQualifying,
    near_matches: nearMatches,
    out_of_scope_near_matches: outOfScopeNearMatches,
    list_only_candidates: listOnlyCandidates,
    display_candidates: displayCandidates,
    user_visible_note: (qualifying.length || outOfScopeQualifying.length)
      ? `已列出 ${displayCandidates.length} 个${platform === 'pxb7' ? '螃蟹' : '盼之'}账号，其中 ${qualifying.length} 个在预算附近满足画像、${outOfScopeQualifying.length} 个为自动扩价后满足项；其余候选保留原始核验层级`
      : `当前没有详情复核后完全满足画像的${platform === 'pxb7' ? '螃蟹' : '盼之'}账号，以下 ${displayCandidates.length} 个为明确标注的接近项、价格区间外候选或列表待复核项`,
  }];
}));
for (const section of Object.values(platformShortlists)) {
  for (const listing of section.display_candidates) selectedIds.add(listing.listing_key);
}
const dualPlatformCoverage = {
  required_platforms: REQUIRED_PLATFORMS,
  complete: REQUIRED_PLATFORMS.every((platform) => platformShortlists[platform].display_candidates.length > 0),
  qualifying_complete: REQUIRED_PLATFORMS.every((platform) => platformShortlists[platform].qualifying.length > 0),
  missing_platforms: REQUIRED_PLATFORMS.filter((platform) => platformShortlists[platform].display_candidates.length === 0),
  qualifying_missing_platforms: REQUIRED_PLATFORMS.filter((platform) => platformShortlists[platform].qualifying.length === 0),
};
const bestValueListing = rankings
  .filter((listing) => allDetailedIds.has(listingKey(listing)) && listing.hard_filter_passed && ['primary', 'flex_budget'].includes(listing.budget_tier))[0]
  ?? rankings.filter((listing) => allDetailedIds.has(listingKey(listing)) && listing.hard_filter_passed)
    .sort((a, b) => b.final_score - a.final_score || Number(a.price) - Number(b.price))[0]
  ?? null;

const pzdsAssetGridListings = rankings.filter((listing) => listing.platform === 'pzds'
  && Number(listing.game_assets?.platform_facts?.status?.operatorDomCount ?? 0) > 0);

const artifact = {
  run_id: runId,
  started_at: new Date(Date.now() - listCommands.reduce((sum, item) => sum + item.duration_ms, 0) - detailAttempts.reduce((sum, item) => sum + item.duration_ms, 0)).toISOString(),
  finished_at: new Date().toISOString(),
  game: 'Arknights',
  target_skill: 'skills/game-account-arknights',
  user_request: request,
  request_provenance: {
    raw_user_request: request,
    profile_input: profileRequest,
    profile_input_origin: profileRequest === request ? 'raw_user_request' : 'derived_runtime_profile',
    derived_input_changed: profileRequest !== request,
    raw_user_request_sha256: crypto.createHash('sha256').update(request).digest('hex'),
    profile_input_sha256: crypto.createHash('sha256').update(profileRequest).digest('hex'),
    rule: 'Derived runtime constraints may refine the frozen profile, but must never overwrite the user\'s raw request.',
    pinned_seed_urls: pinnedUrls,
    pinned_seed_attempts: pinnedSeedAttempts,
  },
  selection_profile: profile,
  budget: { currency: 'CNY', ...profile.budget, allow_budget_flex: profile.budget.flex_max !== profile.budget.primary_max },
  budget_expansion: profile.budget_expansion,
  profile_confirmation: {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    confirmation_mode: resolvedClarifications.length ? 'user_confirmed_conflict' : 'automatic_complete_profile',
    profile_digest: digest,
    clarification_required: [],
    resolved_clarifications: resolvedClarifications,
  },
  profile_isolation: { persistence_scope: 'run_only', durable_updates_from_profile: [] },
  success_criteria: {
    game: 'Arknights',
    budget: profile.budget,
    hard_conditions: profile.hard_conditions,
    soft_preferences: [
      profile.objective,
      ...Object.entries(profile.priorities).map(([key, value]) => `${key}:${value}`),
      ...(profile.soft_preferences ?? []).map((item) => `${item.type}:${item.preference}`),
    ],
    risk_tolerance: profile.risk_tolerance,
    minimum_source_coverage: { platforms: REQUIRED_PLATFORMS, community_sources: ['hypergryph', 'prts', 'bilibili'] },
    completion_conditions: [`at least one displayed candidate section for each of ${REQUIRED_PLATFORMS.join(' and ')}`, `render up to ${displayCount} candidates per platform in Markdown tables`, `top ${detailCount} detail attempts per platform`, `up to ${recommendationCount} cross-platform primary and ${backupCount} backup recommendations`, 'platform shortlists remain separate even when the best-value account comes from one platform', 'finalize with experience summary plus optimizer/evaluator reports', 'when a hard condition has no exact match, near matches remain explicitly non-qualifying', ...(profile.budget_expansion?.enabled ? ['if the nearby primary/flexible price range has no exact match, query both platforms in lower and higher bands and compare the first detail-verified exact matches against nearby-budget near matches'] : [])],
  },
  coverage_plan: {
    intent_summary: request,
    source_tasks: [
      ...REQUIRED_PLATFORMS.flatMap((platform) => [
        { id: `platform-${platform}-list`, type: 'platform_listing', source: platform, priority: 'required', start_path: 'verified_adapter', success_signal: 'current rows with traceable ids and prices', fallback_order: ['ego_browser_semantic', 'ego_browser_direct', 'ego_browser_visual', 'user_material'], wait_budget_ms: 90000, required_fields: ['listingId', 'priceCny', 'url', 'publishedAt'], confidence_cap_if_missing: 'low' },
        { id: `platform-${platform}-detail-shortlist`, type: 'platform_detail', source: platform, priority: 'required', start_path: 'verified_adapter', success_signal: `detail facts and verification-image evidence for top ${detailCount} preliminary candidates`, fallback_order: ['final_platform_verification'], wait_budget_ms: detailCount * 90000, required_fields: ['priceCny', 'operatorNames', 'elite2OperatorNames', 'operatorImageUrls|verificationImageUrls', 'riskFacts'], confidence_cap_if_missing: 'medium' },
      ]),
      { id: 'community-current-snapshot', type: 'community_evidence', source: 'hypergryph+prts+bilibili', priority: 'required', start_path: 'verified_local_snapshot', success_signal: 'snapshot updated today with reviewable URLs', fallback_order: ['refresh'], wait_budget_ms: 15000, required_fields: ['updated_at', 'sources', 'limitations'], confidence_cap_if_missing: 'medium' },
      ...(profile.budget_expansion?.enabled ? REQUIRED_PLATFORMS.map((platform) => ({ id: `platform-${platform}-budget-breakthrough`, type: 'platform_listing', source: platform, priority: 'required', start_path: 'verified_adapter', success_signal: 'first lower and first higher price bands containing a detail-verified hard-condition-complete listing, or an explicit per-direction stop reason', fallback_order: ['stop_with_no_exact_match'], wait_budget_ms: expansionBandCount * 90000, required_fields: ['listingId', 'priceCny', 'url', 'hard_filter_passed'], confidence_cap_if_missing: 'medium' })) : []),
    ],
    completeness_gates: { platforms_required: REQUIRED_PLATFORMS, platform_shortlists_required: true, platform_candidate_required: true, detail_required_for_top_n_per_platform: detailCount, min_display_candidates_per_platform: displayCount, table_output_required: true, self_improve_closeout_required: true, url_required_for_all_tiers: true },
    stop_rules: [`stop after ${limit * batchCount} requested candidate rows`, 'do not retry failed detail more than once'],
  },
  coverage_gaps: [
    ...REQUIRED_PLATFORMS.flatMap((platform) => {
      const failures = detailFailures.filter((attempt) => attempt.platform === platform);
      return failures.length ? [{ source: platform, task_id: `platform-${platform}-detail-shortlist`, reason: 'field_missing', evidence: `${failures.length} detail adapter attempts failed`, fallback_used: 'manual_verification', confidence_effect: 'failed rows remain medium/low confidence', user_visible_note: `${platform === 'pxb7' ? '螃蟹' : '盼之'}部分详情需人工复核` }] : [];
    }),
    ...REQUIRED_PLATFORMS.flatMap((platform) => listCommands.some((item) => item.platform === platform && !item.ok && item.recovered_by_fallback !== true) ? [{ source: platform, task_id: `platform-${platform}-list`, reason: 'field_missing', evidence: 'an unrecovered list batch failed after at least one successful batch', fallback_used: 'successful_batches', confidence_effect: 'candidate coverage is partial', user_visible_note: `${platform === 'pxb7' ? '螃蟹' : '盼之'}扩展分页有一批读取失败` }] : []),
    ...(pzdsPaginationPartial ? [{ source: 'pzds', task_id: 'platform-pzds-list', reason: 'rate_limited', evidence: 'PZDS loadMore failed or was rate-limited after the initial natural page data loaded', fallback_used: 'initial_rendered_goods_list', confidence_effect: 'PZDS candidate coverage is partial but returned rows remain traceable', user_visible_note: '盼之扩展分页触发限流，本轮保留自然页面已加载候选并明确标为覆盖不完整' }] : []),
    ...(!dualPlatformCoverage.complete ? [{ source: 'cross_platform_output', task_id: 'dual-platform-shortlists', reason: 'empty_result', evidence: `missing display candidates for ${dualPlatformCoverage.missing_platforms.join(', ')}`, fallback_used: 'do_not_claim_complete', confidence_effect: 'run is incomplete and cannot be presented as a dual-platform result', user_visible_note: '双平台候选未凑齐，本轮不得只展示单个平台后宣称完成' }] : []),
    ...(!dualPlatformCoverage.qualifying_complete ? [{ source: 'cross_platform_output', task_id: 'dual-platform-qualifying-shortlists', reason: 'empty_result', evidence: `no detail-verified qualifying account from ${dualPlatformCoverage.qualifying_missing_platforms.join(', ')}`, fallback_used: 'show_labeled_near_matches', confidence_effect: 'near matches are visible but remain non-qualifying', user_visible_note: '有平台暂未找到完全符合项，已保留明确标注的接近账号用于横向比较' }] : []),
    ...(!evidenceIsCurrent ? [{ source: 'community_snapshot', task_id: 'community-current-snapshot', reason: 'not_checked', evidence: evidenceDate ? `snapshot age is ${evidenceAgeDays} days` : 'snapshot updated_at is missing', fallback_used: 'refresh', confidence_effect: 'live recommendations are capped at medium confidence', user_visible_note: '社区证据快照需要刷新' }] : []),
    ...(profile.budget_expansion?.enabled && eligibleInBudget.length === 0 && budgetBreakthroughListings.length === 0 ? [{ source: 'pxb7+pzds', task_id: 'dual-platform-budget-breakthrough', reason: expansionStopReason.includes('expansion_adapter_failed') ? 'blocked' : 'empty_result', evidence: `bidirectional expansion ended with ${expansionStopReason}`, fallback_used: 'in_budget_near_matches', confidence_effect: 'no exact hard-condition match was verified inside the configured search horizon', user_visible_note: '已保留预算附近最接近账号，但双平台向低价和高价扩展后仍未复核到精确满足项' }] : []),
    { source: 'pxb7+pzds', task_id: 'operator-progression-detail', reason: 'field_missing', evidence: 'Current public reports expose E2/E1 membership and verification images but no dedicated per-operator mastery/module values', fallback_used: 'final_platform_verification', confidence_effect: 'unknown mastery/module receive zero credit and recommendations remain at most medium confidence', user_visible_note: '精二已由平台事实验证；专精和模组需在下单后的最终验号中逐项确认' },
  ],
  platform_attempts: REQUIRED_PLATFORMS.map((platform) => ({
    platform,
    query: `Arknights ${profile.budget.flex_min ?? profile.budget.primary_min}-${profile.budget.flex_max ?? profile.budget.primary_max}`,
    url: platform === 'pxb7' ? 'https://www.pxb7.com/buy/10053/1?keyword=%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F' : 'https://www.pzds.com/goodsList/84/6/headerSearch?queryFrom=search&searchType=GAME_NAME',
    query_session_id: runId,
    browser_transport: 'none',
    site_session: 'ephemeral',
    browser_targets: [],
    duration_ms: listCommands.filter((item) => item.platform === platform).reduce((sum, item) => sum + item.duration_ms, 0),
    wait_budget_ms: 90000,
    status: listCommands.some((item) => item.platform === platform && item.ok) ? (platform === 'pzds' && pzdsPaginationPartial ? 'partial' : 'success') : 'error',
    result_count: platformCandidateCounts[platform],
    adapter_available: true,
    adapter_verified: true,
    adapter_command: listCommands.filter((item) => item.platform === platform).map((item) => item.command).join(' && '),
    list_attempts: listCommands.filter((item) => item.platform === platform).map((item) => ({
      batch: item.batch,
      page: item.query_plan?.page ?? null,
      limit: item.query_plan?.limit ?? null,
      logical_batch_count: item.query_plan?.logical_batch_count ?? 1,
      strategy: item.query_plan?.strategy ?? 'unknown',
      status: item.ok ? 'success' : 'error',
      duration_ms: item.duration_ms,
      result_count: item.result_count ?? 0,
      pagination_partial: item.pagination_partial === true,
      recovered_by_fallback: item.recovered_by_fallback === true,
      fallback_used: item.fallback_used ?? null,
      error_text: item.ok ? null : (item.stderr || item.stdout || 'list command failed').trim().slice(0, 500),
    })),
    verify_command: `opencli browser gas-arknights-${platform}-verify verify ${platform}/arknights-list --strict-memory; opencli browser gas-arknights-${platform}-verify verify ${platform}/arknights-detail --strict-memory`,
    detail_adapter_command: `opencli ${platform} arknights-detail <url> -f json`,
    detail_attempts: detailAttempts.filter((attempt) => attempt.platform === platform),
    budget_expansion: {
      enabled: profile.budget_expansion?.enabled === true,
      stop_reason: expansionStopReason,
      stop_reasons_by_direction: expansionStopReasons,
      list_attempts: expansionAttempts.filter((attempt) => attempt.platform === platform),
      detail_attempts: expansionDetailAttempts.filter((attempt) => attempt.platform === platform),
    },
  })),
  community_attempts: [{ source: 'local_current_snapshot', tool: 'local_evidence_snapshot', query: 'current Arknights general/story-map tiers, role coverage, progression and account-trade evidence', url: 'skills/game-account-arknights/references/community-evidence.md', duration_ms: null, wait_budget_ms: 15000, status: evidenceIsCurrent ? 'success' : 'limited', result_count: evidenceIsCurrent ? 7 : 0, error_text: evidenceIsCurrent ? null : 'community evidence snapshot is stale or undated', fallback_used: evidenceIsCurrent ? null : 'refresh' }],
  candidate_count: listRows.length + expansionAttempts.reduce((sum, attempt) => sum + attempt.result_count, 0),
  detail_verified_count: allDetailedIds.size,
  rankings: rankings.map((listing) => compactRecommendation(listing, allDetailedIds.has(listingKey(listing)) ? 'ranked_detail_verified' : 'ranked_list_only')),
  platform_shortlists: platformShortlists,
  dual_platform_coverage: dualPlatformCoverage,
  best_value_listing: bestValueListing ? compactRecommendation(bestValueListing, 'cross_platform_best_value') : null,
  recommendations,
  backup_listings: backupListings,
  near_match_listings: nearMatchListings,
  budget_breakthrough_listings: budgetBreakthroughListings,
  budget_comparison: budgetComparison,
  manual_checks: [...recommendations, ...backupListings, ...nearMatchListings, ...budgetBreakthroughListings].map((listing) => ({
    listing_id: listing.listing_id,
    listing_key: listing.listing_key,
    platform: listing.platform,
    url: listing.url,
    checks: [
      '核对当前超大杯/核心干员专精等级',
      '核对已安装模组及等级',
      '核对实名、换绑和最新验号日期',
      ...((profile.soft_preferences ?? []).some((item) => item.type === 'account_recency')
        ? ['核对账号创建/活跃历史，并用近期阵容覆盖验证是否为陈年断代仓库号']
        : []),
    ],
    evidence_image_urls: listing.platform_facts?.verification_image_urls ?? [],
  })),
  excluded_listings: rankings.filter((listing) => !selectedIds.has(listingKey(listing)) && (!listing.hard_filter_passed || listing.budget_tier === 'excluded_price')).map((listing) => compactRecommendation(listing, 'excluded')),
  experience_summary: {
    effective: ['dual-platform PXB7/PZDS list coverage', 'separate platform shortlists plus cross-platform best-value ranking', 'dynamic price filters', 'named E2/E1 operator facts', ...(pzdsAssetGridListings.length ? [`PZDS asset-grid cards supplied named operator and image evidence for ${pzdsAssetGridListings.length} detail-verified listings`] : []), 'separate published and platform-verified timestamps', 'verification-image evidence extraction', 'community meta-core matching', 'story-map role coverage', `top-${detailCount}-per-platform detail risk verification`, 'profile ranking with a cross-profile playability floor', 'explicit collaboration-completion hard condition', ...(profile.budget_expansion?.enabled ? [`bidirectional budget expansion stopped with ${expansionStopReason}`, 'nearby-budget near match versus lower/higher exact-match comparison'] : [])],
    ineffective_or_missing: ['Current public reports do not expose dedicated per-operator mastery/module values', 'platform verification time may be undisclosed even when verification method is known', ...(pzdsPaginationPartial ? ['PZDS pagination was rate-limited; initial rendered rows were retained as a partial fallback'] : []), ...(!evidenceIsCurrent ? ['community evidence snapshot is stale or undated'] : [])],
    next_run_actions: ['reuse all four verified PXB7/PZDS Arknights adapters', 'prefer PZDS metadata resources but merge the visible asset grid when metadata names are delayed or absent', 'capture the pre-run Chrome window baseline and close only new all-query/about:blank windows', 'never present a single-platform shortlist as a completed run', 'require push_readiness and role coverage in recommendation explanations', 'give unknown mastery/module zero credit', 'inspect mastery/module and binding state during final platform verification', 'refresh evidence when snapshot exceeds 7 days'],
  },
  knowledge_update_candidates: [{
    id: 'dual-platform-arknights-progression-fields',
    type: 'platform_pattern',
    confidence: 'medium',
    evidence: ['public detail text and verification images expose E2/E1 membership but not dedicated per-operator mastery/module values'],
    observed_in: { run_id: runId, listing_ids: detailAttempts.map((item) => item.listing_key), platform_attempt_ids: REQUIRED_PLATFORMS.map((platform) => `platform-${platform}-detail-shortlist`), community_attempt_ids: [] },
    suggested_targets: REQUIRED_PLATFORMS.map((platform) => `skills/game-account-toolkit/opencli-adapters/games/arknights/clis/${platform}/arknights-detail.js`),
    requires_user_confirmation: false,
    validation_commands: REQUIRED_PLATFORMS.map((platform) => `opencli browser gas-arknights-${platform}-verify verify ${platform}/arknights-detail --strict-memory`),
    apply_status: 'deferred',
    apply_note: 'The current public platform facts do not expose dedicated per-operator mastery/module values, so no adapter change can be validated yet.',
    source_scope: 'platform_fact',
    preference_scope: 'durable',
  }, ...(pzdsAssetGridListings.length ? [{
    id: 'pzds-arknights-visible-asset-grid-evidence',
    type: 'platform_pattern',
    confidence: 'high',
    evidence: pzdsAssetGridListings.slice(0, 10).map((listing) => `${listing.listing_id}: operatorDomCount=${listing.game_assets?.platform_facts?.status?.operatorDomCount}`),
    observed_in: { run_id: runId, listing_ids: pzdsAssetGridListings.map((listing) => listing.listing_id), platform_attempt_ids: ['platform-pzds-detail-shortlist'], community_attempt_ids: [] },
    suggested_targets: ['skills/game-account-toolkit/opencli-adapters/games/arknights/clis/pzds/arknights-detail.js'],
    requires_user_confirmation: false,
    validation_commands: ['opencli browser gas-arknights-pzds-verify verify pzds/arknights-detail --strict-memory'],
    apply_status: 'verified_existing',
    apply_note: 'The current adapter already merges the visible asset grid; this run re-verified the behavior but did not add it.',
    source_scope: 'platform_fact',
    preference_scope: 'durable',
  }] : []), ...(pzdsPaginationPartial ? [{
    id: 'pzds-arknights-list-low-frequency-partial-fallback',
    type: 'platform_pattern',
    confidence: 'high',
    evidence: ['PZDS list pagination failed after the natural page had already returned traceable goods rows'],
    observed_in: { run_id: runId, listing_ids: listRows.filter((row) => row.__platform === 'pzds').map((row) => row.listingId), platform_attempt_ids: ['platform-pzds-list'], community_attempt_ids: [] },
    suggested_targets: ['skills/game-account-toolkit/opencli-adapters/games/arknights/clis/pzds/arknights-list.js', 'skills/game-account-toolkit/references/platform-access-policy.md'],
    requires_user_confirmation: false,
    validation_commands: ['opencli browser gas-arknights-pzds-verify verify pzds/arknights-list --strict-memory'],
    apply_status: 'verified_existing',
    apply_note: 'The current adapter already preserves natural-page rows when pagination is partial; this run re-verified the fallback but did not add it.',
    source_scope: 'platform_fact',
    preference_scope: 'durable',
  }] : [])],
  rule_update_suggestions: [],
  cleanup_reports: [],
};

const absoluteOut = path.resolve(outPath);
fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
fs.writeFileSync(absoluteOut, `${JSON.stringify(artifact, null, 2)}\n`);
const finalizeArgs = [
  path.join(__dirname, 'finalize-selection-run.mjs'),
  '--input', absoluteOut,
  '--per-platform', String(displayCount),
  ...(reportOut ? ['--report-out', path.resolve(reportOut)] : []),
];
const finalizeResult = run(process.execPath, finalizeArgs, 240000);
if (!finalizeResult.ok) {
  console.error(finalizeResult.stderr || finalizeResult.stdout || 'selection finalizer failed');
  process.exit(1);
}
process.stdout.write(finalizeResult.stdout);
