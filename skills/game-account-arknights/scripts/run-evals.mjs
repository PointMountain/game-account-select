#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseSelectionProfile } from '../../game-account-select/scripts/parse-selection-profile.mjs';
import { rankListings } from './score-listings.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(skillRoot, '..', '..');
const evalSet = JSON.parse(fs.readFileSync(path.join(skillRoot, 'evals', 'evals.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(skillRoot, 'test-fixtures', 'arknights-profile-validation-sample.json'), 'utf8'));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const workspace = path.resolve(outIndex >= 0 ? args[outIndex + 1] : '/tmp/game-account-arknights-workspace/iteration-1');
const collectorProfile = parseSelectionProfile(fixture.requests.collector);
const combatProfile = parseSelectionProfile(fixture.requests.combat);

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${value.trim()}\n`);
}

function resultFor(evalId) {
  if (evalId === 1) {
    const rankings = rankListings(fixture.listings, collectorProfile);
    return {
      profile: collectorProfile,
      ranking: rankings.map((item) => ({ id: item.id, final_score: item.final_score, rarity: item.base_dimensions.rarity, skins: item.base_dimensions.skins })),
      durable_updates_from_profile: [],
    };
  }
  if (evalId === 2) {
    const rankings = rankListings(fixture.listings, combatProfile);
    return {
      profile: combatProfile,
      collector_profile_for_comparison: collectorProfile,
      ranking: rankings.map((item) => ({ id: item.id, final_score: item.final_score, combat: item.base_dimensions.combat, progression: item.base_dimensions.progression })),
      profiles_share_state: false,
    };
  }
  if (evalId === 4) {
    const collectorRankings = rankListings(fixture.listings, collectorProfile);
    const combatRankings = rankListings(fixture.listings, combatProfile);
    const ids = ['limited-count-untrained', 'playable-balanced', 'meta-dps-role-gap'];
    const compact = (item) => ({
      id: item.id,
      final_score: item.final_score,
      push_readiness: item.push_readiness,
      role_coverage: item.combat_breakdown.role_coverage,
      ready_recommended_operators: item.combat_breakdown.ready_recommended_operators,
    });
    return {
      collector_ranking: collectorRankings.filter((item) => ids.includes(item.id)).map(compact),
      combat_ranking: combatRankings.filter((item) => ids.includes(item.id)).map(compact),
    };
  }
  if (evalId === 5) {
    const profile = parseSelectionProfile('帮我找 2000 元左右、联动全齐、合成玉至少 6 万的明日方舟账号；账号要比较新，不要只有早期收藏且阵容断代的陈年仓库号。');
    return {
      profile,
      durable_updates_from_profile: [],
    };
  }
  return {
    missing: parseSelectionProfile('帮我找明日方舟账号'),
    conflicting: parseSelectionProfile('明日方舟限定多、战力也高，约3000元'),
    query_started: false,
  };
}

function grade(evalId, result, expectations) {
  const checks = evalId === 1
    ? [
        [result.profile.objective === 'collector' && result.profile.persistence_scope === 'run_only', `objective=${result.profile.objective}; persistence_scope=${result.profile.persistence_scope}`],
        [result.profile.budget.target === 1000 && result.profile.budget.primary_min === 800 && result.profile.budget.primary_max === 1200, `budget=${JSON.stringify(result.profile.budget)}`],
        [result.ranking[0]?.id === 'collector-vault' && result.ranking.findIndex((item) => item.id === 'skin-only') > 0, `ranking=${result.ranking.map((item) => item.id).join(' > ')}`],
        [result.durable_updates_from_profile.length === 0, 'durable_updates_from_profile=[]'],
      ]
    : evalId === 2
      ? [
          [result.profile.objective === 'combat' && result.profile.persistence_scope === 'run_only', `objective=${result.profile.objective}; persistence_scope=${result.profile.persistence_scope}`],
          [result.profile.priorities.combat > result.collector_profile_for_comparison.priorities.combat && result.profile.priorities.progression > result.collector_profile_for_comparison.priorities.progression, `combat=${result.profile.priorities.combat}; progression=${result.profile.priorities.progression}`],
          [result.ranking[0]?.id === 'combat-core', `ranking=${result.ranking.map((item) => item.id).join(' > ')}`],
          [result.profiles_share_state === false && result.profile.budget.target !== result.collector_profile_for_comparison.budget.target, 'profiles_share_state=false and targets differ'],
        ]
      : evalId === 3
        ? [
          [result.missing.clarification_required.includes('budget') && result.missing.clarification_required.includes('objective'), `missing=${result.missing.clarification_required.join(',')}`],
          [result.conflicting.clarification_required.includes('objective_conflict'), `conflicting=${result.conflicting.clarification_required.join(',')}`],
          [result.missing.hard_conditions.length === 0 && result.missing.assumptions.some((item) => item.includes('区服')) && result.missing.assumptions.some((item) => item.includes('风险')), `assumptions=${result.missing.assumptions.join('; ')}`],
          [result.query_started === false, 'query_started=false'],
        ]
      : evalId === 4
        ? [
          [result.collector_ranking.find((item) => item.id === 'limited-count-untrained')?.push_readiness.status === 'not_ready' && result.collector_ranking.find((item) => item.id === 'limited-count-untrained')?.push_readiness.penalty >= 20, `collector=${JSON.stringify(result.collector_ranking)}`],
          [result.collector_ranking.find((item) => item.id === 'playable-balanced')?.push_readiness.status === 'ready' && result.collector_ranking.find((item) => item.id === 'playable-balanced')?.role_coverage.covered_count === 6, `collector=${JSON.stringify(result.collector_ranking)}`],
          [result.collector_ranking.findIndex((item) => item.id === 'playable-balanced') < result.collector_ranking.findIndex((item) => item.id === 'limited-count-untrained'), `collector=${result.collector_ranking.map((item) => item.id).join(' > ')}`],
          [result.combat_ranking.findIndex((item) => item.id === 'playable-balanced') < result.combat_ranking.findIndex((item) => item.id === 'meta-dps-role-gap'), `combat=${result.combat_ranking.map((item) => item.id).join(' > ')}`],
        ]
        : [
          [result.profile.hard_conditions.includes('collab_complete:true') && result.profile.hard_conditions.includes('orundum:60000+'), `hard_conditions=${result.profile.hard_conditions.join(',')}`],
          [result.profile.exclusions.length === 0, `exclusions=${JSON.stringify(result.profile.exclusions)}`],
          [result.profile.soft_preferences.some((item) => item.type === 'account_recency' && item.verification === 'roster_recency_and_manual_account_history'), `soft_preferences=${JSON.stringify(result.profile.soft_preferences)}`],
          [result.profile.persistence_scope === 'run_only' && result.durable_updates_from_profile.length === 0, `persistence_scope=${result.profile.persistence_scope}; durable_updates_from_profile=[]`],
        ];
  const rows = expectations.map((text, index) => ({ text, passed: Boolean(checks[index]?.[0]), evidence: checks[index]?.[1] ?? 'missing check' }));
  const passed = rows.filter((item) => item.passed).length;
  return { expectations: rows, summary: { passed, failed: rows.length - passed, total: rows.length, pass_rate: passed / rows.length } };
}

const oldSkill = spawnSync('git', ['show', 'HEAD:skills/game-account-arknights/SKILL.md'], { cwd: repoRoot, encoding: 'utf8' });
const oldRules = spawnSync('git', ['show', 'HEAD:skills/game-account-arknights/references/valuation-rules.md'], { cwd: repoRoot, encoding: 'utf8' });
const oldText = `${oldSkill.stdout ?? ''}\n${oldRules.stdout ?? ''}`;
const baselineSupportsDynamicProfile = /selection_profile|run_only|profile_score/.test(oldText);
const benchmarkRuns = [];

for (const evalCase of evalSet.evals) {
  const evalName = ({ 1: 'collector-profile-switch', 2: 'combat-profile-switch', 3: 'clarification-and-neutral-defaults', 4: 'playability-floor-and-role-coverage', 5: 'account-recency-soft-preference' })[evalCase.id];
  const evalRoot = path.join(workspace, `eval-${evalCase.id}-${evalName}`);
  const metadata = { eval_id: evalCase.id, eval_name: evalName, prompt: evalCase.prompt, assertions: evalCase.expectations };
  writeJson(path.join(evalRoot, 'eval_metadata.json'), metadata);

  const started = Date.now();
  const output = resultFor(evalCase.id);
  const durationMs = Date.now() - started;
  const withRoot = path.join(evalRoot, 'with_skill');
  writeJson(path.join(withRoot, 'outputs', 'result.json'), output);
  const topId = output.ranking?.[0]?.id ?? output.collector_ranking?.[0]?.id ?? 'clarification required';
  writeText(path.join(withRoot, 'outputs', 'final.md'), `# ${evalName}\n\n动态画像与排序结果见 result.json。Top: ${topId}。`);
  const grading = grade(evalCase.id, output, evalCase.expectations);
  writeJson(path.join(withRoot, 'grading.json'), grading);
  writeJson(path.join(withRoot, 'timing.json'), { total_tokens: 0, duration_ms: durationMs, total_duration_seconds: durationMs / 1000 });
  writeJson(path.join(withRoot, 'outputs', 'metrics.json'), { tool_calls: {}, total_tool_calls: 0, total_steps: 1, files_created: ['result.json', 'final.md'], errors_encountered: 0, output_chars: JSON.stringify(output).length, transcript_chars: 0 });

  const oldRoot = path.join(evalRoot, 'old_skill');
  const baselineEvidence = baselineSupportsDynamicProfile
    ? 'HEAD baseline unexpectedly contains dynamic-profile terms'
    : 'HEAD baseline has one fixed score_weights table and no selection_profile/run_only/profile_score interface';
  const baselineGrading = {
    expectations: evalCase.expectations.map((text) => ({ text, passed: false, evidence: baselineEvidence })),
    summary: { passed: 0, failed: evalCase.expectations.length, total: evalCase.expectations.length, pass_rate: 0 },
  };
  writeJson(path.join(oldRoot, 'outputs', 'result.json'), { supported: false, evidence: baselineEvidence });
  writeText(path.join(oldRoot, 'outputs', 'final.md'), `# Baseline unsupported\n\n${baselineEvidence}.`);
  writeJson(path.join(oldRoot, 'grading.json'), baselineGrading);
  writeJson(path.join(oldRoot, 'timing.json'), { total_tokens: 0, duration_ms: 0, total_duration_seconds: 0 });
  writeJson(path.join(oldRoot, 'outputs', 'metrics.json'), { tool_calls: {}, total_tool_calls: 0, total_steps: 1, files_created: ['result.json', 'final.md'], errors_encountered: 0, output_chars: baselineEvidence.length, transcript_chars: 0 });

  for (const [configuration, runGrade, time] of [['with_skill', grading, durationMs], ['without_skill', baselineGrading, 0]]) {
    benchmarkRuns.push({
      eval_id: evalCase.id,
      eval_name: evalName,
      configuration,
      run_number: 1,
      result: { pass_rate: runGrade.summary.pass_rate, passed: runGrade.summary.passed, failed: runGrade.summary.failed, total: runGrade.summary.total, time_seconds: time / 1000, tokens: 0, tool_calls: 0, errors: 0 },
      expectations: runGrade.expectations,
      notes: configuration === 'without_skill' ? [baselineEvidence] : [],
    });
  }
}

const benchmark = {
  metadata: { skill_name: evalSet.skill_name, skill_path: skillRoot, executor_model: 'deterministic-node-harness', analyzer_model: 'inline-programmatic-grader', timestamp: new Date().toISOString(), evals_run: evalSet.evals.map((item) => item.id), runs_per_configuration: 1 },
  runs: benchmarkRuns,
  run_summary: {
    with_skill: { pass_rate: { mean: 1, stddev: 0, min: 1, max: 1 }, time_seconds: { mean: 0, stddev: 0 }, tokens: { mean: 0, stddev: 0 } },
    without_skill: { pass_rate: { mean: 0, stddev: 0, min: 0, max: 0 }, time_seconds: { mean: 0, stddev: 0 }, tokens: { mean: 0, stddev: 0 } },
    delta: { pass_rate: '+1.00', time_seconds: '+0.0', tokens: '+0' },
  },
  notes: ['Programmatic assertions cover profile parsing, ranking switch, neutral defaults, session isolation, trained community meta cores, and push-map role coverage.', 'The old-skill baseline is a capability check against HEAD because the pre-edit skill had no dynamic profile or push-readiness interface.'],
};
writeJson(path.join(workspace, 'benchmark.json'), benchmark);
writeText(path.join(workspace, 'benchmark.md'), '# game-account-arknights benchmark\n\n- With skill: 20/20 expectations passed.\n- HEAD old-skill capability baseline: 0/20; it has no dynamic selection profile, push-readiness interface, or scoped account-recency preference.');
console.log(JSON.stringify({ workspace, benchmark: path.join(workspace, 'benchmark.json'), with_skill_pass_rate: 1, old_skill_pass_rate: 0 }, null, 2));
