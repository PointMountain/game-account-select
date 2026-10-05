import crypto from 'node:crypto';

const DAY = 86400000;
export const evidenceDigest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const time = (value) => typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
const unique = (items) => [...new Set(items)];
const readable = new Set(['body', 'transcript', 'article_image', 'official_data']);
const array = (value) => Array.isArray(value) ? value : [];

export function playContexts(request = '') {
  const contexts = [];
  if (/主线|活动|日常|养老|推图|story|event/i.test(request)) contexts.push('story');
  if (/肉鸽|集成战略|roguelike/i.test(request)) contexts.push('roguelike');
  if (/高难|合约|登顶|high_difficulty/i.test(request)) contexts.push('high_difficulty');
  return contexts.length ? contexts : ['story'];
}

// A read timestamp is not a publication date and cannot renew an old conclusion.
export function assessClaim(claim, snapshot, { now = new Date().toISOString(), context = 'story', maxAgeDays = 7 } = {}) {
  const reasons = [];
  const nowMs = time(now);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid evidence evaluation time');
  if (!claim?.id || !claim.subject) reasons.push('claim_identity_missing');
  if (claim?.status !== 'supported') reasons.push('claim_not_supported');
  if (!array(claim?.contexts).includes(context)) reasons.push('context_not_covered');
  if (!snapshot?.version_context || claim?.version_context !== snapshot.version_context) reasons.push('version_mismatch');
  const asOf = time(claim?.as_of);
  if (!Number.isFinite(asOf) || asOf > nowMs || nowMs - asOf >= maxAgeDays * DAY) reasons.push('claim_expired_or_undated');
  const sources = array(claim?.source_ids).map((id) => array(snapshot?.sources).find((source) => source?.id === id));
  const usable = sources.filter((source) => {
    if (!source || !/^https?:\/\//.test(source.url ?? '') || typeof source.publisher !== 'string' || !source.publisher.trim() || !readable.has(source.content_kind)
      || !String(source.excerpt ?? '').trim()) return false;
    const published = time(source.published_at);
    const observed = time(source.observed_at);
    return Number.isFinite(published) && Number.isFinite(observed) && published <= observed && observed <= nowMs
      && nowMs - published < maxAgeDays * DAY && source.version_context === snapshot.version_context;
  });
  // Publisher identity, not URL count: reposts by the same author are one source.
  const publishers = unique(usable.map((source) => source.publisher.trim().toLowerCase()));
  if (publishers.length < 2) reasons.push('independent_current_sources_missing');
  return { eligible: reasons.length === 0, reasons: unique(reasons), source_ids: usable.map((source) => source.id), context, claim_id: claim?.id ?? null };
}

export function validateEvidence(snapshot) {
  const issues = [];
  if (snapshot?.schema_version !== 1 || !snapshot.game || !snapshot.version_context) issues.push('schema/game/version_context required');
  for (const key of ['sources', 'claims']) {
    if (!Array.isArray(snapshot?.[key])) { issues.push(`${key} must be an array`); continue; }
    const ids = snapshot[key].map((item) => item?.id);
    if (ids.some((id) => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) issues.push(`${key} need unique nonempty ids`);
  }
  for (const claim of array(snapshot?.claims)) {
    if (!claim || typeof claim !== 'object') { issues.push('claim must be an object'); continue; }
    if (!Array.isArray(claim.contexts) || !claim.contexts.length || claim.contexts.some((context) => !['story', 'roguelike', 'high_difficulty'].includes(context))) issues.push(`${claim.id}: invalid contexts`);
    if (!Array.isArray(claim.source_ids) || claim.source_ids.some((id) => !array(snapshot.sources).some((source) => source?.id === id))) issues.push(`${claim.id}: unknown source`);
    if (claim.kind === 'operator_valuation') {
      if (!claim.values || typeof claim.values !== 'object' || Array.isArray(claim.values) || !Object.keys(claim.values).length) issues.push(`${claim.id}: valuation values required`);
      for (const key of ['combat_value', 'story_value']) if (claim.values?.[key] != null && (!Number.isFinite(claim.values[key]) || claim.values[key] < 0 || claim.values[key] > 100)) issues.push(`${claim.id}: invalid ${key}`);
      if (claim.values?.meta_tier != null && !['apex', 'core', 'strong', 'situational', 'unrated'].includes(claim.values.meta_tier)) issues.push(`${claim.id}: invalid tier`);
      if (Object.keys(claim.values ?? {}).some((key) => !['combat_value', 'story_value', 'meta_tier', 'roles', 'requirements'].includes(key))) issues.push(`${claim.id}: unsupported valuation field`);
      if (claim.values?.roles != null && (!Array.isArray(claim.values.roles) || claim.values.roles.some((role) => typeof role !== 'string'))) issues.push(`${claim.id}: invalid roles`);
      if (claim.values?.requirements != null && (typeof claim.values.requirements !== 'object' || Array.isArray(claim.values.requirements)
        || Object.entries(claim.values.requirements).some(([key, value]) => !['elite', 'mastery', 'module'].includes(key) || !Number.isInteger(value) || value < 0 || value > (key === 'elite' ? 2 : 3)))) issues.push(`${claim.id}: invalid requirements`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export function resolveContextKnowledge(knowledge, snapshot, options = {}) {
  const context = options.context ?? 'story';
  const resolved = structuredClone(knowledge);
  resolved.operators ??= {};
  // Current markers are derived on every read; stored markers never renew evidence.
  for (const operator of Object.values(resolved.operators)) { delete operator.current_claim_id; delete operator.current_source_ids; }
  const assessments = [];
  const applied = [];
  if (options.game && snapshot?.game !== options.game) return { knowledge: resolved, context, snapshot_digest: snapshot ? evidenceDigest(snapshot) : null, applied_claim_ids: [], assessments: [{ eligible: false, reasons: ['game_mismatch'] }] };
  const validation = validateEvidence(snapshot);
  for (const claim of array(snapshot?.claims)) {
    if (!claim || typeof claim !== 'object') continue;
    if (claim.kind !== 'operator_valuation') continue;
    const assessment = assessClaim(claim, snapshot, { ...options, context });
    assessments.push({ ...assessment, subject: claim.subject });
    const conflicting = array(snapshot.claims).some((other) => other && other.id !== claim.id && other.subject === claim.subject && other.kind === claim.kind
      && array(other.contexts).includes(context) && (other.status === 'disputed' || (other.status === 'supported' && JSON.stringify(other.values) !== JSON.stringify(claim.values))));
    if (!assessment.eligible || conflicting || !validation.valid) continue;
    const values = claim.values ?? {};
    resolved.operators[claim.subject] = { ...(resolved.operators[claim.subject] ?? { acquisition_type: 'unknown', collector_value: 0 }), ...values,
      evidence_as_of: claim.as_of, current_claim_id: claim.id, current_source_ids: assessment.source_ids };
    applied.push(claim.id);
  }
  return { knowledge: resolved, context, snapshot_digest: snapshot ? evidenceDigest(snapshot) : null, applied_claim_ids: applied, assessments };
}
