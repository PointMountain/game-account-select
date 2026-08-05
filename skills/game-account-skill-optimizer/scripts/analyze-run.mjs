#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const inputPath = readArg('--input');
const wantsJson = args.includes('--json');

if (!inputPath) {
  console.error('Usage: analyze-run.mjs --input <run-artifact.json> [--json]');
  process.exit(2);
}

const artifactPath = path.resolve(inputPath);
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const repoRoot = process.cwd();
const targetSkill = artifact.target_skill ?? artifact.skill ?? 'unknown';

const toolkitPriorityPath = path.resolve('skills/game-account-toolkit/references/platform-priority.json');
const priorityConfig = fs.existsSync(toolkitPriorityPath)
  ? JSON.parse(fs.readFileSync(toolkitPriorityPath, 'utf8'))
  : { required_default_coverage: ['pxb7', 'pzds'], platforms: [] };
const platformAliasMap = new Map();
for (const platform of priorityConfig.platforms ?? []) {
  platformAliasMap.set(String(platform.id).toLowerCase(), platform.id);
  if (platform.url) platformAliasMap.set(new URL(platform.url).hostname.toLowerCase(), platform.id);
  for (const alias of platform.aliases ?? []) {
    platformAliasMap.set(String(alias).toLowerCase(), platform.id);
  }
}
const DEFAULT_REQUIRED_PLATFORMS = priorityConfig.required_default_coverage ?? ['pxb7', 'pzds'];
const findings = [];

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function skillRootFor(skill = targetSkill) {
  if (!skill || skill === 'unknown') return null;

  const normalized = String(skill).replace(/\\/g, '/').replace(/^\.\//, '');
  const skillName = normalized.startsWith('skills/')
    ? normalized.split('/')[1]
    : path.basename(normalized);

  const candidates = [
    path.resolve(repoRoot, normalized),
    path.resolve(repoRoot, 'skills', normalized),
    path.resolve(repoRoot, 'skills', skillName)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function skillRelativePath(skill, ...segments) {
  const root = skillRootFor(skill);
  if (!root) return null;
  const absolutePath = path.join(root, ...segments);
  return fs.existsSync(absolutePath) ? repoPath(absolutePath) : null;
}

function referenceFiles(skill, predicate) {
  const root = skillRootFor(skill);
  if (!root) return [];
  const referencesDir = path.join(root, 'references');
  if (!fs.existsSync(referencesDir)) return [];

  return fs.readdirSync(referencesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(predicate)
    .map((name) => repoPath(path.join(referencesDir, name)));
}

function fixtureFiles(skill) {
  const root = skillRootFor(skill);
  if (!root) return [];
  const fixtureDir = path.join(root, 'test-fixtures');
  if (!fs.existsSync(fixtureDir)) return [];

  return fs.readdirSync(fixtureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => repoPath(path.join(fixtureDir, entry.name)));
}

function skillTargetsFor(skill = targetSkill, { includeFixtures = false, includeValidation = false } = {}) {
  const targets = [
    skillRelativePath(skill, 'SKILL.md'),
    skillRelativePath(skill, 'references', 'valuation-rules.md'),
    skillRelativePath(skill, 'references', 'selection-state-machine.md'),
    skillRelativePath(skill, 'references', 'update-workflow.md'),
    skillRelativePath(skill, 'references', 'evaluation-rubric.md'),
    skillRelativePath(skill, 'references', 'generation-workflow.md'),
    skillRelativePath(skill, 'references', 'optimization-workflow.md'),
    skillRelativePath(skill, 'references', 'issue-taxonomy.md'),
    ...referenceFiles(skill, (name) => name.endsWith('-knowledge.md') || name === 'asset-knowledge.md'),
    includeValidation ? skillRelativePath(skill, 'scripts', 'validate-sample.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'preflight.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'check-deps.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'update-community-evidence.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'generate-game-skill.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'evaluate-skill.mjs') : null,
    includeValidation ? skillRelativePath(skill, 'scripts', 'analyze-run.mjs') : null,
    ...(includeFixtures ? fixtureFiles(skill) : [])
  ];

  const existingTargets = unique(targets);
  return existingTargets.length
    ? existingTargets
    : ['skills/game-account-toolkit/references/game-skill-standard.md'];
}

function targetSkillTargets(options = {}) {
  return skillTargetsFor(targetSkill, options);
}

function addFinding({ id, severity, category, summary, evidence = [], suggestedTargets = [], autopatchSafe = false }) {
  findings.push({
    id,
    severity,
    category,
    summary,
    evidence,
    suggested_targets: unique(suggestedTargets),
    autopatch_safe: autopatchSafe
  });
}

function platformName(attempt) {
  const raw = String(attempt.platform ?? attempt.source ?? attempt.tool ?? 'unknown');
  const normalized = raw.toLowerCase();
  if (platformAliasMap.has(normalized)) return platformAliasMap.get(normalized);
  for (const [alias, platform] of platformAliasMap.entries()) {
    if (normalized.includes(alias)) return platform;
  }
  const url = String(attempt.url ?? '');
  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (platformAliasMap.has(host)) return platformAliasMap.get(host);
    } catch {
      // Keep the raw platform when url is not parseable.
    }
  }
  return raw;
}

const attempts = Array.isArray(artifact.platform_attempts) ? artifact.platform_attempts : [];
const communityAttempts = Array.isArray(artifact.community_attempts) ? artifact.community_attempts : [];
const recommendations = Array.isArray(artifact.recommendations) ? artifact.recommendations : [];
const backupListings = Array.isArray(artifact.backup_listings) ? artifact.backup_listings : [];
const nearMatchListings = Array.isArray(artifact.near_match_listings) ? artifact.near_match_listings : [];
const budgetBreakthroughListings = Array.isArray(artifact.budget_breakthrough_listings) ? artifact.budget_breakthrough_listings : [];
const excludedListings = Array.isArray(artifact.excluded_listings) ? artifact.excluded_listings : [];
const finalResponse = String(artifact.final_response ?? artifact.final_response_draft ?? '');
const coverageGaps = Array.isArray(artifact.coverage_gaps) ? artifact.coverage_gaps : [];
const knowledgeCandidates = Array.isArray(artifact.knowledge_update_candidates) ? artifact.knowledge_update_candidates : [];
const selectionProfile = artifact.selection_profile && typeof artifact.selection_profile === 'object'
  ? artifact.selection_profile
  : null;
const profileIsolation = artifact.profile_isolation && typeof artifact.profile_isolation === 'object'
  ? artifact.profile_isolation
  : null;
const executionIssues = [
  ...(Array.isArray(artifact.errors) ? artifact.errors : []),
  ...(Array.isArray(artifact.exceptions) ? artifact.exceptions : []),
  ...(Array.isArray(artifact.tool_failures) ? artifact.tool_failures : []),
  ...(Array.isArray(artifact.blocked_steps) ? artifact.blocked_steps : [])
];
if (executionIssues.length) {
  addFinding({
    id: 'troubleshooting-execution-failure',
    severity: 'high',
    category: 'troubleshooting',
    summary: 'Execution failures should be diagnosed before changing ranking or valuation rules',
    evidence: executionIssues.map((issue) => typeof issue === 'string' ? issue : JSON.stringify(issue)),
    suggestedTargets: [
      ...targetSkillTargets({ includeValidation: true }),
      'skills/game-account-preflight/SKILL.md',
      'skills/game-account-toolkit/references/platform-access-policy.md'
    ],
    autopatchSafe: false
  });
}

const looksLikeSelectionRun = attempts.length > 0
  || communityAttempts.length > 0
  || recommendations.length > 0
  || backupListings.length > 0
  || excludedListings.length > 0;
const hasCoveragePlan = artifact.coverage_plan
  && Array.isArray(artifact.coverage_plan.source_tasks)
  && artifact.coverage_plan.source_tasks.length > 0;
if (looksLikeSelectionRun && !hasCoveragePlan) {
  addFinding({
    id: 'selector-source-coverage-plan-missing',
    severity: 'high',
    category: 'platform_coverage',
    summary: 'Selection runs should define source coverage before querying platforms or community sources',
    evidence: [
      `platform_attempts=${attempts.length}`,
      `community_attempts=${communityAttempts.length}`,
      `recommendations=${recommendations.length}`,
      'coverage_plan.source_tasks is missing or empty'
    ],
    suggestedTargets: [
      'skills/game-account-select/SKILL.md',
      'skills/game-account-select/references/selector-architecture.md',
      'skills/game-account-select/references/source-coverage-playbook.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-skill-evaluator/references/evaluation-rubric.md'
    ],
    autopatchSafe: true
  });
}

const hasKnowledgeSignals = coverageGaps.length > 0
  || (Array.isArray(artifact.user_feedback) && artifact.user_feedback.length > 0)
  || (Array.isArray(artifact.rule_update_suggestions) && artifact.rule_update_suggestions.length > 0)
  || executionIssues.length > 0;
if (looksLikeSelectionRun && hasKnowledgeSignals && knowledgeCandidates.length === 0) {
  addFinding({
    id: 'selector-knowledge-ledger-candidates-missing',
    severity: 'medium',
    category: 'evidence',
    summary: 'Runs with feedback, coverage gaps, or rule suggestions should emit knowledge update candidates',
    evidence: [
      coverageGaps.length ? `coverage_gaps=${coverageGaps.length}` : null,
      Array.isArray(artifact.user_feedback) && artifact.user_feedback.length ? `user_feedback=${artifact.user_feedback.length}` : null,
      Array.isArray(artifact.rule_update_suggestions) && artifact.rule_update_suggestions.length ? `rule_update_suggestions=${artifact.rule_update_suggestions.length}` : null,
      executionIssues.length ? `execution_issues=${executionIssues.length}` : null,
      'knowledge_update_candidates is empty'
    ].filter(Boolean),
    suggestedTargets: [
      'skills/game-account-select/references/knowledge-ledger.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: true
  });
}

const leakedDurableTargets = Array.isArray(profileIsolation?.durable_updates_from_profile)
  ? profileIsolation.durable_updates_from_profile.filter(Boolean)
  : [];
const leakedProfileCandidates = knowledgeCandidates.filter((candidate) => {
  const sourceScope = String(candidate.source_scope ?? '').toLowerCase();
  const preferenceScope = String(candidate.preference_scope ?? '').toLowerCase();
  const applyStatus = String(candidate.apply_status ?? 'proposed').toLowerCase();
  const durableTargets = Array.isArray(candidate.suggested_targets)
    ? candidate.suggested_targets.filter((target) => /(?:^|\/)skills\/|references\/|SKILL\.md$/i.test(String(target)))
    : [];
  const derivedFromProfile = sourceScope === 'selection_profile' || preferenceScope === 'run_only';
  return derivedFromProfile && (durableTargets.length > 0 || applyStatus === 'applied');
});
const profileScopeIsDurable = selectionProfile
  && String(selectionProfile.persistence_scope ?? '').toLowerCase() !== 'run_only';
const isolationMissing = selectionProfile && !profileIsolation;
const isolationScopeIsDurable = profileIsolation
  && String(profileIsolation.persistence_scope ?? '').toLowerCase() !== 'run_only';
const isolationUpdatesMissing = profileIsolation && !Array.isArray(profileIsolation.durable_updates_from_profile);
if (selectionProfile && (profileScopeIsDurable || isolationMissing || isolationScopeIsDurable || isolationUpdatesMissing || leakedDurableTargets.length || leakedProfileCandidates.length)) {
  const preferenceEvidence = {
    budget: selectionProfile.budget ?? null,
    objective: selectionProfile.objective ?? null,
    server_preferences: selectionProfile.server_preferences ?? [],
    must_have: selectionProfile.must_have ?? [],
    persistence_scope: selectionProfile.persistence_scope ?? null
  };
  addFinding({
    id: 'selector-session-preference-leak',
    severity: 'blocking',
    category: 'quality_gate',
    summary: 'Run-only selection preferences must not be written into durable scoring rules or knowledge files',
    evidence: [
      `selection_profile=${JSON.stringify(preferenceEvidence)}`,
      profileScopeIsDurable ? `selection_profile.persistence_scope=${selectionProfile.persistence_scope ?? 'missing'} (expected run_only)` : null,
      isolationMissing ? 'profile_isolation=missing' : null,
      isolationScopeIsDurable ? `profile_isolation.persistence_scope=${profileIsolation.persistence_scope ?? 'missing'} (expected run_only)` : null,
      isolationUpdatesMissing ? 'profile_isolation.durable_updates_from_profile=missing (expected empty array)' : null,
      leakedDurableTargets.length ? `profile_isolation.durable_updates_from_profile=${JSON.stringify(leakedDurableTargets)}` : null,
      ...leakedProfileCandidates.map((candidate) => `knowledge_update_candidate=${candidate.id ?? 'unknown'} source_scope=${candidate.source_scope ?? 'unknown'} preference_scope=${candidate.preference_scope ?? 'unknown'} apply_status=${candidate.apply_status ?? 'unknown'} targets=${JSON.stringify(candidate.suggested_targets ?? [])}`)
    ].filter(Boolean),
    suggestedTargets: [
      'skills/game-account-select/references/knowledge-ledger.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-evaluator/references/evaluation-rubric.md'
    ],
    autopatchSafe: false
  });
}

const unscopedFreeformExclusions = Array.isArray(selectionProfile?.exclusions)
  ? selectionProfile.exclusions.filter((item) => /(?:账号|新号|老号|陈年|仓库号|仓库|阵容断代|早期收藏|近期活跃)/.test(String(item)))
  : [];
if (unscopedFreeformExclusions.length) {
  addFinding({
    id: 'selector-unscoped-freeform-exclusion',
    severity: 'high',
    category: 'quality_gate',
    summary: 'Account-level recency language must not be evaluated as an operator exclusion',
    evidence: unscopedFreeformExclusions.map((item) => `selection_profile.exclusions=${JSON.stringify(item)}`),
    suggestedTargets: [
      'skills/game-account-select/scripts/parse-selection-profile.mjs',
      'skills/game-account-select/scripts/validate-selection-profile.mjs',
      ...targetSkillTargets({ includeValidation: true }),
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
    ],
    autopatchSafe: true,
  });
}

const reconciliation = artifact.provenance_reconciliation && typeof artifact.provenance_reconciliation === 'object'
  ? artifact.provenance_reconciliation
  : null;
if (reconciliation) {
  const validation = reconciliation.validation && typeof reconciliation.validation === 'object'
    ? reconciliation.validation
    : null;
  const targetIds = (Array.isArray(reconciliation.targeted_detail_refreshes) ? reconciliation.targeted_detail_refreshes : [])
    .map((item) => String(item?.listing_id ?? item?.listing_key ?? ''))
    .filter(Boolean);
  const rescoredIds = new Set((Array.isArray(validation?.rescored_listing_ids) ? validation.rescored_listing_ids : [])
    .map((item) => String(item)));
  const expectedProfileDigest = String(artifact.profile_confirmation?.profile_digest ?? reconciliation.profile_digest ?? '');
  const reconciliationIsValidated = validation?.status === 'passed'
    && validation?.method === 'canonical_rescore'
    && Boolean(validation?.validation_command)
    && Boolean(validation?.validated_at)
    && Boolean(expectedProfileDigest)
    && String(reconciliation.profile_digest ?? '') === expectedProfileDigest
    && String(validation.profile_digest ?? '') === expectedProfileDigest
    && targetIds.length > 0
    && targetIds.every((id) => rescoredIds.has(id));

  if (!reconciliationIsValidated) {
    addFinding({
      id: 'selection-reconciliation-unvalidated',
      severity: 'high',
      category: 'quality_gate',
      summary: 'Candidates restored from another profile must be canonically rescored before the run can pass self-improve',
      evidence: [
        `reason=${reconciliation.reason ?? 'missing'}`,
        `source_artifact=${reconciliation.source_artifact ?? 'missing'}`,
        `targeted_listing_ids=${targetIds.join(',') || 'missing'}`,
        `expected_profile_digest=${expectedProfileDigest || 'missing'}`,
        `validation_status=${validation?.status ?? 'missing'}`,
        `validation_method=${validation?.method ?? 'missing'}`,
        `rescored_listing_ids=${[...rescoredIds].join(',') || 'missing'}`,
      ],
      suggestedTargets: [
        'skills/game-account-arknights/scripts/score-listings.mjs',
        'skills/game-account-arknights/scripts/finalize-selection-run.mjs',
        'skills/game-account-arknights/scripts/validate-selection-output.mjs',
        'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
        'skills/game-account-skill-evaluator/references/evaluation-rubric.md',
      ],
      autopatchSafe: false,
    });
  }
}

const evaluationReports = [
  ...(artifact.evaluation_report ? [artifact.evaluation_report] : []),
  ...(Array.isArray(artifact.evaluation_reports) ? artifact.evaluation_reports : [])
];
const failedEvaluations = evaluationReports.filter((report) => {
  const score = Number(report.score ?? 100);
  const threshold = Number(report.threshold ?? 80);
  return report.redo_required === true || report.passed === false || score < threshold;
});
if (failedEvaluations.length) {
  addFinding({
    id: 'quality-gate-redo-required',
    severity: 'blocking',
    category: 'quality_gate',
    summary: 'Evaluator quality gate failed; optimized or generated skill must be redone before reuse',
    evidence: failedEvaluations.map((report) => {
      const skill = report.skill_path ?? report.skill ?? targetSkill;
      const issues = [
        ...(Array.isArray(report.blocking_issues) ? report.blocking_issues : []),
        ...(Array.isArray(report.redo_reasons) ? report.redo_reasons : [])
      ].map((issue) => typeof issue === 'string' ? issue : issue.message ?? JSON.stringify(issue));
      return `${skill}: score ${report.score ?? 'unknown'}/${report.threshold ?? 80}; ${issues.join('; ')}`.trim();
    }),
    suggestedTargets: unique([
      ...failedEvaluations.flatMap((report) => skillTargetsFor(report.skill_path ?? report.skill ?? targetSkill, { includeFixtures: true, includeValidation: true })),
      'skills/game-account-skill-evaluator/references/evaluation-rubric.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md'
    ]),
    autopatchSafe: false
  });
}

const cleanupReports = [
  ...(artifact.cleanup_report ? [artifact.cleanup_report] : []),
  ...(Array.isArray(artifact.cleanup_reports) ? artifact.cleanup_reports : [])
];
const browserLikeAttempts = attempts.filter((attempt) => {
  const text = [
    attempt.tool,
    attempt.method,
    attempt.source,
    attempt.fallback_used,
    attempt.adapter_command,
    attempt.detail_adapter_command,
    attempt.verify_command,
    attempt.evidence,
    attempt.url
  ].filter(Boolean).join('\n');
  return /opencli\s+browser|browser_cdp|manual_browser_dom|CDP|Chrome|tab|target|pzds:health|goodsList|selectPageList|pxb7|pzds/i.test(text);
});
const attemptsMissingQuerySession = browserLikeAttempts.filter((attempt) => {
  const hasSession = attempt.query_session_id || attempt.session || attempt.browser_session || attempt.opencli_session;
  const explicitNoBrowser = attempt.browser_used === false || attempt.no_browser === true;
  return !hasSession && !explicitNoBrowser;
});
const cleanupMissing = browserLikeAttempts.length > 0 && cleanupReports.length === 0;
const residualProcessReports = cleanupReports.filter((report) => {
  const residuals = [
    ...(Array.isArray(report.process_audit_after) ? report.process_audit_after : []),
    ...(Array.isArray(report.residual_processes) ? report.residual_processes : []),
    ...(Array.isArray(report.leftover_processes) ? report.leftover_processes : [])
  ];
  return residuals.some((line) => /opencli\s+browser\s+gas-|run-with-timeout|pxb7|pzds|zzz-detail|selectPageList|goodsList\/275/i.test(String(line)));
});
const incompleteBrowserTargetReports = cleanupReports.filter((report) => (
  report?.ok === false
  || (Array.isArray(report?.cdp_targets_remaining) && report.cdp_targets_remaining.length > 0)
));
if (cleanupMissing || attemptsMissingQuerySession.length || residualProcessReports.length || incompleteBrowserTargetReports.length) {
  addFinding({
    id: 'runtime-browser-session-cleanup-missing',
    severity: residualProcessReports.length || incompleteBrowserTargetReports.length ? 'high' : 'medium',
    category: 'runtime',
    summary: 'Browser/OpenCLI query sessions must be named, cleaned up, and audited before final output',
    evidence: [
      cleanupMissing ? 'browser-like platform attempts were recorded but no cleanup_report/cleanup_reports were attached' : null,
      ...attemptsMissingQuerySession.map((attempt) => `${platformName(attempt)} ${attempt.query ?? attempt.url ?? ''}: missing query_session_id/browser_session for browser-backed path`),
      ...residualProcessReports.flatMap((report) => {
        const residuals = [
          ...(Array.isArray(report.process_audit_after) ? report.process_audit_after : []),
          ...(Array.isArray(report.residual_processes) ? report.residual_processes : []),
          ...(Array.isArray(report.leftover_processes) ? report.leftover_processes : [])
        ];
        return residuals.map((line) => `residual process after cleanup: ${line}`);
      }),
      ...incompleteBrowserTargetReports.flatMap((report) => [
        report?.ok === false ? `cleanup_report ok=false${report.error ? `: ${report.error}` : ''}` : null,
        ...(Array.isArray(report?.cdp_targets_remaining)
          ? report.cdp_targets_remaining.map((targetId) => `browser target remained after cleanup: ${targetId}`)
          : []),
      ]),
    ].filter(Boolean),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-toolkit/scripts/cleanup-query-session.mjs',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: true
  });
}

const slowAttempts = [...attempts, ...communityAttempts].filter((attempt) => Number(attempt.duration_ms ?? 0) >= 30000 || attempt.status === 'timeout');
if (slowAttempts.length) {
  const platforms = [...new Set(slowAttempts.map(platformName))];
  addFinding({
    id: 'runtime-slow-platform-path',
    severity: 'high',
    category: 'runtime',
    summary: `Slow or timed-out platform path detected: ${platforms.join(', ')}`,
    evidence: slowAttempts.map((attempt) => {
      const budget = attempt.wait_budget_ms ? `budget=${attempt.wait_budget_ms}ms` : 'budget=missing';
      return `${platformName(attempt)} ${attempt.tool ?? ''} ${attempt.query ?? ''}: ${attempt.duration_ms ?? 'unknown'}ms ${budget} ${attempt.evidence ?? attempt.error_text ?? ''}`.trim();
    }),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-toolkit/references/community-research-protocol.md'
    ],
    autopatchSafe: true
  });
}

const missingBudgetAttempts = [...attempts, ...communityAttempts].filter((attempt) => {
  const duration = Number(attempt.duration_ms ?? 0);
  return duration >= 10000 && attempt.wait_budget_ms == null;
});
if (missingBudgetAttempts.length) {
  addFinding({
    id: 'runtime-missing-wait-budget',
    severity: 'medium',
    category: 'runtime',
    summary: 'Slow platform or community attempts should record an explicit wait budget',
    evidence: missingBudgetAttempts.map((attempt) => `${platformName(attempt)} ${attempt.tool ?? ''} ${attempt.query ?? ''}: duration=${attempt.duration_ms ?? 'unknown'}ms`),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-toolkit/references/community-research-protocol.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md'
    ],
    autopatchSafe: true
  });
}

const emptyAttempts = attempts.filter((attempt) => {
  const status = String(attempt.status ?? '');
  const evidence = `${attempt.error_text ?? ''}\n${attempt.evidence ?? ''}`;
  return status === 'empty_result'
    || status === 'empty'
    || status === 'blocked'
    || status === 'login_required'
    || status === 'error'
    || /(?:^|\D)503(?:\D|$)|detail page returned|详情页.*(?:失败|不可读)/i.test(evidence)
    || Number(attempt.result_count ?? 0) === 0 && !['success', 'partial', 'timeout'].includes(status);
});
if (emptyAttempts.length) {
  addFinding({
    id: 'empty-result-fallback-needed',
    severity: 'medium',
    category: 'empty_result',
    summary: 'One or more platform paths returned no usable listings and need an explicit fallback path',
    evidence: emptyAttempts.map((attempt) => `${platformName(attempt)} ${attempt.status}: ${attempt.evidence ?? attempt.query ?? ''}`),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md'
    ],
    autopatchSafe: true
  });
}

function explicitFalse(value) {
  return value === false || String(value).toLowerCase() === 'false';
}

function explicitTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function hasVerifiedAdapter(attempt) {
  const text = [
    explicitTrue(attempt.adapter_available) ? 'adapter_available_true' : '',
    explicitTrue(attempt.opencli_adapter_available) ? 'opencli_adapter_available_true' : '',
    explicitTrue(attempt.detail_adapter_available) ? 'detail_adapter_available_true' : '',
    explicitTrue(attempt.adapter_verified) ? 'adapter_verified_true' : '',
    explicitTrue(attempt.detail_adapter_verified) ? 'detail_adapter_verified_true' : '',
    attempt.opencli_adapter,
    attempt.adapter_command,
    attempt.detail_adapter_command,
    attempt.verify_command
  ].filter(Boolean).join('\n');
  return /adapter_available_true|opencli_adapter_available_true|detail_adapter_available_true|adapter_verified_true|detail_adapter_verified_true|opencli\s+(?:browser\s+\S+\s+verify\s+)?(?:pxb7|pzds)\/(?:detail|zzz-detail)|opencli\s+(?:pxb7|pzds)\s+(?:detail|zzz-detail)/i.test(text);
}

function hasExplicitAdapterGap(attempt) {
  const fallbackText = [
    attempt.tool,
    attempt.fallback_used,
    attempt.error_text,
    attempt.evidence
  ].filter(Boolean).join('\n');
  const listGap = explicitFalse(attempt.list_adapter_available)
    && /browser_cdp|manual_browser_dom|browser DOM|自然导航|one-?off|临时|手工|截图|list adapter|列表.*(?:adapter|适配器).*缺|列表.*降级/i.test(fallbackText);
  const detailGap = explicitFalse(attempt.detail_adapter_available)
    && /browser_cdp|manual_browser_dom|browser DOM|detail|详情|one-?off|临时|手工|截图|detail adapter|详情.*(?:adapter|适配器).*缺|详情.*降级/i.test(fallbackText);
  const text = [
    explicitFalse(attempt.adapter_available) ? 'adapter_available_false' : '',
    explicitFalse(attempt.opencli_adapter_available) ? 'opencli_adapter_available_false' : '',
    listGap ? 'list_adapter_available_false' : '',
    detailGap ? 'detail_adapter_available_false' : '',
    attempt.tool,
    attempt.fallback_used,
    attempt.error_text,
    attempt.evidence
  ].filter(Boolean).join('\n');
  return /adapter_available_false|opencli_adapter_available_false|list_adapter_available_false|detail_adapter_available_false|no\s+opencli\s+adapter|missing\s+adapter|没有.*adapter|没有.*适配器|无.*adapter/i.test(text);
}

const adapterGapAttempts = attempts.filter((attempt) => {
  if (hasVerifiedAdapter(attempt) && !explicitFalse(attempt.list_adapter_available) && !explicitFalse(attempt.detail_adapter_available)) return false;
  if (hasExplicitAdapterGap(attempt)) return true;

  const text = [
    attempt.tool,
    attempt.fallback_used,
    attempt.error_text,
    attempt.evidence
  ].filter(Boolean).join('\n');
  return !hasVerifiedAdapter(attempt) && /browser_cdp|manual_browser_dom/i.test(text);
});
const verifiedAdapterAttempts = attempts.filter((attempt) => {
  return hasVerifiedAdapter(attempt);
});
if (adapterGapAttempts.length) {
  addFinding({
    id: 'platform-opencli-adapter-gap',
    severity: 'medium',
    category: 'platform_coverage',
    summary: 'Repeat platform paths without a reusable OpenCLI adapter should become adapter-generation candidates',
    evidence: adapterGapAttempts.map((attempt) => {
      const source = `${platformName(attempt)} ${attempt.query ?? attempt.url ?? ''}`.trim();
      const capability = [
        explicitFalse(attempt.list_adapter_available) ? 'list_adapter_available=false' : null,
        explicitFalse(attempt.detail_adapter_available) ? 'detail_adapter_available=false' : null,
        explicitTrue(attempt.detail_adapter_available) ? 'detail_adapter_available=true' : null
      ].filter(Boolean).join(' ');
      const fallback = attempt.fallback_used ? `fallback=${attempt.fallback_used}` : 'fallback=missing';
      const note = attempt.error_text ?? attempt.evidence ?? '';
      return `${source}: ${capability} ${fallback} ${note}`.trim();
    }),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: false
  });
}
if (verifiedAdapterAttempts.length) {
  addFinding({
    id: 'platform-opencli-adapter-reuse',
    severity: 'info',
    category: 'platform_coverage',
    summary: 'Verified OpenCLI adapters should be reused before falling back to manual browser DOM reads',
    evidence: verifiedAdapterAttempts.map((attempt) => {
      const source = `${platformName(attempt)} ${attempt.query ?? attempt.url ?? ''}`.trim();
      const command = attempt.detail_adapter_command ?? attempt.adapter_command ?? attempt.opencli_adapter ?? 'adapter command missing';
      const verify = attempt.verify_command ? `verify=${attempt.verify_command}` : 'verify=missing';
      return `${source}: ${command}; ${verify}; ${attempt.evidence ?? ''}`.trim();
    }),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: true
  });
}

function isZenlessRun() {
  const text = [
    artifact.game,
    targetSkill,
    artifact.user_request,
    finalResponse,
    ...recommendations.map((item) => JSON.stringify(item)),
    ...backupListings.map((item) => JSON.stringify(item)),
    ...excludedListings.map((item) => JSON.stringify(item))
  ].join('\n');
  return /zenless|绝区零|zzz|虚狩|星见雅|仪玄|叶瞬光/i.test(text);
}

function listingPlatform(listing) {
  return platformName({
    platform: listing.platform,
    source: listing.source,
    url: listing.url ?? listing.href
  });
}

function hasAgentStatuses(listing) {
  const assets = listing.game_assets ?? {};
  const statusCandidates = [
    listing.agentStatuses,
    listing.agent_statuses,
    listing.asset_statuses,
    listing.agent_status_map,
    assets.agent_statuses,
    assets.agentStatuses,
    assets.game_specific?.agent_statuses,
    assets.game_specific?.agentStatuses
  ];

  return statusCandidates.some((value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim().length > 0;
  });
}

function valueHasEntries(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim().length > 0;
}

function hasSWeaponNames(listing) {
  const assets = listing.game_assets ?? {};
  const candidates = [
    listing.sWEngineNames,
    listing.s_w_engine_names,
    listing.signatureEngines,
    listing.signature_engines,
    listing.wEngines,
    listing.w_engines,
    assets.sWEngineNames,
    assets.s_w_engine_names,
    assets.sWEngines,
    assets.s_w_engines,
    assets.w_engines,
    assets.wEngines,
    assets.game_specific?.sWEngineNames,
    assets.game_specific?.s_w_engine_names,
    assets.game_specific?.w_engines
  ];

  return candidates.some(valueHasEntries);
}

function hasSingleNumberAgentStatus(listing) {
  const assets = listing.game_assets ?? {};
  const statusCandidates = [
    listing.agentStatuses,
    listing.agent_statuses,
    listing.asset_statuses,
    listing.agent_status_map,
    assets.agent_statuses,
    assets.agentStatuses,
    assets.game_specific?.agent_statuses,
    assets.game_specific?.agentStatuses
  ].filter(Boolean);

  for (const candidate of statusCandidates) {
    const values = Array.isArray(candidate)
      ? candidate.map((item) => item?.status ?? item?.raw ?? item?.text ?? item)
      : typeof candidate === 'object'
        ? Object.values(candidate).map((item) => item?.status ?? item?.raw ?? item?.text ?? item)
        : [candidate];
    if (values.some((value) => /^\s*\d+\s*$/.test(String(value ?? '')))) return true;
  }
  return false;
}

function claimsSignatureCompleteness(listing) {
  return /专武|专属音擎|带签|签名|signature|W-Engine|S级音擎|S级武器|0\s*\+\s*1|1\s*\+\s*1|2\s*\+\s*1/i.test(JSON.stringify(listing));
}

const verifiedDetailPlatforms = new Set(verifiedAdapterAttempts
  .map(platformName)
  .filter((platform) => ['pxb7', 'pzds'].includes(platform)));
const statusRelevantListings = [...recommendations, ...backupListings]
  .filter((listing) => verifiedDetailPlatforms.has(listingPlatform(listing)))
  .filter((listing) => {
    const text = JSON.stringify(listing);
    return /voidHunters|虚狩|星见雅|仪玄|叶瞬光|S级代理人|S代理人/i.test(text) || isZenlessRun();
  });
const listingsMissingAgentStatuses = statusRelevantListings.filter((listing) => !hasAgentStatuses(listing));
if (isZenlessRun() && verifiedDetailPlatforms.size > 0 && listingsMissingAgentStatuses.length > 0) {
  addFinding({
    id: 'platform-agent-status-asset-cards-missing',
    severity: 'high',
    category: 'platform_coverage',
    summary: 'ZZZ pxb7/pzds detail results should preserve asset-card agentStatuses before valuation',
    evidence: [
      ...verifiedAdapterAttempts
        .filter((attempt) => verifiedDetailPlatforms.has(platformName(attempt)))
        .map((attempt) => `${platformName(attempt)} verified detail adapter: ${attempt.adapter_command ?? attempt.detail_adapter_command ?? attempt.opencli_adapter ?? 'command missing'}`),
      ...listingsMissingAgentStatuses.map((listing) => {
        const id = listing.listing_id ?? listing.id ?? listing.title ?? listing.url ?? 'unknown';
        return `${listingPlatform(listing)} ${id}: missing agentStatuses while using ZZZ asset-card detail data`;
      })
    ],
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-zenless-zone-zero/references/valuation-rules.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: false
  });
}

const listingsMissingSWeaponNames = statusRelevantListings
  .filter((listing) => hasAgentStatuses(listing))
  .filter((listing) => hasSingleNumberAgentStatus(listing))
  .filter((listing) => !hasSWeaponNames(listing))
  .filter((listing) => claimsSignatureCompleteness(listing) || /专武|专属音擎|带签|签名|signature|W-Engine/i.test(`${finalResponse}\n${artifact.user_request ?? ''}`));
if (isZenlessRun() && verifiedDetailPlatforms.size > 0 && listingsMissingSWeaponNames.length > 0) {
  addFinding({
    id: 'platform-signature-engine-name-list-missing',
    severity: 'high',
    category: 'platform_coverage',
    summary: 'ZZZ single-number asset badges need S-rank W-Engine names for signature-engine cross-checking',
    evidence: listingsMissingSWeaponNames.map((listing) => {
      const id = listing.listing_id ?? listing.id ?? listing.title ?? listing.url ?? 'unknown';
      return `${listingPlatform(listing)} ${id}: agentStatuses include x-only badges but no sWEngineNames / game_assets.s_w_engine_names for signature W-Engine matching`;
    }),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-toolkit/opencli-adapters/games/zenless-zone-zero/clis/pxb7/zzz-detail.js',
      'skills/game-account-toolkit/opencli-adapters/games/zenless-zone-zero/clis/pzds/zzz-detail.js',
      'skills/game-account-zenless-zone-zero/references/signature-engines.json',
      'skills/game-account-zenless-zone-zero/references/valuation-rules.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: false
  });
}

const pzdsWrongListRouteAttempts = attempts.filter((attempt) => {
  if (platformName(attempt) !== 'pzds' || !isZenlessRun()) return false;

  const text = [
    attempt.url,
    attempt.query,
    attempt.error_text,
    attempt.evidence,
    attempt.final_url
  ].filter(Boolean).join('\n');
  const usedDetailCategoryAsList = /goodsList\/6(?:\b|[/?#])/i.test(text)
    || /goodsDetails\/[0-9A-Z]+\/6.*goodsList\/6|goodsList\/6.*goodsDetails\/[0-9A-Z]+\/6/i.test(text)
    || /详情.*\/6.*(?:列表|gameId|区服|频道)|(?:列表|gameId|区服|频道).*详情.*\/6/i.test(text);
  const wrongGameEvidence = /英雄联盟|League of Legends|非\s*ZZZ|非绝区零|wrong[_ -]?game|wrong game|不是绝区零|错误频道/i.test(text);

  return usedDetailCategoryAsList || wrongGameEvidence;
});
if (pzdsWrongListRouteAttempts.length) {
  addFinding({
    id: 'platform-pzds-zzz-list-route-mismatch',
    severity: 'high',
    category: 'platform_coverage',
    summary: 'PZDS ZZZ list coverage used the detail-page category segment as a goodsList game id',
    evidence: pzdsWrongListRouteAttempts.map((attempt) => {
      const source = `${platformName(attempt)} ${attempt.url ?? attempt.query ?? ''}`.trim();
      const status = attempt.status ? `status=${attempt.status}` : 'status=unknown';
      const note = attempt.error_text ?? attempt.evidence ?? '';
      return `${source}: ${status}; ${note}`.trim();
    }),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'skills/game-account-skill-optimizer/references/optimization-workflow.md',
      'skills/game-account-skill-optimizer/references/issue-taxonomy.md',
      'skills/game-account-skill-optimizer/references/optimization-knowledge.md'
    ],
    autopatchSafe: true
  });
}

const attemptedPlatforms = new Set(attempts.map(platformName));
const explicitMissing = new Set(Array.isArray(artifact.missing_platforms) ? artifact.missing_platforms.map((platform) => platformAliasMap.get(String(platform).toLowerCase()) ?? String(platform)) : []);
const declaredRequiredPlatforms = artifact.success_criteria?.minimum_source_coverage?.platforms;
const requiredPlatforms = Array.isArray(declaredRequiredPlatforms) && declaredRequiredPlatforms.length
  ? declaredRequiredPlatforms.map((platform) => platformAliasMap.get(String(platform).toLowerCase()) ?? String(platform))
  : DEFAULT_REQUIRED_PLATFORMS;
const missingRequiredPlatforms = requiredPlatforms.filter((platform) => {
  return explicitMissing.has(platform) || !attemptedPlatforms.has(platform);
});
if (missingRequiredPlatforms.length) {
  addFinding({
    id: 'platform-coverage-mainstream-sources',
    severity: 'high',
    category: 'platform_coverage',
    summary: `Required account platforms were not covered: ${missingRequiredPlatforms.join(', ')}`,
    evidence: missingRequiredPlatforms.map((platform) => `${platform} was missing from the run artifact`),
    suggestedTargets: [
      'skills/game-account-select/SKILL.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md',
      'docs/product/game-account-selection-assistant.md'
    ],
    autopatchSafe: true
  });
}

const isArknightsRun = /arknights|明日方舟/i.test(`${artifact.game ?? ''} ${targetSkill}`);
const requiresDualPlatformOutput = isArknightsRun && ['pxb7', 'pzds'].every((platform) => requiredPlatforms.includes(platform));
if (requiresDualPlatformOutput) {
  const shortlists = artifact.platform_shortlists;
  const missingSections = ['pxb7', 'pzds'].filter((platform) => !shortlists?.[platform] || typeof shortlists[platform] !== 'object');
  const emptySections = ['pxb7', 'pzds'].filter((platform) => {
    const section = shortlists?.[platform];
    if (!section) return false;
    const visible = Array.isArray(section.display_candidates) ? section.display_candidates : [];
    return visible.length === 0;
  });
  if (missingSections.length || emptySections.length) {
    addFinding({
      id: 'output-dual-platform-shortlists-missing',
      severity: 'high',
      category: 'output_format',
      summary: 'Arknights proactive discovery must show separate PXB7 and PZDS candidate sections',
      evidence: [
        ...missingSections.map((platform) => `${platform} platform_shortlists section is missing`),
        ...emptySections.map((platform) => `${platform} platform_shortlists.display_candidates is empty`),
      ],
      suggestedTargets: [
        'skills/game-account-arknights/SKILL.md',
        'skills/game-account-select/references/source-coverage-playbook.md',
        'skills/game-account-toolkit/references/shared-listing-schema.md',
        'skills/game-account-arknights/scripts/run-dual-platform-selection.mjs',
      ],
      autopatchSafe: true,
    });
  }

  const allQualifying = ['pxb7', 'pzds'].flatMap((platform) => Array.isArray(shortlists?.[platform]?.qualifying) ? shortlists[platform].qualifying : []);
  if (allQualifying.length && !artifact.best_value_listing) {
    addFinding({
      id: 'output-cross-platform-best-value-missing',
      severity: 'medium',
      category: 'output_format',
      summary: 'Dual-platform Arknights output should identify the highest-ranked qualifying account across both platforms',
      evidence: [`qualifying shortlist rows=${allQualifying.length}`, 'best_value_listing is missing'],
      suggestedTargets: [
        'skills/game-account-arknights/SKILL.md',
        'skills/game-account-arknights/scripts/run-dual-platform-selection.mjs',
      ],
      autopatchSafe: true,
    });
  }

  const presentation = artifact.presentation && typeof artifact.presentation === 'object' ? artifact.presentation : null;
  const tablePattern = /\|\s*(?:层级|推荐层级)\s*\|[\s\S]*\|\s*(?:价格|价格\/区服)/;
  if (presentation?.format !== 'markdown_tables' || !tablePattern.test(finalResponse)) {
    addFinding({
      id: 'output-platform-table-presentation-missing',
      severity: 'high',
      category: 'output_format',
      summary: 'Arknights dual-platform results must be finalized as user-visible Markdown tables',
      evidence: [
        `presentation.format=${presentation?.format ?? 'missing'}`,
        `final_response_has_markdown_table=${tablePattern.test(finalResponse)}`,
        `final_response_chars=${finalResponse.length}`,
      ],
      suggestedTargets: [
        'skills/game-account-arknights/SKILL.md',
        'skills/game-account-arknights/scripts/render-selection-report.mjs',
        'skills/game-account-arknights/scripts/finalize-selection-run.mjs',
        'skills/game-account-arknights/scripts/run-dual-platform-selection.mjs',
      ],
      autopatchSafe: true,
    });
  }

  const requestedVisible = Math.max(1, Number(
    artifact.coverage_plan?.completeness_gates?.min_display_candidates_per_platform
      ?? presentation?.per_platform_requested
      ?? 5
  ) || 5);
  const renderCoverageEvidence = [];
  for (const platform of ['pxb7', 'pzds']) {
    const section = shortlists?.[platform];
    if (!section) continue;
    const candidates = [...new Map([
      ...(Array.isArray(section.display_candidates) ? section.display_candidates : []),
      ...(Array.isArray(section.qualifying) ? section.qualifying : []),
      ...(Array.isArray(section.near_matches) ? section.near_matches : []),
      ...(Array.isArray(section.list_only_candidates) ? section.list_only_candidates : []),
    ].map((listing) => [`${listing?.platform ?? platform}:${listing?.listing_id ?? listing?.url ?? ''}`, listing])).values()];
    const expected = Math.min(requestedVisible, candidates.length);
    const countedFromResponse = candidates.filter((listing) => {
      const id = String(listing?.listing_id ?? '');
      const url = String(listing?.url ?? '');
      return Boolean(id && finalResponse.includes(id) || url && finalResponse.includes(url));
    }).length;
    const declaredRendered = Number(presentation?.per_platform_rendered?.[platform]);
    const rendered = Number.isFinite(declaredRendered) ? Math.min(declaredRendered, countedFromResponse) : countedFromResponse;
    if (rendered < expected) renderCoverageEvidence.push(`${platform} available=${candidates.length} expected_rendered=${expected} actual_rendered=${rendered}`);
  }
  if (renderCoverageEvidence.length) {
    addFinding({
      id: 'output-platform-shortlist-render-underfilled',
      severity: 'high',
      category: 'output_format',
      summary: 'The final response dropped candidates that were already available in platform shortlists',
      evidence: renderCoverageEvidence,
      suggestedTargets: [
        'skills/game-account-arknights/scripts/render-selection-report.mjs',
        'skills/game-account-arknights/scripts/finalize-selection-run.mjs',
        'skills/game-account-arknights/scripts/run-dual-platform-selection.mjs',
        'skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs',
      ],
      autopatchSafe: true,
    });
  }

  const selfImprove = artifact.self_improve && typeof artifact.self_improve === 'object' ? artifact.self_improve : null;
  if (selfImprove?.closeout_required !== true || selfImprove?.summary_generated !== true || !selfImprove?.optimizer || !selfImprove?.evaluator) {
    addFinding({
      id: 'self-improve-closeout-missing',
      severity: 'high',
      category: 'quality_gate',
      summary: 'A real selection run must finish with a structured experience, optimizer, and evaluator closeout',
      evidence: [
        `self_improve=${selfImprove ? 'present' : 'missing'}`,
        `summary_generated=${selfImprove?.summary_generated ?? false}`,
        `optimizer_state=${selfImprove?.optimizer?.status ?? 'missing'}`,
        `evaluator_state=${selfImprove?.evaluator?.status ?? 'missing'}`,
        `knowledge_update_candidates=${knowledgeCandidates.length}`,
      ],
      suggestedTargets: [
        'skills/game-account-arknights/SKILL.md',
        'skills/game-account-arknights/scripts/finalize-selection-run.mjs',
        'skills/game-account-skill-optimizer/references/optimization-workflow.md',
        'skills/game-account-skill-evaluator/references/evaluation-rubric.md',
      ],
      autopatchSafe: true,
    });
  }

  if (knowledgeCandidates.length && !/知识沉淀|knowledge update|knowledge_update/i.test(finalResponse)) {
    addFinding({
      id: 'self-improve-knowledge-status-undisclosed',
      severity: 'medium',
      category: 'output_format',
      summary: 'The user-facing closeout must distinguish applied knowledge updates from proposed candidates',
      evidence: [`knowledge_update_candidates=${knowledgeCandidates.length}`, 'final response does not disclose applied versus pending knowledge status'],
      suggestedTargets: [
        'skills/game-account-arknights/scripts/render-selection-report.mjs',
        'skills/game-account-select/references/knowledge-ledger.md',
      ],
      autopatchSafe: true,
    });
  }
}

if (/<(?:game_account_evaluation|recommendations|skill_quality_report|community_refresh_report)\b/.test(finalResponse)) {
  addFinding({
    id: 'output-format-raw-tags',
    severity: 'medium',
    category: 'output_format',
    summary: 'Final user-facing response exposed raw machine-readable tags',
    evidence: ['final_response contains XML-style account evaluation tags'],
    suggestedTargets: [
      'skills/game-account-select/SKILL.md',
      'skills/game-account-toolkit/references/skill-io-contract.md'
    ],
    autopatchSafe: true
  });
}

const feedback = [
  ...(Array.isArray(artifact.user_feedback) ? artifact.user_feedback : []),
  ...(Array.isArray(artifact.rule_update_suggestions) ? artifact.rule_update_suggestions : [])
].join('\n');

const valuationPattern = /配队|队伍|team|主\s*C|主c|main\s*dps|专武|专属音擎|音擎|弧盘|模组|专精|限定|联动|命座|影画|潜能|核心角色|2\s*\+\s*1|1\s*\+\s*1|0\s*\+\s*1|1\s*\+\s*0|0\s*\+\s*0|舒适度|加分项|性价比|直伤电|异放|紊乱|妄想天使|薇薇安|Vivian|希希芙|希德|席德|耀佳音|耀嘉音|琉音|南宫羽/i;
const independentTeamPattern = /三\s*(?:队|支)|独立\s*(?:队|三队)|三虚狩|虚狩|3\s*虚狩|柚叶|南宫|狼|苍角|照|耀佳音|耀嘉音|琉音|卢西娅|橘福福|希希芙|希德|席德|妄想天使|异放|紊乱|薇薇安|Vivian|直伤电|最适配|适配队友|下位替代|共享辅助|抢(?:人|队友|辅助)|组成三队/i;
const independentTeamConcernPattern = /不(?:能|足|完整|算|应)|缺|少|共享|抢|重复|无法|没法|没有证明|未证明|未验证|下位|旧口径|陷阱|误判|补齐|确认|风险/i;
const hardConditionBudgetPattern = /给定金额.*(?:没有|无|不足).*满足|预算.*(?:没有|无|不足).*满足|没有满足条件|无满足条件|扩大(?:金额|预算|价格|范围)|突破.{0,6}(?:预算|价位|价格)|超预算|提高.{0,4}(?:预算|额度)|价格最低.*满足|最低.*满足|最低满足价|硬性标准.*预算/i;
const uncertaintyText = [
  finalResponse,
  feedback,
  String(artifact.user_request ?? ''),
  ...(Array.isArray(artifact.rule_update_suggestions) ? artifact.rule_update_suggestions : []),
  ...(Array.isArray(artifact.evidence_notes) ? artifact.evidence_notes : []),
  ...recommendations.map((item) => JSON.stringify(item)),
  ...backupListings.map((item) => JSON.stringify(item)),
  ...excludedListings.map((item) => JSON.stringify(item))
].join('\n');
if (valuationPattern.test(feedback)) {
  addFinding({
    id: 'valuation-team-archetypes',
    severity: 'high',
    category: 'valuation',
    summary: 'Valuation should account for game-specific meta assets, teams, progression, and key equipment fit',
    evidence: feedback.split('\n').filter((line) => valuationPattern.test(line)),
    suggestedTargets: targetSkillTargets({ includeFixtures: true, includeValidation: true }),
    autopatchSafe: false
  });
}

const independentTeamEvidence = [
  ...feedback.split('\n').filter((line) => independentTeamPattern.test(line)),
  ...finalResponse.split('\n').filter((line) => independentTeamPattern.test(line) && independentTeamConcernPattern.test(line))
].filter(Boolean);
if (independentTeamEvidence.length) {
  addFinding({
    id: 'valuation-independent-team-completeness',
    severity: 'high',
    category: 'valuation',
    summary: 'Hard team requirements should verify independent team completeness instead of counting shared supports as complete teams',
    evidence: independentTeamEvidence,
    suggestedTargets: [
      ...targetSkillTargets({ includeFixtures: true, includeValidation: true }),
      'skills/game-account-select/references/selection-state-machine.md'
    ],
    autopatchSafe: false
  });
}

const expansionAuthorized = selectionProfile?.budget_expansion?.enabled === true
  || artifact.budget_expansion?.enabled === true
  || hardConditionBudgetPattern.test(String(artifact.user_request ?? ''));
const primaryBudgetMax = Number(selectionProfile?.budget?.primary_max ?? artifact.budget?.primary_max ?? artifact.budget?.max ?? Number.NaN);
const flexibleBudgetMax = Number(selectionProfile?.budget?.flex_max ?? artifact.budget?.flex_max ?? primaryBudgetMax);
const listingHardPasses = (listing) => listing?.hard_filter_passed !== false
  && listing?.score?.hard_filter_passed !== false
  && !(listing?.hard_filter && Object.values(listing.hard_filter).some((value) => value === false));
const listingExplicitlyPassesHardConditions = (listing) => listing?.hard_filter_passed === true
  || listing?.score?.hard_filter_passed === true
  || (listing?.hard_filter && Object.keys(listing.hard_filter).length > 0 && Object.values(listing.hard_filter).every((value) => value === true));
const inBudgetListings = [...recommendations, ...backupListings];
const hasInBudgetExactMatch = inBudgetListings.some((listing) => {
  if (!listingHardPasses(listing) || expansionAuthorized && !listingExplicitlyPassesHardConditions(listing)) return false;
  const price = Number(listing.price);
  return !Number.isFinite(flexibleBudgetMax) || !Number.isFinite(price) || price <= flexibleBudgetMax;
});
const legacyStrictBackups = backupListings.filter((listing) => /lowest_strict|strict_match|budget_breakthrough|higher_investment_strict/i.test(String(listing.recommendation_tier ?? listing.tier ?? '')) && listingHardPasses(listing));
const exactBeyondBudget = [...budgetBreakthroughListings, ...legacyStrictBackups];
const budgetExpansionAttempts = attempts.flatMap((attempt) => {
  const direct = String(attempt.phase ?? attempt.type ?? '').toLowerCase() === 'budget_expansion' ? [attempt] : [];
  const nested = attempt.budget_expansion && typeof attempt.budget_expansion === 'object'
    ? [{ ...attempt.budget_expansion, platform: attempt.platform }]
    : [];
  return [...direct, ...nested];
});
const auditedExpansionDirections = new Set(budgetExpansionAttempts.flatMap((attempt) => {
  const directions = [attempt.direction, ...(Array.isArray(attempt.directions) ? attempt.directions : [])];
  const stopReasons = attempt.stop_reasons_by_direction && typeof attempt.stop_reasons_by_direction === 'object'
    ? Object.keys(attempt.stop_reasons_by_direction)
    : [];
  return [...directions, ...stopReasons].filter(Boolean).map((value) => String(value).toLowerCase());
}));
const hasBidirectionalExpansionAudit = auditedExpansionDirections.has('lower') && auditedExpansionDirections.has('higher');
if (expansionAuthorized && !hasInBudgetExactMatch && exactBeyondBudget.length === 0 && !hasBidirectionalExpansionAudit) {
  addFinding({
    id: 'output-hard-condition-budget-expansion',
    severity: 'high',
    category: 'output_format',
    summary: 'When no nearby-budget listing satisfies hard conditions, audit both lower and higher price bands and show any satisfying comparison separately',
    evidence: [
      `primary_budget_max=${Number.isFinite(primaryBudgetMax) ? primaryBudgetMax : 'unknown'}`,
      `flex_budget_max=${Number.isFinite(flexibleBudgetMax) ? flexibleBudgetMax : 'unknown'}`,
      `audited_expansion_directions=${[...auditedExpansionDirections].join(',') || 'none'}`
    ],
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      ...targetSkillTargets()
    ],
    autopatchSafe: true
  });
}
if (selectionProfile?.budget_expansion?.enabled === true && !hasInBudgetExactMatch && exactBeyondBudget.length > 0 && nearMatchListings.length === 0) {
  addFinding({
    id: 'output-budget-breakthrough-near-match-comparison-missing',
    severity: 'medium',
    category: 'output_format',
    summary: 'An out-of-budget exact match should be compared with the best in-budget near matches',
    evidence: [`budget_breakthrough_listings=${budgetBreakthroughListings.length}`, 'near_match_listings=0'],
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      ...targetSkillTargets()
    ],
    autopatchSafe: true
  });
}
if (selectionProfile?.budget_expansion?.enabled === true && exactBeyondBudget.length > 0 && !artifact.budget_comparison) {
  addFinding({
    id: 'output-budget-breakthrough-value-comparison-missing',
    severity: 'medium',
    category: 'output_format',
    summary: 'Budget breakthrough results should quantify what the extra money buys across hard conditions and independent value dimensions',
    evidence: [`budget_breakthrough_listings=${budgetBreakthroughListings.length}`, 'budget_comparison is missing'],
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      ...targetSkillTargets()
    ],
    autopatchSafe: true
  });
}

