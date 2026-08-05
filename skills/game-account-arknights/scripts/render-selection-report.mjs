#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function selectPlatformRows(section, limit = 5) {
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

function completion(row) {
  return row?.collab_completion ?? row?.game_assets?.collab_completion ?? {};
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
  const value = completion(row);
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
    return value;
  };
  const budgetGap = row?.budget_tier === 'excluded_price' ? '价格在本轮画像区间外' : null;
  const values = [budgetGap, ...reasons.map(humanize), ...concerns, ...missing.map((item) => `缺 ${item}`)].filter(Boolean).slice(0, 3);
  return values.length ? values.map(text).join('；') : '详情不足，未通过硬条件复核';
}

function platformName(platform) {
  return platform === 'pxb7' ? '螃蟹' : platform === 'pzds' ? '盼之' : platform;
}

function tableFor(platform, section, perPlatform) {
  const rows = selectPlatformRows(section, perPlatform);
  const lines = [
    `### ${platformName(platform)}候选（${rows.length} 个）`,
    '',
    text(section?.user_visible_note, rows.length ? '以下按本轮画像排序。' : '本轮没有可展示候选。'),
    '',
  ];
  if (!rows.length) return [...lines, '本轮未拿到可追踪候选；该平台不得视为已覆盖。'].join('\n');
  lines.push('| 层级 | 价格/区服 | 联动核验 | 抽卡资源 | 成熟度 | 皮肤 | 上架时间 | 平台验号时间 | 缺口/风险 | 链接 |');
  lines.push('|---|---:|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const price = number(row.price);
    const priceServer = `${price == null ? '价格未披露' : `¥${price.toLocaleString('zh-CN')}`} / ${text(row.server)}`;
    const link = row.url ? `[${text(row.listing_id, '打开商品')}](${row.url})` : text(row.listing_id, '无链接');
    lines.push(`| ${tierLabel(row)} | ${priceServer} | ${collabText(row)} | ${resourceText(row)} | ${combatText(row)} | ${skinText(row)} | ${text(row.published_at)} | ${text(row.platform_verified_at)} | ${gapText(row)} | ${link} |`);
  }
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

function bestValueLine(artifact) {
  const row = artifact.best_value_listing;
  if (!row) return '本轮没有详情复核后通过全部硬条件的跨平台第一名。';
  const price = number(row.price);
  const link = row.url ? `[${text(row.listing_id, '商品')}](${row.url})` : text(row.listing_id, '商品');
  return `跨平台性价比第一：${platformName(row.platform)} ${link}，${price == null ? '价格未披露' : `¥${price.toLocaleString('zh-CN')}`}；${collabText(row)}；${combatText(row)}。`;
}

export function renderSelectionReport(artifact, { perPlatform = 5 } = {}) {
  const shortlists = artifact.platform_shortlists ?? {};
  const selfImprove = artifact.self_improve ?? {};
  const candidateState = selfImprove.knowledge_candidates ?? {};
  const optimizerState = selfImprove.optimizer ?? {};
  const evaluatorState = selfImprove.evaluator ?? {};
  const coverageNotes = (Array.isArray(artifact.coverage_gaps) ? artifact.coverage_gaps : [])
    .map((gap) => text(gap?.user_visible_note ?? gap?.evidence ?? gap))
    .filter(Boolean)
    .slice(0, 5);
  const lines = [
    '# 明日方舟双平台账号筛选结果',
    '',
    bestValueLine(artifact),
    '',
    tableFor('pxb7', shortlists.pxb7, perPlatform),
    '',
    tableFor('pzds', shortlists.pzds, perPlatform),
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
    '- 联动“平台数量口径”和“25 人名单逐名核验”分开显示；数量不一致时以最终验号名单为准。',
    '- 公开页面未披露的专精与模组不计入已养成加分，需在付款前逐项验号。',
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = readArg('--input');
  const output = readArg('--out');
  const perPlatform = Math.max(1, Math.min(number(readArg('--per-platform', 5)) ?? 5, 15));
  if (!input) {
    console.error('Usage: render-selection-report.mjs --input <artifact.json> [--out <report.md>] [--per-platform 5]');
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
