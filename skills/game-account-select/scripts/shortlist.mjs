#!/usr/bin/env node
// Generic, data-driven account shortlist. Game knowledge comes from references/games/<game>/game.json;
// the run profile comes from scripts/profile.mjs. Nothing from the profile is persisted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFreshness } from './freshness.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NON_ASSET_TERMS = new Set(['官服', 'B服', '渠道服', '国际服', '螃蟹', '盼之', 'pxb7', 'pzds', '交易猫', '淘手游', '闲鱼', '包赔', '验号']);

const get = (object, dotted) => dotted.split('.').reduce((value, key) => value?.[key], object);
const num = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

export function loadGame(game) {
  const dir = path.join(skillRoot, 'references', 'games', game);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
  for (const signal of config.signals) {
    if (signal.signature) signal.signatureTable = JSON.parse(fs.readFileSync(path.join(dir, signal.signature), 'utf8')).entries;
  }
  return config;
}

export function resolveGame(text) {
  const root = path.join(skillRoot, 'references', 'games');
  for (const slug of fs.readdirSync(root)) {
    const file = path.join(root, slug, 'game.json');
    if (!fs.existsSync(file)) continue;
    const { aliases = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if ([slug, ...aliases].some((alias) => String(text).toLowerCase().includes(alias.toLowerCase()))) return slug;
  }
  return null;
}

function assetNames(listing) {
  return [...new Set([
    ...(listing.assets ?? []).map((asset) => asset.name),
    ...(listing.operatorNames ?? []), ...(listing.elite2OperatorNames ?? []), ...(listing.elite1OperatorNames ?? []),
    ...(listing.collabOperatorNames ?? []), ...Object.keys(listing.agentStatuses ?? {}), ...(listing.sWEngineNames ?? []),
  ].filter(Boolean).map(String))];
}

function corpus(listing) {
  return [listing.title, listing.rawText, listing.sellerNote, ...assetNames(listing), ...(listing.riskFacts ?? []),
    ...Object.values(listing.binding ?? {})].filter(Boolean).join('\n');
}

function signalValue(signal, listing, names, text) {
  if (signal.names) {
    // Single-character names (e.g. 照/简) only count as exact asset names, never as free-text substrings.
    const hits = signal.names.filter((name) => names.includes(name) || (name.length > 1 && text.includes(name)));
    return { value: hits.length, hits };
  }
  if (signal.field) return { value: num(get(listing, signal.field)), hits: [] };
  if (signal.regex) {
    const matches = [...text.matchAll(new RegExp(signal.regex, 'g'))].map((match) => Number(match[1]));
    if (!matches.length) return { value: null, hits: [] };
    return { value: signal.sum ? matches.reduce((a, b) => a + b, 0) : Math.max(...matches), hits: [] };
  }
  if (signal.signatureTable) {
    const statuses = listing.agentStatuses ?? {};
    const engines = listing.sWEngineNames ?? [];
    const hits = signal.signatureTable.filter((entry) => entry.agent_names.some((name) => name in statuses)
      && (entry.agent_names.some((name) => /\+[1-9]/.test(String(statuses[name] ?? '')))
        || entry.signature_engines.some((engine) => engines.includes(engine))))
      .map((entry) => entry.agent_names[0]);
    return { value: Object.keys(statuses).length || engines.length ? hits.length : null, hits };
  }
  return { value: null, hits: [] };
}

function budgetTier(price, budget) {
  if (price === null) return 'unknown_price';
  if (budget?.primary_max == null) return 'primary';
  if (price >= (budget.primary_min ?? 0) && price <= budget.primary_max) return 'primary';
  if (price >= (budget.flex_min ?? 0) && price <= (budget.flex_max ?? budget.primary_max)) return 'flex';
  return price < (budget.primary_min ?? 0) ? 'below_budget' : 'above_budget';
}

export function evaluateListing(listing, game, profile) {
  const names = assetNames(listing);
  const text = corpus(listing);
  const priorities = profile.priorities ?? {};
  const signals = game.signals.map((signal) => ({ ...signal, ...signalValue(signal, listing, names, text) }));
  const byObjective = {};
  for (const signal of signals) {
    if (signal.value === null) continue;
    (byObjective[signal.objective] ??= []).push(Math.min(1, signal.value / signal.scale));
  }
  const price = num(listing.priceCny);
  const ceiling = profile.budget?.primary_max ?? profile.budget?.flex_max ?? null;
  if (price !== null && ceiling) byObjective.price_efficiency = [Math.max(0, Math.min(1, 1 - price / (ceiling * 1.3)))];
  const weightTotal = Object.values(priorities).reduce((a, b) => a + b, 0) || 1;
  const score = Object.entries(priorities).reduce((sum, [objective, weight]) => {
    const values = byObjective[objective];
    return values ? sum + (weight / weightTotal) * (values.reduce((a, b) => a + b, 0) / values.length) : sum;
  }, 0);
  const required = (profile.must_have ?? []).filter((term) => !NON_ASSET_TERMS.has(term));
  const missingRequired = required.filter((term) => !names.includes(term) && !text.includes(term));
  const serverHard = (profile.hard_conditions ?? []).filter((c) => c.startsWith('server:')).map((c) => c.slice(7));
  const server = listing.server ?? listing.binding?.server ?? null;
  const serverMismatch = serverHard.length && server && !serverHard.some((wanted) => server.includes(wanted));
  const riskPositive = (game.risk?.positive ?? []).filter((term) => text.includes(term));
  const riskNegative = (game.risk?.negative ?? []).filter((term) => text.includes(term));
  const missingFields = signals.filter((signal) => signal.value === null).map((signal) => signal.label);
  if (!server) missingFields.push('区服');
  if (!(listing.status?.verifiedAt || listing.verifiedAt)) missingFields.push('平台验号时间');
  const riskAdjust = 0.02 * riskPositive.length - 0.05 * riskNegative.length - 0.01 * missingFields.length;
  return {
    listing_id: listing.listingId ?? null,
    site: /pxb7/.test(listing.url ?? '') ? 'pxb7' : /pzds/.test(listing.url ?? '') ? 'pzds' : 'other',
    price_cny: price,
    server,
    url: listing.url ?? null,
    published_at: listing.publishedAt ?? listing.listedAt ?? listing.status?.publishedAt ?? null,
    platform_verified_at: listing.status?.verifiedAt || listing.verifiedAt || null,
    guarantee: listing.status?.guarantee ?? (listing.riskFacts ?? []).includes('找回包赔'),
    budget_tier: budgetTier(price, profile.budget),
    hard_ok: missingRequired.length === 0 && !serverMismatch,
    missing_required: missingRequired,
    server_mismatch: Boolean(serverMismatch),
    score: Math.round(Math.max(0, score + riskAdjust) * 1000) / 10,
    highlights: signals.filter((s) => s.value).map((s) => `${s.label} ${s.hits.length ? s.hits.join('、') : s.value}`),
    risk_positive: riskPositive,
    risk_negative: riskNegative,
    missing_fields: [...new Set(missingFields)],
    source_status: listing.status?.sourceStatus ?? null,
  };
}

export function shortlist(listings, game, profile, { top = 5, freshness = null } = {}) {
  const unique = [...new Map(listings.filter((l) => l?.listingId).map((l) => [`${l.url ?? ''}|${l.listingId}`, l])).values()];
  const rows = unique.map((listing) => evaluateListing(listing, game, profile)).sort((a, b) => b.score - a.score);
  const tier = (name) => rows.filter((row) => row.hard_ok && row.budget_tier === name);
  const primary = tier('primary');
  const expansion = primary.length ? [] : rows.filter((row) => row.hard_ok && ['flex', 'below_budget', 'above_budget'].includes(row.budget_tier))
    .sort((a, b) => (a.price_cny ?? Infinity) - (b.price_cny ?? Infinity));
  return {
    game: game.game,
    persistence_scope: 'run_only',
    data_freshness: freshness && { status: freshness.status, max_confidence: freshness.max_confidence, snapshot_date: freshness.snapshot_date, reasons: freshness.reasons },
    counts: { input: listings.length, unique: rows.length, primary: primary.length },
    primary: primary.slice(0, top),
    flex: tier('flex').slice(0, top),
    budget_expansion: profile.budget_expansion?.enabled === false ? [] : expansion.slice(0, top),
    near_matches: rows.filter((row) => !row.hard_ok && ['primary', 'flex'].includes(row.budget_tier)).slice(0, top),
    by_site: Object.fromEntries(['pxb7', 'pzds'].map((site) => [site, rows.filter((row) => row.site === site && row.hard_ok).slice(0, top)])),
  };
}

function cell(value) {
  return String(value ?? '未披露').replace(/\|/g, '/').replace(/\n/g, ' ');
}

export function renderMarkdown(result) {
  const table = (rows) => rows.length ? [
    '| 平台 | 价格 | 评分 | 亮点 | 风险/缺失 | 上架 | 验号 | 链接 |', '| --- | ---: | ---: | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.site} | ${r.price_cny ?? '未披露'} | ${r.score} | ${cell(r.highlights.join('；'))} | ${cell([...r.risk_negative, ...r.missing_required.map((m) => `缺${m}`), ...r.missing_fields.map((m) => `${m}未披露`)].join('；') || '—')} | ${cell(r.published_at)} | ${cell(r.platform_verified_at)} | ${r.url ?? ''} |`),
  ].join('\n') : '（无）';
  const fresh = result.data_freshness;
  const banner = fresh && fresh.status !== 'fresh'
    ? [`> 数据新鲜度：${fresh.status}（快照 ${fresh.snapshot_date ?? '未标日期'}），推荐置信最高 ${fresh.max_confidence}。${fresh.reasons.join('；')}`]
    : [];
  return [
    ...banner,
    `## 预算内满足硬条件（${result.primary.length}）`, table(result.primary),
    '## 弹性预算', table(result.flex),
    ...(result.budget_expansion.length ? ['## 预算外最便宜的满足项', table(result.budget_expansion)] : []),
    '## 近似项（未满足硬条件）', table(result.near_matches),
    ...Object.entries(result.by_site).map(([site, rows]) => `## ${site} 候选\n${table(rows)}`),
  ].join('\n\n');
}

function listingsFrom(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : data.data ? [data.data] : data.listings ?? [];
  return rows.flatMap((row) => (row?.data ? [].concat(row.data) : [row]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const files = args.flatMap((arg, i) => (args[i - 1] === '--listings' ? [arg] : []));
  if (args.includes('--help') || !value('--profile') || !files.length) {
    console.log('Usage: shortlist.mjs --profile profile.json --listings query.json [--listings ...] [--game slug] [--top 5] [--markdown]');
    process.exit(args.includes('--help') ? 0 : 2);
  }
  const profile = JSON.parse(fs.readFileSync(value('--profile'), 'utf8'));
  const slug = value('--game') ?? resolveGame(profile.source_text ?? '');
  if (!slug) { console.error('Unknown game: pass --game <slug> matching references/games/<slug>/'); process.exit(2); }
  const result = shortlist(files.flatMap(listingsFrom), loadGame(slug), profile, { top: Number(value('--top') ?? 5), freshness: checkFreshness(slug) });
  console.log(args.includes('--markdown') ? renderMarkdown(result) : JSON.stringify(result, null, 2));
}