const needsCommunityEvidence = valuationPattern.test(uncertaintyText)
  || /不确定|无法确认|没读到|未稳定读取|社区证据.*不足|社群|社区|小红书|B站|bilibili|YouTube|youtube|字幕|评论|正文/i.test(uncertaintyText);
const successfulCommunityAttempts = communityAttempts.filter((attempt) => ['success', 'partial', 'limited'].includes(String(attempt.status ?? '')));
if (needsCommunityEvidence && successfulCommunityAttempts.length === 0) {
  addFinding({
    id: 'evidence-community-answer-required',
    severity: 'high',
    category: 'evidence',
    summary: 'Uncertain meta or team valuation should trigger community evidence collection before high-confidence ranking',
    evidence: uncertaintyText.split('\n').filter((line) => valuationPattern.test(line) || /不确定|无法确认|没读到|未稳定读取|社群|社区|小红书|B站|bilibili|YouTube|youtube|字幕|评论|正文/i.test(line)),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/community-research-protocol.md',
      ...targetSkillTargets()
    ],
    autopatchSafe: false
  });
}

const failedCommunityAttempts = communityAttempts.filter((attempt) => ['timeout', 'failed', 'blocked', 'login_required'].includes(String(attempt.status ?? '')));
const communityWithoutFallback = failedCommunityAttempts.filter((attempt) => !attempt.fallback_used);
if (communityWithoutFallback.length) {
  addFinding({
    id: 'evidence-community-tool-fallback-missing',
    severity: 'high',
    category: 'evidence',
    summary: 'Failed community-source reads should switch tools or record a fallback path',
    evidence: communityWithoutFallback.map((attempt) => `${attempt.source ?? platformName(attempt)} ${attempt.tool ?? ''} ${attempt.status}: ${attempt.error_text ?? attempt.query ?? ''}`),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/community-research-protocol.md'
    ],
    autopatchSafe: true
  });
}

