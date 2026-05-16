#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const skillPath = args.find((arg) => !arg.startsWith('--'));
const wantsJson = args.includes('--json');
const thresholdArg = args.find((arg) => arg.startsWith('--threshold='));
const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 80;

if (!skillPath) {
  console.error('Usage: evaluate-skill.mjs <skill-path> [--json] [--threshold=80]');
  process.exit(2);
}

const root = path.resolve(skillPath);
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const issues = [];
const warnings = [];
const suggestedFixes = [];
let score = 0;

function addIssue(message, blocking = true) {
  const item = { message, blocking };
  if (blocking) issues.push(item);
  else warnings.push(item);
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

if (exists('SKILL.md')) score += 6;
else addIssue('Missing SKILL.md');

if (exists('references/valuation-rules.md')) score += 5;
else addIssue('Missing references/valuation-rules.md');

if (exists('references/community-evidence.md')) score += 4;
else addIssue('Missing references/community-evidence.md');

if (exists('references/changelog.md')) score += 3;
else addIssue('Missing references/changelog.md', false);

const referencesPath = path.join(root, 'references');
const knowledgeFile = fs.existsSync(referencesPath)
  ? fs.readdirSync(referencesPath, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name).find((name) => name.endsWith('-knowledge.md') || name === 'asset-knowledge.md')
  : null;
if (knowledgeFile) score += 2;
else addIssue('Missing domain knowledge reference file', false);

if (exists('SKILL.md')) {
  const skill = read('SKILL.md');
  if (containsAny(skill, ['game-account-preflight', '执行前准备', 'preflight'])) score += 5;
  else {
    addIssue('SKILL.md does not require preflight before execution', false);
    suggestedFixes.push('Add an execution-prep section that calls game-account-preflight.');
  }
  if (containsAny(skill, ['<game_account_evaluation>', 'skill-io-contract', '标准'])) score += 6;
  else {
    addIssue('SKILL.md does not reference the standard tag I/O contract', false);
    suggestedFixes.push('Reference game-account-toolkit/references/skill-io-contract.md and emit <game_account_evaluation>.');
  }
  if (containsAny(skill, ['community_comparison', 'rule_update_suggestion', 'confidence'])) score += 4;
  else addIssue('SKILL.md does not require confidence/community comparison/update suggestion fields', false);
}

if (exists('references/valuation-rules.md')) {
  const rules = read('references/valuation-rules.md');
  if (containsAny(rules, ['score_weights', '评分框架', '可执行评分'])) score += 8;
  else addIssue('Valuation rules lack executable score weights');
  if (containsAny(rules, ['排序硬规则', '不得排在', '不能进入 Top 1'])) score += 5;
  else addIssue('Valuation rules lack hard ranking rules against count-only listings');
  if (containsAny(rules, ['risk_penalty', '风险扣分', '绑定', '找回'])) score += 4;
  else addIssue('Valuation rules lack risk penalty logic');
  if (containsAny(rules, ['missing_data_penalty', '缺失', 'missing'])) score += 3;
  else addIssue('Valuation rules lack missing-data penalty logic');
}

if (exists('references/community-evidence.md')) {
  const evidence = read('references/community-evidence.md');
  if (containsAny(evidence, ['updated_at:', 'updated_at'])) score += 3;
  else addIssue('Community evidence lacks updated_at');
  if (containsAny(evidence, ['source_coverage', 'community_confidence'])) score += 5;
  else addIssue('Community evidence lacks source coverage/confidence metadata');
  if (containsAny(evidence, ['http://', 'https://', 'not_checked', 'failed', 'limited'])) score += 4;
  else addIssue('Community evidence lacks source links or explicit coverage limitations', false);
  if (containsAny(evidence, ['局限', 'limitations', '覆盖'])) score += 3;
  else addIssue('Community evidence lacks limitations section', false);
}

if (exists('references/valuation-rules.md')) {
  const rules = read('references/valuation-rules.md');
  if (containsAny(rules, ['总数', '数量', 'count', '泛称', '高稀有度'])) score += 5;
  else addIssue('Rules do not explicitly handle count-only or vague high-rarity traps');
  if (containsAny(rules, ['实名', '绑定', 'PSN', 'TAP', 'HoYoverse', 'Wegame', '官方验号'])) score += 5;
  else addIssue('Rules do not cover account binding/verification risk');
  if (containsAny(rules, ['人工确认', '缺失字段', 'missing_fields'])) score += 5;
  else addIssue('Rules do not require manual confirmation for missing fields', false);
}

const scriptsDir = path.join(root, 'scripts');
const validationScript = fs.existsSync(scriptsDir)
  ? fs.readdirSync(scriptsDir).find((name) => name === 'validate-sample.mjs')
  : null;
if (validationScript) {
  score += 5;
  const run = spawnSync('node', [path.join(scriptsDir, validationScript)], { encoding: 'utf8' });
  if (run.status === 0) score += 10;
  else {
    addIssue(`Validation script failed: ${(run.stderr || run.stdout).trim()}`);
    suggestedFixes.push('Fix validate-sample.mjs so the expected top listing wins.');
  }
} else {
  addIssue('Missing scripts/validate-sample.mjs');
}

score = Math.min(score, 100);
const blockingIssues = issues.filter((issue) => issue.blocking);
const result = {
  skill_path: skillPath,
  score,
  threshold,
  passed: score >= threshold && blockingIssues.length === 0,
  blocking_issues: blockingIssues,
  warnings,
  suggested_fixes: suggestedFixes
};

if (wantsJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('<skill_quality_report>');
  console.log(`  <skill_path>${result.skill_path}</skill_path>`);
  console.log(`  <score>${result.score}</score>`);
  console.log(`  <passed>${result.passed}</passed>`);
  console.log(`  <blocking_issues format="json">${JSON.stringify(result.blocking_issues)}</blocking_issues>`);
  console.log(`  <warnings format="json">${JSON.stringify(result.warnings)}</warnings>`);
  console.log(`  <suggested_fixes format="json">${JSON.stringify(result.suggested_fixes)}</suggested_fixes>`);
  console.log('</skill_quality_report>');
}

process.exit(result.passed ? 0 : 1);
