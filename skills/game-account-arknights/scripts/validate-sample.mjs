#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSelectionProfile } from '../../game-account-select/scripts/parse-selection-profile.mjs';
import { rankListings } from './score-listings.mjs';
import { matchesExpected } from './verify-collab-images.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'arknights-profile-validation-sample.json'), 'utf8'));

const collectorProfile = parseSelectionProfile(fixture.requests.collector);
const combatProfile = parseSelectionProfile(fixture.requests.combat);
const incompleteProfile = parseSelectionProfile('帮我看看明日方舟账号');
const collabCompleteProfile = parseSelectionProfile('明日方舟，2000 元以内，联动全齐为硬要求，队伍相对成熟，皮肤好一点，螃蟹');
const expandableCollabProfile = parseSelectionProfile('明日方舟，2000 元以内，联动全齐，队伍成熟；找不到可以突破预算上限找最低满足价，同时保留价位内接近的号');

assert.equal(collectorProfile.objective, 'collector');
assert.equal(collectorProfile.budget.target, 1000);
assert.deepEqual(
  [collectorProfile.budget.primary_min, collectorProfile.budget.primary_max],
  [800, 1200],
  '1000 左右应只生成本轮预算区间'
);
assert.equal(combatProfile.objective, 'combat');
assert.equal(combatProfile.budget.target, 3000);
assert.deepEqual(
  [combatProfile.budget.primary_min, combatProfile.budget.primary_max],
  [2400, 3600],
  '3000 左右应生成独立预算区间'
);
assert.notDeepEqual(collectorProfile.priorities, combatProfile.priorities);
assert.deepEqual(incompleteProfile.clarification_required.sort(), ['budget', 'objective']);
assert.equal(collectorProfile.persistence_scope, 'run_only');
assert.ok(collabCompleteProfile.hard_conditions.includes('collab_complete:true'), '“联动全齐”必须解析为本轮硬条件');
assert.ok(collabCompleteProfile.priorities.combat > 0, '“队伍相对成熟”必须提高实战维度，不能只解析成收藏和皮肤');
assert.equal(collabCompleteProfile.clarification_required.length, 0);
assert.equal(expandableCollabProfile.budget_expansion.enabled, true);
assert.equal(expandableCollabProfile.budget_expansion.authorization, 'user_explicit');
assert.equal(expandableCollabProfile.budget_expansion.max_price, null);
assert.equal(matchesExpected('火龙S黑角', '火龙S黑角'), true);
assert.equal(matchesExpected('CONEESS.47 罗德岛隐秘B', '罗德岛隐秘队'), true, 'OCR 尾字误识别时，稳定长前缀仍应触发人工可复核命中');
assert.equal(matchesExpected('罗德岛', '罗德岛隐秘队'), false, '过短前缀不得误判联动干员存在');

const collectorRanking = rankListings(fixture.listings, collectorProfile);
const combatRanking = rankListings(fixture.listings, combatProfile);

assert.equal(collectorRanking[0].id, fixture.expected.collector_top);
assert.equal(combatRanking[0].id, fixture.expected.combat_top);
assert.notEqual(collectorRanking[0].id, combatRanking[0].id, '画像切换必须改变排序');

const skinOnly = collectorRanking.find((item) => item.id === 'skin-only');
const collectorTop = collectorRanking.find((item) => item.id === fixture.expected.collector_top);
assert.ok(collectorTop.base_dimensions.rarity > skinOnly.base_dimensions.rarity);
assert.ok(collectorTop.final_score > skinOnly.final_score, '皮肤数量不能替代稀缺干员');

const countTrap = collectorRanking.find((item) => item.id === 'limited-count-untrained');
const playableBalancedCollector = collectorRanking.find((item) => item.id === 'playable-balanced');
assert.ok(playableBalancedCollector.final_score > countTrap.final_score, '限定数量很多但完全未养成的账号不得压过可推图的成熟小阵容');
assert.equal(countTrap.push_readiness.status, 'not_ready');
assert.ok(countTrap.playability_penalty >= 20, '不可推图的账号必须受到跨画像基础质量罚分');

const playableBalancedCombat = combatRanking.find((item) => item.id === 'playable-balanced');
const dpsRoleGap = combatRanking.find((item) => item.id === 'meta-dps-role-gap');
assert.equal(playableBalancedCombat.push_readiness.status, 'ready');
assert.equal(playableBalancedCombat.combat_breakdown.role_coverage.covered_count, 6);
assert.ok(playableBalancedCombat.final_score > dpsRoleGap.final_score, '超大杯输出堆叠不能替代先锋、阻挡和治疗等推图职能覆盖');
assert.deepEqual(dpsRoleGap.combat_breakdown.role_coverage.missing_roles.sort(), ['deployment', 'laneholding', 'sustain']);

const eliteOnlyUnknownProgression = structuredClone(fixture.listings.find((item) => item.id === 'playable-balanced'));
eliteOnlyUnknownProgression.id = 'elite-only-unknown-progression';
for (const operator of eliteOnlyUnknownProgression.game_assets.operators) {
  operator.mastery = null;
  operator.module = null;
}
const [fullyVerifiedProgression, unknownProgression] = rankListings([
  fixture.listings.find((item) => item.id === 'playable-balanced'),
  eliteOnlyUnknownProgression,
], combatProfile);
assert.equal(fullyVerifiedProgression.id, 'playable-balanced');
assert.ok(fullyVerifiedProgression.base_dimensions.progression > unknownProgression.base_dimensions.progression, '未知专精/模组不得获得隐含养成分');
assert.equal(unknownProgression.push_readiness.status, 'partial', '小阵容只有精二证据、没有专精/模组证据时应降为部分可用，不能继续宣称完整推图就绪');