const missingFields = Array.isArray(artifact.missing_fields) ? artifact.missing_fields : [];
if (missingFields.some((field) => /TAP|Wegame|PS5|HoYoverse|实名|绑定|换绑|找回|验号|邮箱/.test(field))) {
  addFinding({
    id: 'risk-manual-confirmation-needed',
    severity: 'medium',
    category: 'risk',
    summary: 'Binding and retrieval-risk fields remained unresolved in the recommendation',
    evidence: missingFields,
    suggestedTargets: [
      ...targetSkillTargets(),
      'skills/game-account-toolkit/references/shared-listing-schema.md'
    ],
    autopatchSafe: false
  });
}

const accountRiskText = [
  finalResponse,
  feedback,
  missingFields.join('\n'),
  ...recommendations.map((item) => JSON.stringify(item)),
  ...backupListings.map((item) => JSON.stringify(item)),
  ...excludedListings.map((item) => JSON.stringify(item))
].join('\n');
if (/邮箱未实名出售|未实名邮箱|unverified_email/i.test(accountRiskText) && /加分|优先|避免找回|低找回|误扣|排名/i.test(accountRiskText)) {
  addFinding({
    id: 'risk-email-unverified-positive-signal',
    severity: 'high',
    category: 'risk',
    summary: 'Email-unverified-included account status should be treated as a positive low-retrieval-risk signal',
    evidence: accountRiskText.split('\n').filter((line) => /邮箱未实名出售|未实名邮箱|unverified_email/i.test(line)),
    suggestedTargets: [
      ...targetSkillTargets({ includeFixtures: true, includeValidation: true }),
      'skills/game-account-toolkit/references/shared-listing-schema.md'
    ],
    autopatchSafe: false
  });
}

