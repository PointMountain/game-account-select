import { playContexts, resolveContextKnowledge } from '../../game-account-toolkit/scripts/community-evidence.mjs';

const unique = (values) => [...new Set(values)];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const methods = new Set(['platform_detail', 'platform_asset_grid', 'image_review', 'ocr_confirmed']);

export function validImageProof(listing, item) {
  const region = item.region;
  return (listing.game_assets?.platform_facts?.verification_image_urls ?? []).includes(item.image_url)
    && /^[a-f0-9]{64}$/.test(item.image_sha256 ?? '') && Array.isArray(region) && region.length === 4
    && region.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    && region[2] > 0 && region[3] > 0 && region[0] + region[2] <= 1 && region[1] + region[3] <= 1;
}

export function fieldEvidenceStatus(listing, field, value, now = new Date().toISOString()) {
  const rows = (listing.field_evidence ?? []).filter((item) => item.field === field);
  const supported = rows.filter((item) => methods.has(item.method) && String(item.listing_id) === String(listing.listing_id)
    && (!['image_review', 'ocr_confirmed'].includes(item.method) || validImageProof(listing, item))
    && item.source_url === listing.url && item.observed_at && Number.isFinite(Date.parse(item.observed_at))
    && Date.parse(item.observed_at) <= Date.parse(now) && Date.parse(now) - Date.parse(item.observed_at) < 86400000
    && (item.quote?.trim() || (item.source_field && Object.hasOwn(item, 'source_value')) || (item.image_url && item.region)));
  if (supported.some((item) => !same(item.value, value))) return { field, status: 'conflicting', evidence: supported };
  if (value == null || !supported.some((item) => same(item.value, value))) return { field, status: 'unverified', evidence: rows };
  return { field, status: 'verified', evidence: supported };
}

export function assessRecommendation(listing, profile, knowledge, snapshot, { now = new Date().toISOString() } = {}) {
  const fields = new Map([['price', listing.price], ['listing_id', String(listing.listing_id ?? '')]]);
  const contexts = profile?.play_contexts ?? playContexts(profile?.source_text ?? '');
  const operators = listing.game_assets?.operators ?? [];
  const knowledgeChecks = [];
  const require = (field, value) => fields.set(field, value);
  if (Number(profile?.priorities?.resources ?? 0) > 0) for (const [key, value] of Object.entries(listing.game_assets?.resources ?? {})) if (Number(value) > 0) require(`resources.${key}`, value);
  if (Number(profile?.priorities?.rarity ?? 0) > 0) for (const operator of operators) if (['limited', 'collab'].includes(knowledge.operators?.[operator.name]?.acquisition_type ?? operator.acquisition_type)) require(`operators.${operator.name}.present`, true);
  for (const condition of profile?.hard_conditions ?? []) {
    if (/server:/.test(condition)) require('server', listing.server);
    if (condition === 'official_verification:true') require('risk.official_verification', listing.game_assets?.risk?.official_verification);
    if (condition === 'guarantee:required') require('risk.guarantee', listing.game_assets?.risk?.guarantee);
    if (/orundum:/.test(condition)) require('resources.orundum', listing.game_assets?.resources?.orundum);
    if (/collab_complete|limited_complete/.test(condition)) {
      const key = condition.startsWith('collab') ? 'collab_completion' : 'limited_completion';
      const completion = listing.game_assets?.[key];
      const names = completion?.present_names ?? [];
      for (const name of names) require(`operators.${name}.present`, operators.some((operator) => operator.name === name) ? true : null);
      const checked = Date.parse(completion?.reference_checked_at ?? '');
      if (!completion?.complete || !names.length || names.length !== completion?.required_count || !Number.isFinite(checked)
        || checked > Date.parse(now) || Date.parse(now) - checked >= 7 * 86400000) knowledgeChecks.push({ context: 'collection', status: 'unverified', reason: `${key} 名单及完整性需要当前来源` });
    }
  }
  for (const name of profile?.must_have ?? []) require(`operators.${name}.present`, operators.some((operator) => operator.name === name) ? true : null);
  const combatRequired = Number(profile?.priorities?.combat ?? 0) > 0 || Number(profile?.priorities?.progression ?? 0) > 0;
  if (combatRequired) {
    for (const context of contexts) {
      const current = resolveContextKnowledge(knowledge, snapshot, { now, context, game: 'Arknights' });
      const named = listing.context_scores?.find((item) => item.context === context)?.ready_recommended_operators ?? listing.combat_breakdown?.ready_recommended_operators ?? [];
      if (!named.length) knowledgeChecks.push({ context, status: 'unverified', reason: '没有已核实的适用核心' });
      for (const name of named) {
        const meta = current.knowledge.operators[name];
        const operator = operators.find((item) => item.name === name);
        knowledgeChecks.push({ context, subject: name, status: meta?.current_claim_id ? 'verified' : 'unverified', claim_id: meta?.current_claim_id ?? null, source_ids: meta?.current_source_ids ?? [] });
        require(`operators.${name}.present`, operator ? true : null);
        require(`operators.${name}.elite`, operator?.elite);
        // Every positive mastery/module contribution to a recommendation needs proof.
        for (const field of ['mastery', 'module']) if (Number(operator?.[field]) > 0 || meta?.requirements?.[field] != null) require(`operators.${name}.${field}`, operator?.[field]);
        for (const [field, minimum] of Object.entries(meta?.requirements ?? {})) {
          if (!['elite', 'mastery', 'module'].includes(field)) continue;
          require(`operators.${name}.${field}`, operator?.[field]);
          if (operator?.[field] == null || Number(operator[field]) < minimum) knowledgeChecks.push({ context, subject: name, status: 'unverified', reason: `${field} 未满足适用条件 ${minimum}` });
        }
      }
    }
  }
  for (const claim of listing.recommendation_claims ?? []) for (const field of claim.required_fields ?? []) require(field.field, field.value);
  const checks = [...fields].map(([field, value]) => fieldEvidenceStatus(listing, field, value, now));
  const gaps = unique([...checks.filter((check) => check.status !== 'verified').map((check) => `${check.field}:${check.status}`),
    ...knowledgeChecks.filter((check) => check.status !== 'verified').map((check) => `${check.context}:${check.subject ?? ''}:${check.reason ?? '当前知识未核实'}`)]);
  return { schema_version: 1, eligible: gaps.length === 0 && listing.hard_filter_passed !== false, status: gaps.length ? 'pending_verification' : listing.hard_filter_passed === false ? 'not_matching' : 'verified',
    checked_at: now, contexts, field_checks: checks, knowledge_checks: knowledgeChecks, gaps };
}

