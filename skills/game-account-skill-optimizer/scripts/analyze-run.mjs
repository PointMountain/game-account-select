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
const excludedListings = Array.isArray(artifact.excluded_listings) ? artifact.excluded_listings : [];
const finalResponse = String(artifact.final_response ?? '');
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
const missingRequiredPlatforms = DEFAULT_REQUIRED_PLATFORMS.filter((platform) => {
  return explicitMissing.has(platform) || !attemptedPlatforms.has(platform);
});
if (missingRequiredPlatforms.length) {
  addFinding({
    id: 'platform-coverage-mainstream-sources',
    severity: 'high',
    category: 'platform_coverage',
    summary: `Mainstream account platforms were not covered: ${missingRequiredPlatforms.join(', ')}`,
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

const valuationPattern = /配队|队伍|team|主\s*C|主c|main\s*dps|专武|专属音擎|音擎|弧盘|模组|专精|限定|联动|命座|影画|潜能|核心角色|2\s*\+\s*1|1\s*\+\s*1|0\s*\+\s*1|舒适度|加分项|直伤电|异放|紊乱|妄想天使|薇薇安|Vivian|希希芙|希德|席德|耀佳音|耀嘉音/i;
const independentTeamPattern = /三\s*(?:队|支)|独立\s*(?:队|三队)|三虚狩|虚狩|3\s*虚狩|柚叶|南宫|狼|苍角|照|耀佳音|耀嘉音|琉音|卢西娅|橘福福|希希芙|希德|席德|妄想天使|异放|紊乱|薇薇安|Vivian|直伤电|最适配|适配队友|下位替代|共享辅助|抢(?:人|队友|辅助)|组成三队/i;
const hardConditionBudgetPattern = /给定金额.*(?:没有|无|不足).*满足|预算.*(?:没有|无|不足).*满足|没有满足条件|无满足条件|扩大(?:金额|预算|价格|范围)|价格最低.*满足|最低.*满足|最低满足价|硬性标准.*预算/i;
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

if (independentTeamPattern.test(feedback) || independentTeamPattern.test(finalResponse)) {
  addFinding({
    id: 'valuation-independent-team-completeness',
    severity: 'high',
    category: 'valuation',
    summary: 'Hard team requirements should verify independent team completeness instead of counting shared supports as complete teams',
    evidence: [
      ...feedback.split('\n').filter((line) => independentTeamPattern.test(line)),
      ...finalResponse.split('\n').filter((line) => independentTeamPattern.test(line))
    ].filter(Boolean),
    suggestedTargets: [
      ...targetSkillTargets({ includeFixtures: true, includeValidation: true }),
      'skills/game-account-select/references/selection-state-machine.md'
    ],
    autopatchSafe: false
  });
}

if (hardConditionBudgetPattern.test(uncertaintyText)) {
  addFinding({
    id: 'output-hard-condition-budget-expansion',
    severity: 'high',
    category: 'output_format',
    summary: 'When no in-budget listing satisfies hard conditions, expand to a flexible budget and show the cheapest satisfying account separately',
    evidence: uncertaintyText.split('\n').filter((line) => hardConditionBudgetPattern.test(line)),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/shared-listing-schema.md',
      ...targetSkillTargets()
    ],
    autopatchSafe: true
  });
}

const needsCommunityEvidence = valuationPattern.test(uncertaintyText)
  || /不确定|无法确认|没读到|未稳定读取|社区证据.*不足|社群|社区|小红书|B站|bilibili|字幕|评论|正文/i.test(uncertaintyText);
const successfulCommunityAttempts = communityAttempts.filter((attempt) => ['success', 'partial', 'limited'].includes(String(attempt.status ?? '')));
if (needsCommunityEvidence && successfulCommunityAttempts.length === 0) {
  addFinding({
    id: 'evidence-community-answer-required',
    severity: 'high',
    category: 'evidence',
    summary: 'Uncertain meta or team valuation should trigger community evidence collection before high-confidence ranking',
    evidence: uncertaintyText.split('\n').filter((line) => valuationPattern.test(line) || /不确定|无法确认|没读到|未稳定读取|社群|社区|小红书|B站|bilibili|字幕|评论|正文/i.test(line)),
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