const listingGroups = [
  ['recommendations', recommendations],
  ['backup_listings', backupListings],
  ['near_match_listings', nearMatchListings],
  ['budget_breakthrough_listings', budgetBreakthroughListings],
  ['excluded_listings', excludedListings]
];
const listingsMissingUrl = listingGroups.flatMap(([group, listings]) => listings
  .filter((listing) => !listing.url && !listing.href)
  .map((listing) => `${group}:${listing.listing_id ?? listing.id ?? listing.title ?? 'unknown'}`));
if (listingsMissingUrl.length) {
  addFinding({
    id: 'output-listing-links-missing',
    severity: 'medium',
    category: 'output_format',
    summary: 'Recommendations, backups, and excluded listings should keep source links for user comparison',
    evidence: listingsMissingUrl,
    suggestedTargets: [
      'skills/game-account-select/SKILL.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md'
    ],
    autopatchSafe: true
  });
}

const listingTimeOmissions = listingGroups.flatMap(([group, listings]) => listings.flatMap((listing) => {
  const listingId = listing.listing_id ?? listing.id ?? listing.title ?? 'unknown';
  const sourcePublishedAt = listing.publishedAt
    ?? listing.listedAt
    ?? listing.platform_facts?.publishedAt
    ?? listing.platform_facts?.listedAt
    ?? listing.game_assets?.platform_facts?.publishedAt
    ?? listing.game_assets?.platform_facts?.listedAt
    ?? null;
  const sourceVerifiedAt = listing.platformVerifiedAt
    ?? listing.verifiedAt
    ?? listing.status?.verifiedAt
    ?? listing.status?.verified_at
    ?? listing.platform_facts?.status?.verifiedAt
    ?? listing.platform_facts?.status?.verified_at
    ?? listing.game_assets?.platform_facts?.status?.verifiedAt
    ?? listing.game_assets?.platform_facts?.status?.verified_at
    ?? null;
  const omissions = [];
  if (sourcePublishedAt && !listing.published_at) {
    omissions.push(`${group}:${listingId} published_at omitted; source=${sourcePublishedAt}`);
  }
  if (sourceVerifiedAt && !listing.platform_verified_at) {
    omissions.push(`${group}:${listingId} platform_verified_at omitted; source=${sourceVerifiedAt}`);
  }
  return omissions;
}));
if (listingTimeOmissions.length) {
  addFinding({
    id: 'output-listing-time-facts-omitted',
    severity: 'medium',
    category: 'output_format',
    summary: 'Available listing or platform-verification times were dropped from normalized recommendation rows',
    evidence: listingTimeOmissions,
    suggestedTargets: [
      'skills/game-account-select/SKILL.md',
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      'skills/game-account-toolkit/references/skill-io-contract.md',
      ...targetSkillTargets({ includeValidation: true })
    ],
    autopatchSafe: true
  });
}

