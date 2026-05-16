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
const resolveSkillFile = () => {
  const skill = path.join(root, 'SKILL.md');
  if (fs.existsSync(skill)) return skill;

  const fixture = path.join(root, 'SKILL.md.fixture');
  if (fs.existsSync(fixture)) return fixture;

  return null;
};
const skillFile = resolveSkillFile();
const exists = (relative) => {
  if (relative === 'SKILL.md') return Boolean(skillFile);
  return fs.existsSync(path.join(root, relative));
};
const read = (relative) => {
  if (relative === 'SKILL.md') return fs.readFileSync(skillFile, 'utf8');
  return fs.readFileSync(path.join(root, relative), 'utf8');
};
const issues = [];
const warnings = [];
const suggestedFixes = [];
let score = 0;

const expectedOptimizerFindingIds = [
  'runtime-slow-platform-path',
  'empty-result-fallback-needed',
  'platform-coverage-mainstream-sources',
  'output-format-raw-tags',
  'valuation-team-archetypes',
  'risk-manual-confirmation-needed'
];

function addIssue(message, blocking = true) {
  const item = { message, blocking };
  if (blocking) issues.push(item);
  else warnings.push(item);
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function frontmatterName(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const line = match[1].split('\n').find((item) => item.startsWith('name:'));
  return line ? line.replace(/^name:\s*/, '').trim() : null;
}

if (exists('SKILL.md')) score += 6;
else addIssue('Missing SKILL.md');

const skillContent = exists('SKILL.md') ? read('SKILL.md') : '';
const skillName = frontmatterName(skillContent);
const isOptimizerSkill = skillName === 'game-account-skill-optimizer'
  || path.basename(root) === 'game-account-skill-optimizer';
const isSelectorSkill = skillName === 'game-account-select'
  || path.basename(root) === 'game-account-select';

if (isOptimizerSkill) {
  if (exists('references/optimization-workflow.md')) score += 5;
  else addIssue('Missing references/optimization-workflow.md');

  if (exists('references/issue-taxonomy.md')) score += 5;
  else addIssue('Missing references/issue-taxonomy.md');
} else if (isSelectorSkill) {
  if (exists('references/selection-state-machine.md')) score += 10;
  else addIssue('Missing references/selection-state-machine.md');
} else if (exists('references/valuation-rules.md')) score += 5;
else addIssue('Missing references/valuation-rules.md');

if (isOptimizerSkill) {
  if (exists('test-fixtures/wuthering-waves-77175988-run.json')) score += 4;
  else addIssue('Missing optimizer regression fixture');
} else if (isSelectorSkill) {
  const selectorSkill = skillContent;
  const stateMachine = exists('references/selection-state-machine.md') ? read('references/selection-state-machine.md') : '';
  if (containsAny(selectorSkill + stateMachine, ['game-account-toolkit', 'platform-priority.json', 'POST_RUN_OPTIMIZE'])) score += 8;
  else addIssue('Selector skill lacks toolkit/platform/optimizer orchestration guidance');
} else if (exists('references/community-evidence.md')) score += 4;
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
  const skill = skillContent;
  if (containsAny(skill, ['game-account-preflight', '执行前准备', 'preflight'])) score += 5;
  else {
    addIssue('SKILL.md does not require preflight before execution', false);
    suggestedFixes.push('Add an execution-prep section that calls game-account-preflight.');
  }
	  if (isOptimizerSkill && containsAny(skill, ['<skill_optimization_report>', 'skill-io-contract', '标准'])) score += 6;
	  else if (isSelectorSkill && containsAny(skill, ['<recommendations>', 'skill-io-contract', '标准'])) score += 6;
	  else if (!isOptimizerSkill && containsAny(skill, ['<game_account_evaluation>', 'skill-io-contract', '标准'])) score += 6;
	  else {
	    addIssue('SKILL.md does not reference the standard tag I/O contract', false);
	    suggestedFixes.push('Reference game-account-toolkit/references/skill-io-contract.md and emit the expected structured report tag.');
	  }
	  if (isOptimizerSkill && containsAny(skill, ['findings', 'suggested_changes', 'confidence'])) score += 4;
	  else if (isSelectorSkill && containsAny(skill, ['Top N', '数据来源', '人工确认'])) score += 4;
	  else if (!isOptimizerSkill && containsAny(skill, ['community_comparison', 'rule_update_suggestion', 'confidence'])) score += 4;
	  else addIssue('SKILL.md does not require confidence/community comparison/update suggestion fields', false);
	}