const risky = collectorRanking.find((item) => item.id === 'risky-rich');
assert.equal(risky.hard_filter_passed, true, '未声明区服硬条件时不得直接排除 B 服账号');
assert.ok(risky.risk_penalty > 0, '风险事实仍必须进入独立罚分');

const officialOnly = parseSelectionProfile('明日方舟，必须官服，战力优先，3000 元左右');
const officialOnlyRanking = rankListings(fixture.listings, officialOnly);
assert.equal(officialOnlyRanking.find((item) => item.id === 'risky-rich').hard_filter_passed, false);

const singleCharacterOperatorListing = structuredClone(fixture.listings.find((item) => item.id === 'playable-balanced'));
singleCharacterOperatorListing.id = 'single-character-operator';
singleCharacterOperatorListing.game_assets.operators = [{ name: '陈', elite: 2, mastery: 3, module: 3 }];
const defensiveFreeformProfile = { ...collectorProfile, exclusions: ['陈年仓库号'] };
assert.equal(
  rankListings([singleCharacterOperatorListing], defensiveFreeformProfile)[0].hard_filter_passed,
  true,
  'a one-character operator name must not fuzzy-match an unrelated freeform account phrase'
);
const explicitOperatorExclusionProfile = { ...collectorProfile, exclusions: ['陈'] };
assert.equal(
  rankListings([singleCharacterOperatorListing], explicitOperatorExclusionProfile)[0].hard_filter_passed,
  false,
  'an exact operator exclusion must keep working for one-character names'
);

const sameAssetsCheaper = structuredClone(fixture.listings.find((item) => item.id === 'collector-vault'));
sameAssetsCheaper.id = 'same-assets-cheaper';
sameAssetsCheaper.price = 860;
const sameAssetsPricier = structuredClone(sameAssetsCheaper);
sameAssetsPricier.id = 'same-assets-pricier';
sameAssetsPricier.price = 1060;
const priceEfficiencyRanking = rankListings([sameAssetsPricier, sameAssetsCheaper], collectorProfile);
assert.equal(priceEfficiencyRanking[0].id, 'same-assets-cheaper', '同等资产的低价账号应有更高价格效率');
assert.ok(priceEfficiencyRanking[0].base_dimensions.price_efficiency > priceEfficiencyRanking[1].base_dimensions.price_efficiency);

const collabCompleteListing = structuredClone(fixture.listings.find((item) => item.id === 'playable-balanced'));
collabCompleteListing.id = 'collab-complete';
collabCompleteListing.game_assets.collab_completion = { observed_count: 25, required_count: 25, ratio: 1, complete: true };
collabCompleteListing.game_assets.platform_facts = { counts: { skins: 120 } };
const collabIncompleteListing = structuredClone(collabCompleteListing);
collabIncompleteListing.id = 'collab-incomplete';
collabIncompleteListing.game_assets.collab_completion = { observed_count: 24, required_count: 25, ratio: 0.96, complete: false };
const collabHardRanking = rankListings([collabIncompleteListing, collabCompleteListing], collabCompleteProfile);
assert.equal(collabHardRanking[0].id, 'collab-complete');
assert.equal(collabHardRanking.find((item) => item.id === 'collab-incomplete').hard_filter_passed, false, '差一个联动也不能冒充“联动全齐”');

const resourceHardProfile = parseSelectionProfile('明日方舟2000元左右，联动全齐，队伍成熟为主，合成玉10万左右');
assert.ok(resourceHardProfile.hard_conditions.includes('orundum:80000-120000'), '明确资源数值必须冻结为本轮硬条件');
const resourceRichListing = structuredClone(collabCompleteListing);
resourceRichListing.id = 'resource-rich-collab-complete';
resourceRichListing.game_assets.resources = { ...(resourceRichListing.game_assets.resources ?? {}), orundum: 100000 };
const resourcePoorListing = structuredClone(collabCompleteListing);
resourcePoorListing.id = 'resource-poor-collab-complete';
resourcePoorListing.game_assets.resources = { ...(resourcePoorListing.game_assets.resources ?? {}), orundum: 1000 };
const resourceHardRanking = rankListings([resourcePoorListing, resourceRichListing], resourceHardProfile);
assert.equal(resourceHardRanking[0].id, 'resource-rich-collab-complete');
assert.equal(resourceHardRanking.find((item) => item.id === 'resource-rich-collab-complete').hard_filter_passed, true);
assert.equal(resourceHardRanking.find((item) => item.id === 'resource-poor-collab-complete').hard_filter_passed, false, '低资源账号不得仅靠资源权重混入“合成玉10万左右”的精确命中');

for (const row of collectorRanking) {
  console.log(`${row.id}: final=${row.final_score.toFixed(2)} rarity=${row.base_dimensions.rarity.toFixed(2)} combat=${row.base_dimensions.combat.toFixed(2)} risk=${row.risk_penalty.toFixed(2)}`);
}

console.log('Validation passed: runtime profiles change ranking without leaking preferences into durable rules.');