const budget = Number(artifact.budget?.max ?? artifact.budget_max ?? artifact.max_budget ?? Number.NaN);
const allowFlex = artifact.allow_budget_flex === true
  || artifact.budget_flex != null
  || /上下波动|浮动|备选|2,?300|200|300/.test(feedback);
const flexListings = backupListings.filter((listing) => {
  const tier = String(listing.recommendation_tier ?? listing.tier ?? '');
  const price = Number(listing.price ?? Number.NaN);
  return /flex|浮动|over_budget|price/i.test(tier)
    || Number.isFinite(budget) && Number.isFinite(price) && price > budget && price <= budget + 300;
});
if (allowFlex && flexListings.length === 0) {
  addFinding({
    id: 'output-flex-budget-backups-missing',
    severity: 'medium',
    category: 'output_format',
    summary: 'When budget flexibility is allowed, near-budget backup listings should be shown separately from primary recommendations',
    evidence: [
      Number.isFinite(budget) ? `budget_max=${budget}` : 'budget_max=unknown',
      feedback.split('\n').find((line) => /上下波动|浮动|备选|2,?300|200|300/.test(line)) ?? 'budget flexibility requested'
    ],
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md'
    ],
    autopatchSafe: true
  });
}

const evidenceText = [
  finalResponse,
  feedback,
  ...(Array.isArray(artifact.rule_update_suggestions) ? artifact.rule_update_suggestions : []),
  ...(Array.isArray(artifact.evidence_notes) ? artifact.evidence_notes : []),
  String(artifact.community_snapshot_age_days ?? '')
].join('\n');
const snapshotAge = Number(artifact.community_snapshot_age_days ?? Number.NaN);
if (/30\s*天|30\s*day|刷新.*太长|数据更新.*太长|证据.*太久/i.test(evidenceText) || snapshotAge >= 7) {
  addFinding({
    id: 'evidence-refresh-window-too-long',
    severity: 'high',
    category: 'evidence',
    summary: 'Live purchase recommendations need a shorter community-evidence refresh window than 30 days',
    evidence: [
      Number.isFinite(snapshotAge) ? `community_snapshot_age_days=${snapshotAge}` : null,
      ...evidenceText.split('\n').filter((line) => /30\s*天|30\s*day|刷新.*太长|数据更新.*太长|证据.*太久/i.test(line))
    ].filter(Boolean),
    suggestedTargets: [
      ...targetSkillTargets(),
      'skills/game-account-toolkit/references/community-research-protocol.md',
      'skills/game-account-toolkit/templates/game-skill/references/valuation-rules.md'
    ],
    autopatchSafe: false
  });
}