if (isOptimizerSkill && exists('references/issue-taxonomy.md')) {
  const taxonomy = read('references/issue-taxonomy.md');
  if (containsAny(taxonomy, ['runtime', 'empty_result', 'platform_coverage'])) score += 8;
  else addIssue('Optimizer taxonomy lacks runtime/platform issue categories');
  if (containsAny(taxonomy, ['output_format', 'valuation', 'user_feedback'])) score += 5;
  else addIssue('Optimizer taxonomy lacks output/valuation/user-feedback categories');
  if (containsAny(taxonomy, ['螃蟹', '盼之', 'pxb7', 'pzds'])) score += 4;
  else addIssue('Optimizer taxonomy lacks Pangxie/Panzhi platform coverage guidance', false);
  if (containsAny(taxonomy, ['autopatch', '自动', '用户确认'])) score += 3;
  else addIssue('Optimizer taxonomy lacks safe patching guidance', false);

  if (exists('references/optimization-workflow.md')) {
    const workflow = read('references/optimization-workflow.md');
    if (containsAny(workflow, ['执行记录', '平台访问尝试', '用户反馈'])) score += 5;
    else addIssue('Optimizer workflow lacks run-artifact analysis guidance', false);
    if (containsAny(workflow, ['不默认写入', '不静默', '输出建议'])) score += 5;
    else addIssue('Optimizer workflow lacks non-silent patching guidance', false);
  }
	} else if (isSelectorSkill && exists('references/selection-state-machine.md')) {
	  const stateMachine = read('references/selection-state-machine.md');
	  if (containsAny(stateMachine, ['COLLECT_LISTINGS', 'SCORE_WITH_GAME_SKILL', 'RANK_AND_EXPLAIN'])) score += 8;
	  else addIssue('Selector state machine lacks core collect/score/rank states');
	  if (containsAny(stateMachine, ['POST_RUN_OPTIMIZE', 'game-account-skill-optimizer'])) score += 5;
	  else addIssue('Selector state machine lacks post-run optimization state');
	  if (containsAny(stateMachine, ['平台尝试', '耗时', '结果数', '失败文本'])) score += 4;
	  else addIssue('Selector state machine does not require platform attempt logging');
	  if (containsAny(stateMachine, ['自然语言', '不要把 <game_account_evaluation>', '原始标签'])) score += 3;
	  else addIssue('Selector state machine lacks user-facing raw-tag suppression guidance');
	} else if (exists('references/valuation-rules.md')) {
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

if (!isOptimizerSkill && !isSelectorSkill && exists('references/community-evidence.md')) {
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

if (!isOptimizerSkill && !isSelectorSkill && exists('references/valuation-rules.md')) {
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
	  ? fs.readdirSync(scriptsDir).find((name) => isOptimizerSkill ? name === 'analyze-run.mjs' : name === 'validate-sample.mjs')
	  : null;
if (isSelectorSkill) {
  score += 22;
} else if (validationScript) {
  score += 5;
  const scriptArgs = isOptimizerSkill
    ? [
      path.join(scriptsDir, validationScript),
      '--input',
      path.join(root, 'test-fixtures/wuthering-waves-77175988-run.json'),
      '--json'
	    ]
	    : [path.join(scriptsDir, validationScript)];
  const run = spawnSync('node', scriptArgs, { encoding: 'utf8' });
  if (run.status === 0) {
    if (isOptimizerSkill) {
      try {
        const report = JSON.parse(run.stdout);
        const findingIds = new Set((report.findings ?? []).map((finding) => finding.id));
        const missingFindingIds = expectedOptimizerFindingIds.filter((id) => !findingIds.has(id));
        const evidence = (report.findings ?? []).flatMap((finding) => finding.evidence ?? []).join('\n');
        const hasDetail503Evidence = /503/.test(evidence) && /fallback|detail|详情|list-card/.test(evidence);

        if (missingFindingIds.length === 0 && hasDetail503Evidence) score += 10;
        else {
          if (missingFindingIds.length) addIssue(`Optimizer fixture missed expected findings: ${missingFindingIds.join(', ')}`);
          if (!hasDetail503Evidence) addIssue('Optimizer fixture did not preserve detail-page 503 fallback evidence');
        }
      } catch (error) {
        addIssue(`Optimizer validation did not emit parseable JSON: ${error.message}`);
      }
    } else {
      score += 10;
    }
  } else {
    addIssue(`Validation script failed: ${(run.stderr || run.stdout).trim()}`);
    suggestedFixes.push(isOptimizerSkill
      ? 'Fix analyze-run.mjs so the optimizer fixture produces findings.'
      : 'Fix validate-sample.mjs so the expected top listing wins.');
  }

  const cleanFixture = path.join(root, 'test-fixtures', 'clean-run.json');
  if (isOptimizerSkill && fs.existsSync(cleanFixture)) {
    const cleanRun = spawnSync('node', [
      path.join(scriptsDir, validationScript),
      '--input',
      cleanFixture,
      '--json'
    ], { encoding: 'utf8' });
    if (cleanRun.status === 0) score += 3;
    else addIssue(`Clean optimizer fixture should exit successfully: ${(cleanRun.stderr || cleanRun.stdout).trim()}`);
  }
} else {
  addIssue(isOptimizerSkill ? 'Missing scripts/analyze-run.mjs' : 'Missing scripts/validate-sample.mjs');
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
