#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeState } from '../../game-account-skill-optimizer/scripts/lib/learning-store.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const args = process.argv.slice(2);

function readArg(name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row?.platform ?? ''}:${row?.listing_id ?? row?.url ?? ''}`;
    if (!row || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectPlatformRows(section, limit = 10) {
  if (!section || typeof section !== 'object') return [];
  return uniqueRows([
    ...(Array.isArray(section.display_candidates) ? section.display_candidates : []),
    ...(Array.isArray(section.qualifying) ? section.qualifying : []),
    ...(Array.isArray(section.out_of_scope_qualifying) ? section.out_of_scope_qualifying : []),
    ...(Array.isArray(section.near_matches) ? section.near_matches : []),
    ...(Array.isArray(section.out_of_scope_near_matches) ? section.out_of_scope_near_matches : []),
    ...(Array.isArray(section.list_only_candidates) ? section.list_only_candidates : []),
  ]).slice(0, Math.max(1, limit));
}

function text(value, fallback = '未披露') {
  if (value == null || value === '') return fallback;
  return String(value).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || fallback;
}

function number(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function countValue(row, key) {
  return number(row?.platform_facts?.counts?.[key]
    ?? row?.game_assets?.platform_facts?.counts?.[key]);
}

function resources(row) {
  return row?.resource_facts ?? row?.game_assets?.resources ?? {};
}

function collabCompletion(row) {
  return row?.collab_completion ?? row?.game_assets?.collab_completion ?? {};
}

function limitedCompletion(row) {
  return row?.limited_completion ?? row?.game_assets?.limited_completion ?? {};
}

function tierLabel(row) {
  const tier = String(row?.recommendation_tier ?? '');
  if (/best_value|cross_platform_best_value/.test(tier)) return '性价比';
  if (/qualifying|primary/.test(tier)) return '符合';
  if (/near_match/.test(tier)) return '接近项';
  if (/list_only/.test(tier)) return '列表待复核';
  if (/breakthrough_lower/.test(tier)) return '低价精确项';
  if (/breakthrough_higher/.test(tier)) return '高价精确项';
  if (/breakthrough/.test(tier)) return '区间外精确项';
  if (/backup|flex/.test(tier)) return '备选';
  return '候选';
}

function collabText(row) {
  const value = collabCompletion(row);
  const required = number(value.required_count) ?? 25;
  const named = number(value.verified_count ?? value.named_count);
  const observed = number(value.observed_count);
  const declared = number(value.declared_count ?? countValue(row, 'collab'));
  const rosterCount = named ?? observed;
  const roster = rosterCount == null ? `名单未完整披露/${required}` : `名单核验 ${rosterCount}/${required}`;
  const verified = value.complete === true ? '已确认全齐' : value.verification_status ? text(value.verification_status) : '未确认全齐';
  const declaredPart = declared == null ? '' : `；平台口径 ${declared}`;
  return `${roster}（${verified}）${declaredPart}`;
}

function limitedText(row) {
  const value = limitedCompletion(row);
  const required = number(value.required_count) ?? 26;
  const named = number(value.verified_count ?? value.named_count ?? value.observed_count);
  const roster = named == null ? `名单未完整披露/${required}` : `名单核验 ${named}/${required}`;
  const verified = value.complete === true ? '已确认全齐' : '未确认全齐';
  return `${roster}（${verified}）`;
}

function collectionText(row, limitedMode) {
  return limitedMode ? limitedText(row) : collabText(row);
}

function resourceText(row) {
  const value = resources(row);
  const orundum = number(value.orundum);
  const prime = number(value.originite_prime ?? value.originitePrime);
  const pulls = number(row?.estimated_pulls);
  return [
    orundum == null ? '合成玉未披露' : `合成玉 ${orundum.toLocaleString('zh-CN')}`,
    prime == null ? null : `源石 ${prime}`,
    pulls == null ? null : `约 ${pulls} 抽`,
  ].filter(Boolean).join('；');
}

function combatText(row) {
  const push = row?.push_readiness ?? {};
  const role = row?.combat_breakdown?.role_coverage ?? row?.role_coverage ?? {};
  const elite2 = countValue(row, 'elite2');
  const readyCore = number(push.ready_recommended_count);
  const covered = number(push.role_coverage_count ?? role.covered_count);
  const required = number(role.required_count) ?? 6;
  return [
    push.status ? `推图 ${text(push.status)}` : '推图状态待复核',
    elite2 == null ? null : `精二 ${elite2}`,
    readyCore == null ? null : `已养成核心 ${readyCore}`,
    covered == null ? null : `职能 ${covered}/${required}`,
  ].filter(Boolean).join('；');
}

function skinText(row) {
  const skins = number(row?.skin_count ?? countValue(row, 'skins'));
  const dynamic = countValue(row, 'dynamicSkins');
  const collab = countValue(row, 'collabSkins');
  return [
    skins == null ? '未披露' : `${skins} 套`,
    dynamic == null ? null : `动态 ${dynamic}`,
    collab == null ? null : `联名 ${collab}`,
  ].filter(Boolean).join('；');
}

function gapText(row) {
  if (row?.hard_filter_passed === true) return '硬条件通过；仍需终验绑定/专精/模组';
  const reasons = Array.isArray(row?.hard_filter_reasons) ? row.hard_filter_reasons : [];
  const concerns = Array.isArray(row?.concerns) ? row.concerns : [];
  const missing = Array.isArray(row?.missing_fields) ? row.missing_fields : [];
  const humanize = (value) => {
    const range = String(value).match(/^orundum:(\d+)-(\d+)$/);
    if (range) return `合成玉不在 ${Number(range[1]).toLocaleString('zh-CN')}–${Number(range[2]).toLocaleString('zh-CN')}`;
    const minimum = String(value).match(/^orundum:(\d+)\+$/);
    if (minimum) return `合成玉不足 ${Number(minimum[1]).toLocaleString('zh-CN')}`;
    if (value === 'collab_complete:true') return '联动 25 人名单未确认全齐';
    if (value === 'limited_complete:true') return '限定寻访 26 人名单未确认全齐';
    return value;
  };
  const budgetGap = row?.budget_tier === 'excluded_price' ? '价格在本轮画像区间外' : null;
  const values = [budgetGap, ...reasons.map(humanize), ...concerns, ...missing.map((item) => `缺 ${item}`)].filter(Boolean).slice(0, 3);
  return values.length ? values.map(text).join('；') : '详情不足，未通过硬条件复核';
}

function platformName(platform) {
  return platform === 'pxb7' ? '螃蟹' : platform === 'pzds' ? '盼之' : platform;
}

function rowsTable(title, rows, note, limitedMode = false) {
  const lines = [
    `### ${title}（${rows.length} 个）`,
    '',
    text(note, rows.length ? '以下按本轮画像排序。' : '本轮没有可展示候选。'),
    '',
  ];
  if (!rows.length) return [...lines, '本轮没有可追踪候选。'].join('\n');
  lines.push(`| 层级 | 价格/区服 | ${limitedMode ? '限定核验' : '联动核验'} | 抽卡资源 | 成熟度 | 皮肤 | 上架时间 | 平台验号时间 | 缺口/风险 | 链接 |`);
  lines.push('|---|---:|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const price = number(row.price);
    const priceServer = `${price == null ? '价格未披露' : `¥${price.toLocaleString('zh-CN')}`} / ${text(row.server)}`;
    const link = row.url ? `[${text(row.listing_id, '打开商品')}](${row.url})` : text(row.listing_id, '无链接');
    lines.push(`| ${tierLabel(row)} | ${priceServer} | ${collectionText(row, limitedMode)} | ${resourceText(row)} | ${combatText(row)} | ${skinText(row)} | ${text(row.published_at)} | ${text(row.platform_verified_at)} | ${gapText(row)} | ${link} |`);
  }
  return lines.join('\n');
}