if (feedback.trim()) {
  addFinding({
    id: 'user-feedback-present',
    severity: 'info',
    category: 'user_feedback',
    summary: 'User feedback should be preserved as optimizer evidence before rule changes',
    evidence: feedback.split('\n').filter(Boolean),
    suggestedTargets: [
      'skills/game-account-skill-optimizer/references/changelog.md'
    ],
    autopatchSafe: false
  });
}

const suggestedChanges = findings.map((finding) => ({
  finding_id: finding.id,
  summary: finding.summary,
  targets: finding.suggested_targets,
  autopatch_safe: finding.autopatch_safe
}));

const report = {
  target_skill: targetSkill,
  game: artifact.game ?? 'unknown',
  confidence: findings.length >= 3 ? 'high' : findings.length ? 'medium' : 'high',
  findings,
  suggested_changes: suggestedChanges,
  safe_to_autopatch: findings.length > 0 && findings.every((finding) => finding.autopatch_safe)
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('<skill_optimization_report>');
  console.log(`  <target_skill>${report.target_skill}</target_skill>`);
  console.log(`  <confidence>${report.confidence}</confidence>`);
  console.log(`  <findings format="json">${JSON.stringify(report.findings)}</findings>`);
  console.log(`  <suggested_changes format="json">${JSON.stringify(report.suggested_changes)}</suggested_changes>`);
  console.log(`  <safe_to_autopatch>${report.safe_to_autopatch}</safe_to_autopatch>`);
  console.log('</skill_optimization_report>');
}

process.exit(0);
