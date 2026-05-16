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

function addFinding({ id, severity, category, summary, evidence = [], suggestedTargets = [], autopatchSafe = false }) {
  findings.push({
    id,
    severity,
    category,
    summary,
    evidence,
    suggested_targets: suggestedTargets,
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

if (/配队|爱莫林|卡千夏|日月守|主C|主c|专武/.test(feedback)) {
  addFinding({
    id: 'valuation-team-archetypes',
    severity: 'high',
    category: 'valuation',
    summary: 'Game valuation should account for social-meta team archetypes and main-DPS signature fit',
    evidence: feedback.split('\n').filter((line) => /配队|爱莫林|卡千夏|日月守|主C|主c|专武/.test(line)),
    suggestedTargets: [
      'skills/game-account-wuthering-waves/references/valuation-rules.md',
      'skills/game-account-wuthering-waves/references/character-knowledge.md',
      'skills/game-account-wuthering-waves/test-fixtures/wuthering-waves-validation-sample.json',
      'skills/game-account-wuthering-waves/scripts/validate-sample.mjs'
    ],
    autopatchSafe: false
  });
}

const missingFields = Array.isArray(artifact.missing_fields) ? artifact.missing_fields : [];
if (missingFields.some((field) => /TAP|Wegame|PS5|绑定|换绑|找回|验号/.test(field))) {
  addFinding({
    id: 'risk-manual-confirmation-needed',
    severity: 'medium',
    category: 'risk',
    summary: 'Binding and retrieval-risk fields remained unresolved in the recommendation',
    evidence: missingFields,
    suggestedTargets: [
      'skills/game-account-wuthering-waves/references/valuation-rules.md',
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
  target_skill: artifact.target_skill ?? artifact.skill ?? 'unknown',
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
