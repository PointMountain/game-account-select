import { scoreListing } from './score-listings.mjs';

export function applyRecommendationGate(artifact, options = {}) {
  if (artifact.evidence_policy?.version !== 1) return artifact;
  const pending = new Map();
  const evaluated = new Map();
  const key = (row) => `${row.platform}:${row.listing_id ?? row.url}`;
  function assess(row) {
    if (!row) return row;
    if (!evaluated.has(key(row))) {
      const scored = scoreListing(row, artifact.selection_profile, options);
      const result = { ...row, ...scored };
      if (!scored.recommendation_gate.eligible) {
        result.recommendation_tier = 'pending_verification';
        if (scored.hard_filter_passed !== false) pending.set(key(row), result);
      }
      evaluated.set(key(row), result);
    }
    return evaluated.get(key(row));
  }
  const verified = (row) => row.recommendation_gate.eligible;
  for (const name of ['recommendations', 'backup_listings', 'budget_breakthrough_listings']) artifact[name] = (artifact[name] ?? []).map(assess).filter(verified);
  for (const name of ['rankings', 'near_match_listings', 'excluded_listings', 'pending_verification']) artifact[name] = (artifact[name] ?? []).map(assess);
  for (const section of Object.values(artifact.platform_shortlists ?? {})) {
    for (const name of ['qualifying', 'out_of_scope_qualifying']) section[name] = (section[name] ?? []).map(assess).filter(verified);
    for (const name of ['display_candidates', 'near_matches', 'out_of_scope_near_matches', 'list_only_candidates']) section[name] = (section[name] ?? []).map(assess);
    section.status = section.qualifying.length ? 'qualified' : section.display_candidates.length ? 'pending_verification' : 'empty';
    section.user_visible_note = `主推荐仅包含关键字段与适用知识已核实的账号；${section.qualifying.length} 个在预算内通过，其他候选保留具体待核实项。`;
  }
  artifact.best_value_listing = artifact.best_value_listing ? assess(artifact.best_value_listing) : null;
  if (!artifact.best_value_listing?.recommendation_gate.eligible) artifact.best_value_listing = null;
  artifact.pending_verification = [...pending.values()];
  artifact.budget_comparison = artifact.budget_breakthrough_listings.length ? artifact.budget_comparison : null;
  if (artifact.dual_platform_coverage) {
    artifact.dual_platform_coverage.qualifying_missing_platforms = Object.entries(artifact.platform_shortlists ?? {}).filter(([, section]) => !section.qualifying.length).map(([platform]) => platform);
    artifact.dual_platform_coverage.qualifying_complete = artifact.dual_platform_coverage.qualifying_missing_platforms.length === 0;
  }
  return artifact;
}
