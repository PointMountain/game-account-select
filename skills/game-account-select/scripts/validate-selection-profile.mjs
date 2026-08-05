#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseSelectionProfile } from './parse-selection-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactScript = path.join(__dirname, 'create-run-artifact.mjs');

const collector = parseSelectionProfile('明日方舟，限定联动多，1000 元左右，螃蟹');
const combat = parseSelectionProfile('明日方舟，战力优先，3000 元左右，螃蟹');
assert.equal(collector.persistence_scope, 'run_only');
assert.equal(combat.persistence_scope, 'run_only');
assert.equal(collector.confirmation_required, false);
assert.notDeepEqual(collector.priorities, combat.priorities);
assert.equal(Object.values(collector.priorities).reduce((sum, value) => sum + value, 0), 100);
assert.equal(Object.values(parseSelectionProfile('战力和性价比都要，约3000元').priorities).reduce((sum, value) => sum + value, 0), 100);

const missing = parseSelectionProfile('帮我找明日方舟账号');
assert.deepEqual(missing.clarification_required.sort(), ['budget', 'objective']);
const approximatePrefix = parseSelectionProfile('明日方舟限定多，约1000元');
assert.equal(approximatePrefix.budget.target, 1000);
assert.equal(approximatePrefix.budget.primary_min, 800);
assert.equal(approximatePrefix.budget.primary_max, 1200);
const conflicting = parseSelectionProfile('明日方舟限定多、战力也高，约3000元');
assert.ok(conflicting.clarification_required.includes('objective_conflict'));
const explicitBlend = parseSelectionProfile('明日方舟限定和战力都要兼顾，约3000元');
assert.ok(!explicitBlend.clarification_required.includes('objective_conflict'));
const expandable = parseSelectionProfile('联动全齐，2000元以内；如果找不到可以突破预算上限，找最低满足价，同时保留预算内接近的号');
assert.equal(expandable.budget_expansion.enabled, true);
assert.equal(expandable.budget_expansion.mode, 'bidirectional_first_satisfying_band');
assert.deepEqual(expandable.budget_expansion.directions, ['lower', 'higher']);
assert.equal(expandable.budget_expansion.max_price, null);
const cappedExpansion = parseSelectionProfile('必须有艾拉，2000元以内，找不到可以超预算最高到3500元');
assert.equal(cappedExpansion.budget_expansion.enabled, true);
assert.equal(cappedExpansion.budget_expansion.max_price, 3500);
assert.equal(parseSelectionProfile('限定多，1000元左右').budget_expansion.enabled, true);
assert.equal(parseSelectionProfile('限定多，1000元左右').budget_expansion.authorization, 'default_fallback');
const strictBudget = parseSelectionProfile('限定多，1000元左右，只看预算范围内，绝不超预算');
assert.equal(strictBudget.budget_expansion.enabled, false);
assert.equal(strictBudget.budget_expansion.authorization, 'disabled_by_user');
const approximateOrundum = parseSelectionProfile('明日方舟2000元左右，联动全齐，队伍成熟，合成玉10万左右');
assert.equal(approximateOrundum.budget.target, 2000);
assert.ok(approximateOrundum.hard_conditions.includes('orundum:80000-120000'));
const minimumOrundum = parseSelectionProfile('10w以上的合成玉，战力优先，2000元以内');
assert.equal(minimumOrundum.budget.primary_max, 2000);
assert.ok(minimumOrundum.hard_conditions.includes('orundum:100000+'));
const resourceFirst = parseSelectionProfile('合成玉10万左右，预算2000元，战力优先');
assert.equal(resourceFirst.budget.target, 2000, 'resource amount must not be parsed as the account budget');
assert.ok(resourceFirst.hard_conditions.includes('orundum:80000-120000'));
const structuredComposite = parseSelectionProfile('明日方舟，2000元左右，联动全齐，高练直接玩，合成玉10万左右');
assert.equal(structuredComposite.objective, 'custom');
assert.equal(structuredComposite.confirmation_required, false, 'multiple explicit hard/scenario requirements form a complete custom profile and should not trigger an unnecessary choice');

const accountRecencyPreference = parseSelectionProfile('明日方舟2000元左右，联动全齐，合成玉6万以上，不要只有早期收藏且阵容断代的陈年仓库号');
assert.deepEqual(accountRecencyPreference.exclusions, [], 'account-level age language must not become an operator exclusion');
assert.deepEqual(accountRecencyPreference.soft_preferences, [
  {
    type: 'account_recency',
    preference: 'avoid_stale_roster',
    source_text: '只有早期收藏且阵容断代的陈年仓库号',
    verification: 'roster_recency_and_manual_account_history',
  },
]);
assert.ok(accountRecencyPreference.assumptions.some((item) => item.includes('账号新度')));

const run = spawnSync(process.execPath, [
  artifactScript,
  '--game', '明日方舟',
  '--user-request', '限定联动多，1000 元左右，螃蟹',
  '--json',
], { encoding: 'utf8', cwd: path.resolve(__dirname, '..', '..', '..') });

assert.equal(run.status, 0, run.stderr);
const artifact = JSON.parse(run.stdout);
assert.equal(artifact.selection_profile.objective, 'collector');
assert.equal(artifact.selection_profile.persistence_scope, 'run_only');
assert.equal(artifact.profile_confirmation.status, 'confirmed');
assert.equal(artifact.selection_profile.confirmation_required, false);
assert.equal(artifact.profile_confirmation.confirmation_mode, 'automatic_complete_profile');
assert.equal(artifact.selection_profile.budget_expansion.enabled, true);
assert.ok(artifact.profile_confirmation.profile_digest);
assert.deepEqual(artifact.knowledge_update_candidates, []);
assert.deepEqual(artifact.profile_isolation.durable_updates_from_profile, []);

const overrideRun = spawnSync(process.execPath, [
  artifactScript,
  '--game', '明日方舟',
  '--user-request', '战力优先',
  '--budget-max', '3000',
  '--platforms', 'pxb7',
  '--profile-confirmed',
  '--json',
], { encoding: 'utf8', cwd: path.resolve(__dirname, '..', '..', '..') });
assert.equal(overrideRun.status, 0, overrideRun.stderr);
const overrideArtifact = JSON.parse(overrideRun.stdout);
assert.equal(overrideArtifact.selection_profile.budget.target, 3000);
assert.equal(overrideArtifact.selection_profile.budget.primary_max, 3000);
assert.equal(overrideArtifact.selection_profile.budget_expansion.enabled, true);
assert.equal(overrideArtifact.selection_profile.budget_expansion.authorization, 'default_fallback');
assert.deepEqual(overrideArtifact.selection_profile.platforms, ['pxb7']);

const mentionedPlatformRun = spawnSync(process.execPath, [
  artifactScript,
  '--game', '明日方舟',
  '--user-request', '限定多，1000 左右，先从螃蟹找',
  '--profile-confirmed',
  '--json',
], { encoding: 'utf8', cwd: path.resolve(__dirname, '..', '..', '..') });
assert.equal(mentionedPlatformRun.status, 0, mentionedPlatformRun.stderr);
const mentionedPlatformArtifact = JSON.parse(mentionedPlatformRun.stdout);
assert.deepEqual(mentionedPlatformArtifact.selection_profile.platforms, ['pxb7', 'pzds'], 'mentioning one platform must not shrink required default coverage');
assert.deepEqual(overrideArtifact.selection_profile.clarification_required, []);
assert.equal(overrideArtifact.profile_confirmation.status, 'confirmed');

console.log('Validation passed: run artifacts freeze a run-only selection profile without durable preference updates.');
