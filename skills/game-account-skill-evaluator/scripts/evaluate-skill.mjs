#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const wantsJson = args.includes('--json');

function readArg(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function positionalArgs() {
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    if (['--threshold', '--from-report'].includes(arg)) index += 1;
  }
  return positionals;
}

const threshold = Number(readArg('--threshold') ?? 80);
const optimizerReportPath = readArg('--from-report');
const repoRoot = process.cwd();

function usage() {
  console.error('Usage: evaluate-skill.mjs <skill-path> [--json] [--threshold=80]');
  console.error('   or: evaluate-skill.mjs --from-report=<optimizer-report.json> [--json] [--threshold=80]');
}

function resolveSkillRoot(input) {
  if (!input) return null;
  const normalized = String(input).replace(/\\/g, '/').replace(/^\.\//, '');
  const skillName = normalized.startsWith('skills/')
    ? normalized.split('/')[1]
    : path.basename(normalized);
  const candidates = [
    path.resolve(repoRoot, normalized),
    path.resolve(repoRoot, 'skills', normalized),
    path.resolve(repoRoot, 'skills', skillName)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? path.resolve(repoRoot, normalized);
}

function resolveSkillFile(root) {
  const skill = path.join(root, 'SKILL.md');
  if (fs.existsSync(skill)) return skill;

  const fixture = path.join(root, 'SKILL.md.fixture');
  if (fs.existsSync(fixture)) return fixture;

  return null;
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function frontmatterName(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const line = match[1].split('\n').find((item) => item.startsWith('name:'));
  return line ? line.replace(/^name:\s*/, '').trim() : null;
}

function listReferenceFiles(root) {
  const referencesPath = path.join(root, 'references');
  if (!fs.existsSync(referencesPath)) return [];
  return fs.readdirSync(referencesPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function classifySkill(root, skillContent) {
  const skillName = frontmatterName(skillContent) ?? path.basename(root);
  if (skillName === 'game-account-select') return 'selector';
  if (skillName === 'game-account-toolkit') return 'toolkit';
  if (skillName === 'game-account-preflight') return 'preflight';
  if (skillName === 'game-account-skill-generator') return 'generator';
  if (skillName === 'game-account-skill-evaluator') return 'evaluator';
  if (skillName === 'game-account-skill-optimizer') return 'optimizer';
  if (skillName === 'game-account-community-updater') return 'community_updater';
  if (fs.existsSync(path.join(root, 'references', 'valuation-rules.md'))) return 'game';
  return 'generic';
}

function issueCollector() {
  const blockingIssues = [];
  const warnings = [];
  const suggestedFixes = [];
  return {
    blockingIssues,
    warnings,
    suggestedFixes,
    issue(message, blocking = true, fix = null) {
      const item = { message, blocking };
      if (blocking) blockingIssues.push(item);
      else warnings.push(item);
      if (fix) suggestedFixes.push(fix);
    }
  };
}

function runNode(scriptArgs) {
  return spawnSync('node', scriptArgs, { encoding: 'utf8' });
}

function looksLikeRunArtifact(report) {
  if (Array.isArray(report.findings) && Array.isArray(report.suggested_changes)) return false;
  return [
    'platform_attempts',
    'community_attempts',
    'recommendations',
    'backup_listings',
    'excluded_listings',
    'final_response',
    'user_feedback',
    'rule_update_suggestions',
    'missing_fields'
  ].some((field) => report[field] != null);
}

function analyzeRunArtifact(reportPath, issue) {
  const analyzer = path.resolve(repoRoot, 'skills/game-account-skill-optimizer/scripts/analyze-run.mjs');
  if (!fs.existsSync(analyzer)) {
    issue('Cannot evaluate raw run artifact because optimizer analyzer is missing');
    return null;
  }

  const run = runNode([analyzer, '--input', reportPath, '--json']);
  if (run.status !== 0) {
    issue(`Optimizer analyzer failed for run artifact: ${(run.stderr || run.stdout).trim()}`);
    return null;
  }

  try {
    return JSON.parse(run.stdout);
  } catch (error) {
    issue(`Optimizer analyzer did not emit parseable JSON: ${error.message}`);
    return null;
  }
}

function evaluateOptimizerFixtures(root, addScore, issue) {
  const analyzer = path.join(root, 'scripts', 'analyze-run.mjs');
  const fixtureDir = path.join(root, 'test-fixtures');
  const wutheringFixture = path.join(fixtureDir, 'wuthering-waves-77175988-run.json');
  const cleanFixture = path.join(fixtureDir, 'clean-run.json');
  const repoWideFixture = path.join(fixtureDir, 'zenless-zone-zero-run.json');
  const zzzEmailRefreshFixture = path.join(fixtureDir, 'zenless-zone-zero-email-refresh-run.json');
  const zzzCommunityPerformanceFixture = path.join(fixtureDir, 'zenless-zone-zero-community-performance-run.json');
  const zzzOpencliAdapterFixture = path.join(fixtureDir, 'zenless-zone-zero-opencli-adapter-run.json');
  const zzzSplitAdapterFixture = path.join(fixtureDir, 'zenless-zone-zero-split-adapter-capability-run.json');
  const redoFixture = path.join(fixtureDir, 'quality-gate-redo-run.json');

  const expectedWutheringFindings = [
    'runtime-slow-platform-path',
    'empty-result-fallback-needed',
    'platform-coverage-mainstream-sources',
    'output-format-raw-tags',
    'valuation-team-archetypes',
    'risk-manual-confirmation-needed'
  ];

  const runFixture = (fixturePath) => {
    const run = runNode([analyzer, '--input', fixturePath, '--json']);
    if (run.status !== 0) {
      issue(`Optimizer fixture failed: ${(run.stderr || run.stdout).trim()}`);
      return null;
    }
    try {
      return JSON.parse(run.stdout);
    } catch (error) {
      issue(`Optimizer validation did not emit parseable JSON: ${error.message}`);
      return null;
    }
  };

  const wutheringReport = fs.existsSync(wutheringFixture) ? runFixture(wutheringFixture) : null;
  if (wutheringReport) {
    const findingIds = new Set((wutheringReport.findings ?? []).map((finding) => finding.id));
    const missingFindingIds = expectedWutheringFindings.filter((id) => !findingIds.has(id));
    const evidence = (wutheringReport.findings ?? []).flatMap((finding) => finding.evidence ?? []).join('\n');
    const hasDetail503Evidence = /503/.test(evidence) && /fallback|detail|详情|list-card/.test(evidence);
    if (missingFindingIds.length === 0 && hasDetail503Evidence) addScore(10);
    else {
      if (missingFindingIds.length) issue(`Optimizer fixture missed expected findings: ${missingFindingIds.join(', ')}`);
      if (!hasDetail503Evidence) issue('Optimizer fixture did not preserve detail-page 503 fallback evidence');
    }
  }

  if (fs.existsSync(cleanFixture)) {
    const cleanReport = runFixture(cleanFixture);
    if (cleanReport && (cleanReport.findings ?? []).length === 0) addScore(4);
    else issue('Clean optimizer fixture should produce no findings');
  } else {
    issue('Missing clean optimizer fixture');
  }

  if (fs.existsSync(repoWideFixture)) {
    const repoWideReport = runFixture(repoWideFixture);
    const valuationFinding = repoWideReport?.findings?.find((finding) => finding.id === 'valuation-team-archetypes');
    const targets = valuationFinding?.suggested_targets ?? [];
    if (targets.some((target) => target.startsWith('skills/game-account-zenless-zone-zero/'))) addScore(5);
    else issue('Repo-wide optimizer fixture did not target the affected non-Wuthering skill');
  } else {
    issue('Missing repo-wide optimizer fixture');
  }

  if (fs.existsSync(zzzEmailRefreshFixture)) {
    const zzzRiskEvidenceReport = runFixture(zzzEmailRefreshFixture);
    const findingIds = new Set((zzzRiskEvidenceReport?.findings ?? []).map((finding) => finding.id));
    const requiredFindingIds = [
      'risk-email-unverified-positive-signal',
      'evidence-refresh-window-too-long'
    ];
    const missingFindingIds = requiredFindingIds.filter((id) => !findingIds.has(id));
    if (missingFindingIds.length === 0) addScore(4);
    else issue(`Optimizer missed ZZZ email/evidence findings: ${missingFindingIds.join(', ')}`);
  } else {
    issue('Missing ZZZ email/evidence optimizer fixture');
  }

  if (fs.existsSync(zzzCommunityPerformanceFixture)) {
    const zzzCommunityPerformanceReport = runFixture(zzzCommunityPerformanceFixture);
    const findingIds = new Set((zzzCommunityPerformanceReport?.findings ?? []).map((finding) => finding.id));
    const requiredFindingIds = [
      'runtime-slow-platform-path',
      'runtime-missing-wait-budget',
      'platform-opencli-adapter-gap',
      'evidence-refresh-window-too-long',
      'evidence-community-tool-fallback-missing',
      'output-listing-links-missing',
      'output-flex-budget-backups-missing',
      'valuation-independent-team-completeness',
      'output-hard-condition-budget-expansion'
    ];
    const missingFindingIds = requiredFindingIds.filter((id) => !findingIds.has(id));
    const evidence = (zzzCommunityPerformanceReport?.findings ?? []).flatMap((finding) => finding.evidence ?? []).join('\n');
    const preservesCommunityEvidence = /bilibili|xiaohongshu|subtitle|小红书|B站/i.test(evidence);
    const preservesLinkEvidence = /recommendations:QL9CHD|excluded_listings:JHYXJ3302/.test(evidence);
    const preservesAdapterGapEvidence = /pxb7|pzds|no opencli adapter|browser_cdp/i.test(evidence);
    if (missingFindingIds.length === 0 && preservesCommunityEvidence && preservesLinkEvidence && preservesAdapterGapEvidence) addScore(6);
    else {
      if (missingFindingIds.length) issue(`Optimizer missed ZZZ community/performance findings: ${missingFindingIds.join(', ')}`);
      if (!preservesCommunityEvidence) issue('Optimizer did not preserve community-source failure evidence');
      if (!preservesLinkEvidence) issue('Optimizer did not preserve missing listing-link evidence');
      if (!preservesAdapterGapEvidence) issue('Optimizer did not preserve OpenCLI adapter-gap evidence');
    }
  } else {
    issue('Missing ZZZ community/performance optimizer fixture');
  }

  if (fs.existsSync(zzzOpencliAdapterFixture)) {
    const zzzOpencliAdapterReport = runFixture(zzzOpencliAdapterFixture);
    const findingIds = new Set((zzzOpencliAdapterReport?.findings ?? []).map((finding) => finding.id));
    const evidence = (zzzOpencliAdapterReport?.findings ?? []).flatMap((finding) => finding.evidence ?? []).join('\n');
    const hasReuseFinding = findingIds.has('platform-opencli-adapter-reuse');
    const avoidsGapFinding = !findingIds.has('platform-opencli-adapter-gap');
    const preservesVerifyEvidence = /pxb7\/detail|pzds\/detail|--strict-memory/i.test(evidence);
    if (hasReuseFinding && avoidsGapFinding && preservesVerifyEvidence) addScore(4);
    else {
      if (!hasReuseFinding) issue('Optimizer did not recognize verified OpenCLI adapters as reusable');
      if (!avoidsGapFinding) issue('Optimizer still reported an adapter gap for verified OpenCLI adapters');
      if (!preservesVerifyEvidence) issue('Optimizer did not preserve verified adapter command evidence');
    }
  } else {
    issue('Missing ZZZ OpenCLI adapter optimizer fixture');
  }

  if (fs.existsSync(zzzSplitAdapterFixture)) {
    const zzzSplitAdapterReport = runFixture(zzzSplitAdapterFixture);
    const findings = zzzSplitAdapterReport?.findings ?? [];
    const findingIds = new Set(findings.map((finding) => finding.id));
    const evidence = findings.flatMap((finding) => finding.evidence ?? []).join('\n');
    const hasGapFinding = findingIds.has('platform-opencli-adapter-gap');
    const hasReuseFinding = findingIds.has('platform-opencli-adapter-reuse');
    const gapIsListSpecific = /list_adapter_available=false|browser_cdp_for_list/i.test(evidence);
    const reusePreservesDetailCommands = /pxb7 detail|pzds detail|pxb7\/detail|pzds\/detail/i.test(evidence);
    if (hasGapFinding && hasReuseFinding && gapIsListSpecific && reusePreservesDetailCommands) addScore(4);
    else {
      if (!hasGapFinding) issue('Optimizer did not report missing list adapter capability');
      if (!hasReuseFinding) issue('Optimizer did not preserve verified detail adapter reuse');
      if (!gapIsListSpecific) issue('Optimizer did not distinguish list adapter gaps from detail adapter reuse');
      if (!reusePreservesDetailCommands) issue('Optimizer did not preserve verified detail adapter commands');
    }
  } else {
    issue('Missing ZZZ split adapter capability optimizer fixture');
  }

  if (fs.existsSync(redoFixture)) {
    const redoReport = runFixture(redoFixture);
    const hasRedoFinding = redoReport?.findings?.some((finding) => finding.id === 'quality-gate-redo-required');
    if (hasRedoFinding) addScore(5);
    else issue('Optimizer did not turn failed evaluator output into a redo finding');
  } else {
    issue('Missing quality-gate redo optimizer fixture');
  }
}

function evaluateSkill(skillInput, thresholdValue = threshold) {
  const root = resolveSkillRoot(skillInput);
  const skillFile = resolveSkillFile(root);
  const exists = (relative) => {
    if (relative === 'SKILL.md') return Boolean(skillFile);
    return fs.existsSync(path.join(root, relative));
  };
  const read = (relative) => {
    if (relative === 'SKILL.md') return fs.readFileSync(skillFile, 'utf8');
    return fs.readFileSync(path.join(root, relative), 'utf8');
  };
  const { blockingIssues, warnings, suggestedFixes, issue } = issueCollector();
  const addIssue = issue;
  let score = 0;
  const addScore = (points) => {
    score += points;
  };

  if (exists('SKILL.md')) addScore(6);
  else addIssue('Missing SKILL.md');

  const skillContent = exists('SKILL.md') ? read('SKILL.md') : '';
  const skillType = classifySkill(root, skillContent);
  const referenceFiles = listReferenceFiles(root);
  const knowledgeFile = referenceFiles.find((name) => name.endsWith('-knowledge.md') || name === 'asset-knowledge.md');
  const hasPreflight = containsAny(skillContent, ['game-account-preflight', '执行前准备', 'preflight']);
  const hasStandardContract = containsAny(skillContent, ['skill-io-contract', '标准', '<game_account_evaluation>', '<recommendations>', '<skill_quality_report>', '<skill_optimization_report>', '<community_refresh_report>']);

  if (hasPreflight || skillType === 'toolkit') addScore(5);
  else addIssue('SKILL.md does not require preflight before execution', false, 'Add an execution-prep section that calls game-account-preflight.');

  if (hasStandardContract) addScore(6);
  else addIssue('SKILL.md does not reference the standard tag I/O contract', false, 'Reference game-account-toolkit/references/skill-io-contract.md and emit the expected structured report tag.');

  if (exists('references/changelog.md')) addScore(3);
  else if (['game', 'optimizer'].includes(skillType)) addIssue('Missing references/changelog.md', false);

  switch (skillType) {
    case 'game': {
      if (exists('references/valuation-rules.md')) addScore(8);
      else addIssue('Missing references/valuation-rules.md');

      if (exists('references/community-evidence.md')) addScore(6);
      else addIssue('Missing references/community-evidence.md');

      if (knowledgeFile) addScore(3);
      else addIssue('Missing domain knowledge reference file', false);

      const rules = exists('references/valuation-rules.md') ? read('references/valuation-rules.md') : '';
      if (containsAny(rules, ['score_weights', '评分框架', '可执行评分'])) addScore(8);
      else addIssue('Valuation rules lack executable score weights');
      if (containsAny(rules, ['排序硬规则', '不得排在', '不能进入 Top 1'])) addScore(5);
      else addIssue('Valuation rules lack hard ranking rules against count-only listings');
      if (containsAny(rules, ['risk_penalty', '风险扣分', '绑定', '找回'])) addScore(5);
      else addIssue('Valuation rules lack risk penalty logic');
      if (containsAny(rules, ['missing_data_penalty', '缺失', 'missing'])) addScore(4);
      else addIssue('Valuation rules lack missing-data penalty logic');
      if (containsAny(rules, ['配队', '队伍', '专武', '专属音擎', '弧盘', '模组', '专精', '限定', '联动'])) addScore(5);
      else addIssue('Valuation rules do not cover team/equipment/progression context', false);
      if (containsAny(rules, ['总数', '数量', 'count', '泛称', '高稀有度'])) addScore(5);
      else addIssue('Rules do not explicitly handle count-only or vague high-rarity traps');
      if (containsAny(rules, ['实名', '绑定', 'PSN', 'TAP', 'HoYoverse', 'Wegame', '官方验号'])) addScore(5);
      else addIssue('Rules do not cover account binding/verification risk');
      if (containsAny(rules, ['人工确认', '缺失字段', 'missing_fields'])) addScore(4);
      else addIssue('Rules do not require manual confirmation for missing fields', false);

      const evidence = exists('references/community-evidence.md') ? read('references/community-evidence.md') : '';
      if (containsAny(evidence, ['updated_at:', 'updated_at'])) addScore(3);
      else addIssue('Community evidence lacks updated_at');
      if (containsAny(evidence, ['source_coverage', 'community_confidence'])) addScore(5);
      else addIssue('Community evidence lacks source coverage/confidence metadata');
      if (containsAny(evidence, ['http://', 'https://', 'not_checked', 'failed', 'limited'])) addScore(4);
      else addIssue('Community evidence lacks source links or explicit coverage limitations', false);
      if (containsAny(evidence, ['局限', 'limitations', '覆盖'])) addScore(3);
      else addIssue('Community evidence lacks limitations section', false);

      const validationScript = path.join(root, 'scripts', 'validate-sample.mjs');
      if (fs.existsSync(validationScript)) {
        addScore(5);
        const run = runNode([validationScript]);
        if (run.status === 0) addScore(10);
        else addIssue(`Validation script failed: ${(run.stderr || run.stdout).trim()}`, true, 'Fix validate-sample.mjs so the expected top listing wins.');
      } else {
        addIssue('Missing scripts/validate-sample.mjs');
      }
      break;
    }

    case 'selector': {
      if (exists('references/selection-state-machine.md')) addScore(14);
      else addIssue('Missing references/selection-state-machine.md');
      const stateMachine = exists('references/selection-state-machine.md') ? read('references/selection-state-machine.md') : '';
      const selectorText = `${skillContent}\n${stateMachine}`;
      if (containsAny(selectorText, ['COLLECT_LISTINGS', 'SCORE_WITH_GAME_SKILL', 'RANK_AND_EXPLAIN'])) addScore(12);
      else addIssue('Selector state machine lacks core collect/score/rank states');
      if (containsAny(selectorText, ['POST_RUN_OPTIMIZE', 'game-account-skill-optimizer'])) addScore(9);
      else addIssue('Selector state machine lacks post-run optimization state');
      if (containsAny(selectorText, ['run artifact', 'raw run artifact', 'run-artifact', '运行摘要', 'final_response_draft'])) addScore(5);
      else addIssue('Selector post-run stage does not require a raw run artifact');
      if (containsAny(selectorText, ['--from-report=<run-artifact', '--from-report=<run artifact', '--from-report', 'run_artifact_analysis'])) addScore(5);
      else addIssue('Selector post-run stage does not require evaluator analysis of raw run artifacts');
      if (containsAny(selectorText, ['redo_required', '打回重做', '补查', '降级'])) addScore(5);
      else addIssue('Selector post-run stage lacks redo/degrade handling for optimizer findings');
      if (containsAny(selectorText, ['platform-priority.json', 'pxb7', 'pzds', '螃蟹', '盼之'])) addScore(10);
      else addIssue('Selector lacks mainstream platform priority guidance');
      if (containsAny(selectorText, ['平台尝试', '耗时', '结果数', '失败文本'])) addScore(6);
      else addIssue('Selector state machine does not require platform attempt logging');
      if (containsAny(selectorText, ['自然语言', '不要把 <game_account_evaluation>', '原始标签'])) addScore(6);
      else addIssue('Selector state machine lacks user-facing raw-tag suppression guidance');
      addScore(18);
      break;
    }

    case 'optimizer': {
      if (exists('references/optimization-workflow.md')) addScore(8);
      else addIssue('Missing references/optimization-workflow.md');
      if (exists('references/issue-taxonomy.md')) addScore(8);
      else addIssue('Missing references/issue-taxonomy.md');
      if (exists('references/optimization-knowledge.md')) addScore(4);
      else addIssue('Missing references/optimization-knowledge.md');
      if (exists('scripts/analyze-run.mjs')) addScore(7);
      else addIssue('Missing scripts/analyze-run.mjs');
      if (exists('test-fixtures/wuthering-waves-77175988-run.json')) addScore(4);
      else addIssue('Missing optimizer regression fixture');

      const taxonomy = exists('references/issue-taxonomy.md') ? read('references/issue-taxonomy.md') : '';
      if (containsAny(taxonomy, ['runtime', 'empty_result', 'platform_coverage'])) addScore(8);
      else addIssue('Optimizer taxonomy lacks runtime/platform issue categories');
      if (containsAny(taxonomy, ['output_format', 'valuation', 'user_feedback'])) addScore(5);
      else addIssue('Optimizer taxonomy lacks output/valuation/user-feedback categories');
      if (containsAny(taxonomy, ['quality_gate', 'redo_required', '打回'])) addScore(5);
      else addIssue('Optimizer taxonomy lacks quality-gate redo category');
      if (containsAny(taxonomy, ['troubleshooting', 'Troubleshooting', '诊断'])) addScore(5);
      else addIssue('Optimizer taxonomy lacks troubleshooting guidance');
      if (containsAny(taxonomy, ['螃蟹', '盼之', 'pxb7', 'pzds'])) addScore(4);
      else addIssue('Optimizer taxonomy lacks Pangxie/Panzhi platform coverage guidance', false);
      if (containsAny(taxonomy, ['autopatch', '自动', '用户确认'])) addScore(3);
      else addIssue('Optimizer taxonomy lacks safe patching guidance', false);

      const workflow = exists('references/optimization-workflow.md') ? read('references/optimization-workflow.md') : '';
      if (containsAny(workflow, ['执行记录', '平台访问尝试', '用户反馈'])) addScore(5);
      else addIssue('Optimizer workflow lacks run-artifact analysis guidance', false);
      if (containsAny(workflow, ['不默认写入', '不静默', '输出建议'])) addScore(5);
      else addIssue('Optimizer workflow lacks non-silent patching guidance', false);
      if (containsAny(workflow, ['Troubleshooting', '故障诊断', '诊断'])) addScore(5);
      else addIssue('Optimizer workflow lacks built-in troubleshooting loop');
      if (containsAny(workflow, ['game-account-skill-evaluator', 'redo_required', '打回'])) addScore(5);
      else addIssue('Optimizer workflow lacks evaluator quality gate loop');

      if (exists('scripts/analyze-run.mjs')) {
        addScore(5);
        evaluateOptimizerFixtures(root, addScore, addIssue);
      }
      break;
    }

    case 'evaluator': {
      if (exists('references/evaluation-rubric.md')) addScore(12);
      else addIssue('Missing references/evaluation-rubric.md');
      if (exists('scripts/evaluate-skill.mjs')) addScore(10);
      else addIssue('Missing scripts/evaluate-skill.mjs');
      const evaluatorText = `${skillContent}\n${exists('references/evaluation-rubric.md') ? read('references/evaluation-rubric.md') : ''}\n${exists('scripts/evaluate-skill.mjs') ? read('scripts/evaluate-skill.mjs') : ''}`;
      if (containsAny(evaluatorText, ['selector', 'toolkit', 'preflight', 'optimizer', 'community_updater'])) addScore(16);
      else addIssue('Evaluator does not cover non-game repository skills');
      if (containsAny(evaluatorText, ['redo_required', '打回', 'quality gate'])) addScore(14);
      else addIssue('Evaluator does not emit redo_required quality gate semantics');
      if (containsAny(evaluatorText, ['--from-report', 'optimizer_report'])) addScore(12);
      else addIssue('Evaluator cannot evaluate optimizer-produced reports');
      const fixturePath = path.join(root, 'test-fixtures', 'incomplete-skill');
      if (fs.existsSync(fixturePath) && exists('scripts/evaluate-skill.mjs')) {
        const run = runNode([path.join(root, 'scripts', 'evaluate-skill.mjs'), fixturePath, '--json']);
        if (run.status !== 0) addScore(10);
        else addIssue('Evaluator incomplete fixture should fail the quality gate');
      }
      const rawArtifactFixture = path.resolve(repoRoot, 'skills/game-account-skill-optimizer/test-fixtures/zenless-zone-zero-community-performance-run.json');
      if (fs.existsSync(rawArtifactFixture) && exists('scripts/evaluate-skill.mjs')) {
        const run = runNode([path.join(root, 'scripts', 'evaluate-skill.mjs'), `--from-report=${rawArtifactFixture}`, '--json']);
        let report = null;
        try {
          report = JSON.parse(run.stdout);
        } catch {
          // The issue below will include the raw stdout/stderr context.
        }
        const findingIds = new Set((report?.optimizer_findings ?? []).map((finding) => finding.id));
        const expectedFindingIds = [
          'evidence-community-answer-required',
          'evidence-community-tool-fallback-missing',
          'output-listing-links-missing',
          'output-flex-budget-backups-missing',
          'valuation-independent-team-completeness',
          'output-hard-condition-budget-expansion'
        ];
        const hasExpectedFindings = expectedFindingIds.every((id) => findingIds.has(id));
        if (run.status !== 0 && report?.mode === 'run_artifact_analysis' && report?.redo_required === true && hasExpectedFindings) addScore(8);
        else addIssue(`Evaluator should fail raw run artifacts with optimizer findings: ${(run.stderr || run.stdout).trim()}`);
      }
      addScore(12);
      break;
    }

    case 'generator': {
      if (exists('references/generation-workflow.md')) addScore(14);
      else addIssue('Missing references/generation-workflow.md');
      if (exists('scripts/generate-game-skill.mjs')) addScore(12);
      else addIssue('Missing scripts/generate-game-skill.mjs');
      const generatorText = `${skillContent}\n${exists('references/generation-workflow.md') ? read('references/generation-workflow.md') : ''}`;
      if (containsAny(generatorText, ['game-account-skill-evaluator', '质量评估', '质量门禁'])) addScore(14);
      else addIssue('Generator does not require evaluator quality gate');
      if (containsAny(generatorText, ['community-evidence.md', 'valuation-rules.md', 'validate-sample.mjs'])) addScore(14);
      else addIssue('Generator workflow lacks required generated skill files');
      addScore(20);
      break;
    }

    case 'community_updater': {
      if (exists('references/update-workflow.md')) addScore(14);
      else addIssue('Missing references/update-workflow.md');
      if (exists('scripts/update-community-evidence.mjs')) addScore(12);
      else addIssue('Missing scripts/update-community-evidence.mjs');
      const updaterText = `${skillContent}\n${exists('references/update-workflow.md') ? read('references/update-workflow.md') : ''}`;
      if (containsAny(updaterText, ['community_confidence', 'source_coverage', 'limitations', '局限'])) addScore(16);
      else addIssue('Community updater lacks coverage/confidence/limitations requirements');
      if (containsAny(updaterText, ['不直接改评分', '不静默改写', '规则更新'])) addScore(14);
      else addIssue('Community updater should not silently rewrite valuation rules');
      addScore(20);
      break;
    }

    case 'preflight': {
      if (exists('references/preflight-checklist.md')) addScore(16);
      else addIssue('Missing references/preflight-checklist.md');
      if (exists('scripts/preflight.mjs')) addScore(12);
      else addIssue('Missing scripts/preflight.mjs');
      const preflightText = `${skillContent}\n${exists('references/preflight-checklist.md') ? read('references/preflight-checklist.md') : ''}`;
      if (containsAny(preflightText, ['missing_required', 'missing_optional', 'safe_auto_actions', 'manual_actions'])) addScore(16);
      else addIssue('Preflight lacks required output state fields');
      if (containsAny(preflightText, ['不静默安装', '不绕过', '验证码', '登录墙'])) addScore(14);
      else addIssue('Preflight lacks safety boundary guidance');
      addScore(20);
      break;
    }

    case 'toolkit': {
      const requiredReferences = [
        'community-research-protocol.md',
        'dependency-state-machine.md',
        'game-skill-standard.md',
        'platform-access-policy.md',
        'skill-io-contract.md',
        'shared-listing-schema.md',
        'platform-priority.json'
      ];
      const missingReferences = requiredReferences.filter((name) => !exists(`references/${name}`));
      if (missingReferences.length === 0) addScore(28);
      else addIssue(`Toolkit missing references: ${missingReferences.join(', ')}`);
      if (exists('scripts/check-deps.mjs')) addScore(10);
      else addIssue('Missing scripts/check-deps.mjs');
      const toolkitText = `${skillContent}\n${requiredReferences.map((name) => readFileIfExists(path.join(root, 'references', name))).join('\n')}`;
      if (containsAny(toolkitText, ['pxb7', 'pzds', '螃蟹', '盼之'])) addScore(12);
      else addIssue('Toolkit lacks mainstream platform priority coverage');
      if (containsAny(toolkitText, ['不绕过验证码', '不做全站高频抓取', '不自动下单'])) addScore(12);
      else addIssue('Toolkit lacks platform safety boundary guidance');
      if (containsAny(toolkitText, ['skill-io-contract', 'shared-listing-schema', 'platform_attempts'])) addScore(12);
      else addIssue('Toolkit lacks shared contract/schema guidance');
      addScore(12);
      break;
    }

    default: {
      if (referenceFiles.length) addScore(20);
      else addIssue('Generic skill lacks references directory', false);
      addScore(30);
      break;
    }
  }

  score = Math.min(score, 100);
  const passed = score >= thresholdValue && blockingIssues.length === 0;
  const redoRequired = !passed;
  const redoReasons = redoRequired
    ? [
      ...(score < thresholdValue ? [`Score ${score} is below threshold ${thresholdValue}`] : []),
      ...blockingIssues.map((item) => item.message)
    ]
    : [];

  return {
    skill_path: path.relative(repoRoot, root).split(path.sep).join('/') || skillInput,
    skill_type: skillType,
    score,
    threshold: thresholdValue,
    passed,
    redo_required: redoRequired,
    redo_reasons: redoReasons,
    blocking_issues: blockingIssues,
    warnings,
    suggested_fixes: [...new Set(suggestedFixes)]
  };
}

function skillIdsFromOptimizerReport(report) {
  const ids = new Set();
  const add = (value) => {
    if (!value) return;
    const text = String(value).replace(/\\/g, '/');
    const match = text.match(/(?:^|\/)(skills\/[^/\s]+)/);
    if (match) {
      ids.add(match[1]);
      return;
    }
    if (text.startsWith('game-account-')) ids.add(`skills/${text}`);
  };

  add(report.target_skill);
  for (const finding of report.findings ?? []) {
    for (const target of finding.suggested_targets ?? []) add(target);
  }
  for (const change of report.suggested_changes ?? []) {
    for (const target of change.targets ?? []) add(target);
  }
  return [...ids];
}

function evaluateOptimizerReport(reportPath, thresholdValue) {
  const absoluteReportPath = path.resolve(repoRoot, reportPath);
  const source = JSON.parse(fs.readFileSync(absoluteReportPath, 'utf8'));
  const { blockingIssues, warnings, suggestedFixes, issue } = issueCollector();
  const rawRunArtifact = looksLikeRunArtifact(source);
  const report = rawRunArtifact ? analyzeRunArtifact(absoluteReportPath, issue) : source;
  if (!report) {
    return {
      mode: rawRunArtifact ? 'run_artifact_analysis' : 'optimizer_report',
      report_path: path.relative(repoRoot, absoluteReportPath).split(path.sep).join('/'),
      evaluated_skills: [],
      passed: false,
      redo_required: true,
      blocking_issues: blockingIssues,
      warnings,
      suggested_fixes: suggestedFixes
    };
  }

  const skillIds = skillIdsFromOptimizerReport(report);
  const evaluatedSkills = skillIds.map((skillId) => evaluateSkill(skillId, thresholdValue));
  const failedSkillIssues = evaluatedSkills
    .filter((result) => result.redo_required)
    .map((result) => ({
      message: `${result.skill_path} requires redo: ${result.redo_reasons.join('; ')}`,
      blocking: true
    }));
  blockingIssues.push(...failedSkillIssues);

  const actionableFindings = rawRunArtifact
    ? (report.findings ?? []).filter((finding) => String(finding.severity ?? '').toLowerCase() !== 'info')
    : [];
  blockingIssues.push(...actionableFindings.map((finding) => ({
    message: `Run artifact still has ${finding.id}: ${finding.summary}`,
    blocking: true
  })));

  if (rawRunArtifact && actionableFindings.length) {
    suggestedFixes.push('Apply or intentionally defer the optimizer findings, then evaluate the resulting optimizer report or target skills again.');
  }

  const passed = evaluatedSkills.length > 0 && blockingIssues.length === 0;

  return {
    mode: rawRunArtifact ? 'run_artifact_analysis' : 'optimizer_report',
    report_path: path.relative(repoRoot, absoluteReportPath).split(path.sep).join('/'),
    evaluated_skills: evaluatedSkills,
    optimizer_findings: rawRunArtifact ? report.findings ?? [] : undefined,
    optimizer_safe_to_autopatch: rawRunArtifact ? report.safe_to_autopatch : undefined,
    passed,
    redo_required: !passed,
    blocking_issues: blockingIssues,
    warnings: evaluatedSkills.length ? warnings : [...warnings, { message: 'Optimizer report did not reference any skill targets', blocking: false }],
    suggested_fixes: blockingIssues.length ? unique([
      ...suggestedFixes,
      'Redo the failed target skill before using the optimizer output.'
    ]) : unique(suggestedFixes)
  };
}

function emitResult(result) {
  if (wantsJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('<skill_quality_report>');
  if (result.mode) console.log(`  <mode>${result.mode}</mode>`);
  if (result.report_path) console.log(`  <report_path>${result.report_path}</report_path>`);
  if (result.skill_path) console.log(`  <skill_path>${result.skill_path}</skill_path>`);
  if (result.skill_type) console.log(`  <skill_type>${result.skill_type}</skill_type>`);
  if (typeof result.score === 'number') console.log(`  <score>${result.score}</score>`);
  console.log(`  <passed>${result.passed}</passed>`);
  console.log(`  <redo_required>${result.redo_required}</redo_required>`);
  if (result.redo_reasons) console.log(`  <redo_reasons format="json">${JSON.stringify(result.redo_reasons)}</redo_reasons>`);
  if (result.evaluated_skills) console.log(`  <evaluated_skills format="json">${JSON.stringify(result.evaluated_skills)}</evaluated_skills>`);
  if (result.optimizer_findings) console.log(`  <optimizer_findings format="json">${JSON.stringify(result.optimizer_findings)}</optimizer_findings>`);
  if (typeof result.optimizer_safe_to_autopatch === 'boolean') console.log(`  <optimizer_safe_to_autopatch>${result.optimizer_safe_to_autopatch}</optimizer_safe_to_autopatch>`);
  console.log(`  <blocking_issues format="json">${JSON.stringify(result.blocking_issues)}</blocking_issues>`);
  console.log(`  <warnings format="json">${JSON.stringify(result.warnings)}</warnings>`);
  console.log(`  <suggested_fixes format="json">${JSON.stringify(result.suggested_fixes)}</suggested_fixes>`);
  console.log('</skill_quality_report>');
}

let result;
if (optimizerReportPath) {
  result = evaluateOptimizerReport(optimizerReportPath, threshold);
} else {
  const skillPath = positionalArgs()[0];
  if (!skillPath) {
    usage();
    process.exit(2);
  }
  result = evaluateSkill(skillPath, threshold);
}

emitResult(result);
process.exit(result.passed ? 0 : 1);