function tableFor(platform, section, perPlatform, limitedMode = false) {
  const rows = selectPlatformRows(section, perPlatform);
  const table = rowsTable(
    `${platformName(platform)}候选`,
    rows,
    section?.user_visible_note ?? (rows.length ? '以下按本轮画像排序。' : '本轮没有可展示候选。'),
    limitedMode,
  );
  if (rows.length) return table;
  return `${table}\n\n该平台不得视为已覆盖。`;
}

function primaryBudget(profile) {
  const min = number(profile?.budget?.primary_min);
  const max = number(profile?.budget?.primary_max);
  return { min, max, unlimited: profile?.budget?.interpretation === 'explicit_unlimited' && max == null };
}

function isInsidePrimaryBudget(row, budget) {
  const price = number(row?.price);
  if (price == null) return false;
  if (budget.min != null && price < budget.min) return false;
  if (budget.max != null && price > budget.max) return false;
  return true;
}

function budgetLayerRows(artifact, limit = 5) {
  const shortlists = artifact.platform_shortlists ?? {};
  const platformRows = ['pxb7', 'pzds'].flatMap((platform) => {
    const section = shortlists[platform] ?? {};
    return [
      ...(Array.isArray(section.qualifying) ? section.qualifying : []),
      ...(Array.isArray(section.near_matches) ? section.near_matches : []),
      ...(Array.isArray(section.out_of_scope_qualifying) ? section.out_of_scope_qualifying : []),
      ...(Array.isArray(section.out_of_scope_near_matches) ? section.out_of_scope_near_matches : []),
    ];
  });
  const budget = primaryBudget(artifact.selection_profile ?? artifact);
  const exact = uniqueRows([
    ...(Array.isArray(artifact.recommendations) ? artifact.recommendations : []),
    ...(Array.isArray(artifact.backup_listings) ? artifact.backup_listings : []),
    ...platformRows,
  ]).filter((row) => row?.hard_filter_passed === true && isInsidePrimaryBudget(row, budget));
  const near = uniqueRows([
    ...(Array.isArray(artifact.near_match_listings) ? artifact.near_match_listings : []),
    ...platformRows,
  ]).filter((row) => row?.hard_filter_passed !== true && isInsidePrimaryBudget(row, budget)).slice(0, limit);
  const breakthrough = uniqueRows([
    ...(Array.isArray(artifact.budget_breakthrough_listings) ? artifact.budget_breakthrough_listings : []),
    ...platformRows.filter((row) => row?.hard_filter_passed === true && !isInsidePrimaryBudget(row, budget)),
  ]).slice(0, limit);
  return { budget, exact, near, breakthrough };
}

