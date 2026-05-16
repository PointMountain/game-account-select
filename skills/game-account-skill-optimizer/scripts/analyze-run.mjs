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
  const raw = String(attempt.platform ?? 'unknown');
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

const slowAttempts = attempts.filter((attempt) => Number(attempt.duration_ms ?? 0) >= 30000 || attempt.status === 'timeout');
if (slowAttempts.length) {
  const platforms = [...new Set(slowAttempts.map(platformName))];
  addFinding({
    id: 'runtime-slow-platform-path',
    severity: 'high',
    category: 'runtime',
    summary: `Slow or timed-out platform path detected: ${platforms.join(', ')}`,
    evidence: slowAttempts.map((attempt) => `${platformName(attempt)} ${attempt.query ?? ''}: ${attempt.duration_ms ?? 'unknown'}ms ${attempt.evidence ?? ''}`.trim()),
    suggestedTargets: [
      'skills/game-account-select/references/selection-state-machine.md',
      'skills/game-account-toolkit/references/platform-access-policy.md'
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

const finalResponse = String(artifact.final_response ?? '');
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

const valuationPattern = /配队|队伍|team|主\s*C|主c|main\s*dps|专武|专属音擎|音擎|弧盘|模组|专精|限定|联动|命座|影画|潜能|核心角色/i;
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