// The operation parser supplies public detail facts; seller marketing is never promoted here.
export function detailFieldEvidence(row, listing, observedAt) {
  if (!row || !listing.url || !listing.listing_id) return [];
  const result = [];
  const add = (field, value, sourceField, sourceValue) => { if (value != null && sourceValue != null) result.push({ field, value, listing_id: listing.listing_id, source_url: listing.url, observed_at: observedAt,
    method: /operators|Names|Progression/.test(sourceField) && row.status?.officialVerification !== true ? 'seller_claim' : 'platform_detail', source_field: sourceField, source_value: sourceValue }); };
  add('listing_id', String(listing.listing_id), 'listingId', row.listingId);
  add('price', listing.price, 'priceCny', row.priceCny);
  add('server', listing.server, 'server', row.server);
  add('risk.official_verification', listing.game_assets?.risk?.official_verification, 'status.officialVerification', row.status?.officialVerification);
  add('risk.guarantee', listing.game_assets?.risk?.guarantee, 'riskFacts', row.status?.guarantee === true || (row.riskFacts ?? []).some((fact) => /包赔/.test(fact)) ? row.riskFacts ?? [] : null);
  for (const [field, key] of [['orundum', 'orundum'], ['originite_prime', 'originitePrime']]) add(`resources.${field}`, listing.game_assets?.resources?.[field], row.resources?.[key] != null ? `resources.${key}` : `counts.${key}`, row.resources?.[key] ?? row.counts?.[key]);
  for (const key of ['operatorNames', 'elite2OperatorNames', 'collabOperatorNames']) for (const name of unique(row[key] ?? [])) add(`operators.${name}.present`, true, key, name);
  for (const name of row.elite2OperatorNames ?? []) add(`operators.${name}.elite`, 2, 'elite2OperatorNames', name);
  for (const name of row.elite1OperatorNames ?? []) add(`operators.${name}.elite`, 1, 'elite1OperatorNames', name);
  for (const item of row.operatorProgression ?? []) {
    for (const field of ['elite', 'mastery', 'module']) if (item[field] != null && item.evidence?.[field]) add(`operators.${item.name}.${field}`, item[field], 'operatorProgression', item.evidence[field]);
  }
  return result;
}