function budgetLabel(budget) {
  if (budget.unlimited) return '无上限';
  if (budget.min === 0 && budget.max != null) return `不高于 ¥${budget.max.toLocaleString('zh-CN')}`;
  if (budget.min != null && budget.max != null) return `¥${budget.min.toLocaleString('zh-CN')}–¥${budget.max.toLocaleString('zh-CN')}`;
  if (budget.max != null) return `不高于 ¥${budget.max.toLocaleString('zh-CN')}`;
  return '未声明';
}

function budgetComparisonLine(artifact) {
  const comparison = artifact.budget_comparison;
  if (!comparison || typeof comparison !== 'object') return null;
  const delta = number(comparison.price_delta);
  const gap = Array.isArray(comparison.hard_condition_gap_closed) && comparison.hard_condition_gap_closed.length
    ? comparison.hard_condition_gap_closed.join('、')
    : '画像硬条件';
  const combatGuidance = comparison.scenario_guidance?.push_map_or_combat;
  return `价差解释：突破项比预算内基准${delta == null ? '价格更高' : `多 ¥${delta.toLocaleString('zh-CN')}`}，主要补齐 ${text(gap)}。${combatGuidance ? `场景判断：${text(combatGuidance)}` : ''}`;
}

function budgetLayerReport(artifact, limitedMode = false) {
  const { budget, exact, near, breakthrough } = budgetLayerRows(artifact, 5);
  const lines = [
    '## 预算分层',
    '',
    `- 本轮主预算：${budgetLabel(budget)}。`,
    exact.length
      ? `- 预算内完整满足全部硬条件：${exact.length} 个；仍需按表中风险项完成下单前终验。`
      : budget.unlimited
        ? '- 预算内完整满足全部硬条件：0 个。当前候选仍有图鉴或练度证据缺口。'
        : '- 预算内完整满足全部硬条件：0 个。以下先给预算内最接近项，再单独列出突破预算的完整满足项；两层不得互相替代。',
    '',
    rowsTable('预算内最接近', near, near.length ? (budget.unlimited ? '以下候选尚未满足全部硬条件，价格与资产仅供比较。' : '这些账号仍有明确硬条件缺口，但价格在本轮主预算内，可用于判断是否值得加预算。') : '没有拿到可追踪的预算内接近项。', limitedMode),
    '',
    rowsTable('预算范围外完整满足', breakthrough, budget.unlimited ? '本轮没有价格上限，所有价格均归入同一比较范围。' : breakthrough.length ? '这些账号只作为扩价对照；增加预算是否值得，要看价差实际补齐了什么，而不是只看总分。' : '本轮扩价搜索没有复核到完整满足项。', limitedMode),
  ];
  const comparison = budget.unlimited ? null : budgetComparisonLine(artifact);
  if (comparison) lines.push('', comparison);
  return lines.join('\n');
}

function experienceLines(value) {
  if (typeof value === 'string') return value ? [value] : [];
  if (!value || typeof value !== 'object') return [];
  const effective = Array.isArray(value.effective) ? value.effective : [];
  const missing = Array.isArray(value.ineffective_or_missing) ? value.ineffective_or_missing : [];
  return [
    effective.length ? `有效：${effective.slice(0, 5).join('；')}` : null,
    missing.length ? `缺口：${missing.slice(0, 5).join('；')}` : null,
  ].filter(Boolean);
}

function bestValueLine(artifact, limitedMode = false) {
  const row = artifact.best_value_listing;
  if (!row) return '本轮没有详情复核后通过全部硬条件的跨平台第一名。';
  const price = number(row.price);
  const link = row.url ? `[${text(row.listing_id, '商品')}](${row.url})` : text(row.listing_id, '商品');
  return `跨平台性价比第一：${platformName(row.platform)} ${link}，${price == null ? '价格未披露' : `¥${price.toLocaleString('zh-CN')}`}；${collectionText(row, limitedMode)}；${combatText(row)}。`;
}

export function renderSelectionReport(artifact, { perPlatform = 10 } = {}) {
  const shortlists = artifact.platform_shortlists ?? {};
  const selfImprove = artifact.self_improve ?? {};
  const candidateState = knowledgeState(artifact.knowledge_update_candidates, repoRoot);
  const optimizerState = selfImprove.optimizer ?? {};
  const evaluatorState = selfImprove.evaluator ?? {};
  const coverageNotes = (Array.isArray(artifact.coverage_gaps) ? artifact.coverage_gaps : [])
    .map((gap) => text(gap?.user_visible_note ?? gap?.evidence ?? gap))
    .filter(Boolean)
    .slice(0, 5);
  const limitedMode = artifact.selection_profile?.hard_conditions?.includes('limited_complete:true') === true;
  const lines = [
    '# 明日方舟双平台账号筛选结果',
    '',
    bestValueLine(artifact, limitedMode),
    '',
    ...(artifact.selection_summary ? [text(artifact.selection_summary), ''] : []),
    budgetLayerReport(artifact, limitedMode),
    '',
    tableFor('pxb7', shortlists.pxb7, perPlatform, limitedMode),
    '',
    tableFor('pzds', shortlists.pzds, perPlatform, limitedMode),
    '',
    '## 本轮复盘与 Self-improve',
    '',
    ...experienceLines(artifact.experience_summary).map((line) => `- ${line}`),
    `- 覆盖缺口：${coverageNotes.length ? coverageNotes.join('；') : '未发现新的来源覆盖缺口。'}`,
    ...(Array.isArray(artifact.presentation?.candidate_shortage_platforms) && artifact.presentation.candidate_shortage_platforms.length
      ? [`- 候选数量：${artifact.presentation.candidate_shortage_platforms.map((platform) => `${platformName(platform)}仅有 ${artifact.presentation.per_platform_available?.[platform] ?? 0} 个可展示候选`).join('；')}；已全部展示，没有用重复或伪造账号凑数。`]
      : []),
    `- 收尾门禁：optimizer=${text(optimizerState.status, '待运行')}；evaluator=${text(evaluatorState.status, '待运行')}${typeof evaluatorState.passed === 'boolean' ? `（passed=${evaluatorState.passed}）` : ''}。`,
    `- 知识沉淀：共 ${number(candidateState.total) ?? 0} 条；本轮已应用 ${number(candidateState.applied) ?? 0} 条；已有机制复核 ${number(candidateState.verified_existing) ?? 0} 条；待验证/延期 ${number(candidateState.pending) ?? 0} 条。已有机制复核不计作本轮代码优化，待验证项也不会伪装成已完成优化。`,
    '',
    '## 下单前共同复核',
    '',
    '- 再次核对商品仍在售、价格、区服、实名/换绑、找回包赔与最新验号时间。',
    limitedMode
      ? '- “限定齐全”按 PRTS 狭义限定寻访 26 人逐名核验，排除联动与活动赠送；付款前仍需用最新验号名单复查。'
      : '- 联动“平台数量口径”和“25 人名单逐名核验”分开显示；数量不一致时以最终验号名单为准。',
    '- 公开页面未披露的专精与模组不计入已养成加分，需在付款前逐项验号。',
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = readArg('--input');
  const output = readArg('--out');
  const perPlatform = Math.max(1, Math.min(number(readArg('--per-platform', 10)) ?? 10, 15));
  if (!input) {
    console.error('Usage: render-selection-report.mjs --input <artifact.json> [--out <report.md>] [--per-platform 10]');
    process.exit(2);
  }
  const artifact = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const markdown = renderSelectionReport(artifact, { perPlatform });
  if (output) {
    const absoluteOut = path.resolve(output);
    fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
    fs.writeFileSync(absoluteOut, markdown);
    console.log(JSON.stringify({ report: absoluteOut, per_platform: perPlatform }, null, 2));
  } else {
    process.stdout.write(markdown);
  }
}
