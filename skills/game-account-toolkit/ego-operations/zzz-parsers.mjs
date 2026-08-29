import {
  cleanText,
  cleanWEngineName,
  normalizeAgentName,
  parseTitleAgent,
  parseWEngineNamesFromText,
} from './zzz-title-parser.mjs';

const VOID_HUNTERS = [
  { names: ['星见雅', '雅'] },
  { names: ['仪玄'] },
  { names: ['叶瞬光'] },
  { names: ['蕾米埃尔'] },
];

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text ?? '').match(pattern);
    if (match) return cleanText(match[1] ?? match[0]);
  }
  return '';
}

function numberMatch(text, patterns) {
  const value = firstMatch(text, patterns);
  if (!value) return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function tokenMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text ?? '').match(pattern);
    if (match) return cleanText(match[0]);
  }
  return '';
}

function scopedTokenMatch(scopes, patterns) {
  for (const scope of scopes) {
    const value = tokenMatch(scope, patterns);
    if (value) return value;
  }
  return '';
}

function parseStatusToken(value) {
  const text = cleanText(value);
  const explicit = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (explicit) {
    const dupes = Number(explicit[1]);
    const signatureEngine = Number(explicit[2]);
    return { status: `${dupes}+${signatureEngine}`, dupes, signatureEngine, hasSignatureEngine: signatureEngine > 0 };
  }
  const single = text.match(/(?:^|\s)(\d+)(?=\s|Lv\.|$)/);
  if (!single) return null;
  return { status: String(Number(single[1])), dupes: Number(single[1]), signatureEngine: null, hasSignatureEngine: false };
}

function parseCardStatuses(cards) {
  const byName = new Map();
  for (const card of cards ?? []) {
    const section = cleanText(card.section);
    if (section && !/S级(?:角色|代理人)/.test(section)) continue;
    const lines = String(card.text ?? '').split(/\n+/).map(cleanText).filter(Boolean);
    const statusIndex = lines.findIndex((line) => /^\d+(?:\s*\+\s*\d+)?$/.test(line));
    const levelIndex = lines.findIndex((line) => /^Lv\.\s*\d+/i.test(line));
    if (statusIndex === -1 || levelIndex === -1) continue;
    const name = normalizeAgentName(lines.slice(levelIndex + 1).find((line) => !/^\d+(?:\s*\+\s*\d+)?$/.test(line) && !/^Lv\./i.test(line) && !/^S级/.test(line)));
    const parsed = parseStatusToken(lines[statusIndex]);
    if (!name || !parsed || byName.has(name)) continue;
    byName.set(name, { name, ...parsed, level: Number(lines[levelIndex].match(/Lv\.\s*(\d+)/i)?.[1]) || null, source: 'asset_card_dom' });
  }
  return [...byName.values()];
}

function parseAgentStatuses(nodes, text, cards = []) {
  const byName = new Map(parseCardStatuses(cards).map((item) => [item.name, item]));
  for (const item of nodes ?? []) {
    const name = normalizeAgentName(item.title);
    if (!name || byName.has(name)) continue;
    const parsed = parseStatusToken(item.text);
    if (parsed) byName.set(name, { name, ...parsed, source: 'asset_dom' });
  }
  const titleBlock = firstMatch(cleanText(text), [/(?:\d+个S级代理人|S级代理人)[：:]([^；\n]+)/]);
  for (const part of titleBlock.split(/[，,、]/)) {
    const item = parseTitleAgent(part);
    if (!item || byName.has(item.name)) continue;
    byName.set(item.name, { name: item.name, status: String(item.dupes), dupes: item.dupes, signatureEngine: null, hasSignatureEngine: false, source: 'title_text' });
  }
  return [...byName.values()];
}

function parseWEngines(nodes, text, cards = []) {
  const candidates = [...parseWEngineNamesFromText(text), ...parseWEngineNamesFromText((nodes ?? []).map((item) => `${item.title}\n${item.text}`).join('\n'))];
  for (const card of cards ?? []) {
    const section = cleanText(card.section);
    if (section && !/S级(?:音擎|武器)/.test(section)) continue;
    const lines = String(card.text ?? '').split(/\n+/).map(cleanText).filter(Boolean);
    const name = cleanWEngineName(lines.find((line) => !/^\d+(?:\s*\+\s*\d+)?$/.test(line) && !/^Lv\./i.test(line) && !/^S级/.test(line)));
    if (name) candidates.push(name);
  }
  const seen = new Set();
  return candidates.filter((name) => {
    const key = name.toLowerCase().replace(/\s+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusForAgent(statuses, names, text) {
  const row = statuses.find((item) => names.some((name) => item.name === name || item.name.includes(name)));
  if (row) return row.status || 'present';
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const asset = firstMatch(text, [new RegExp(`(?:^|\\n)(\\d+\\s*(?:\\+\\s*\\d+)?)\\s*\\n\\s*Lv\\.\\s*\\d+\\s*\\n\\s*${escaped}(?=\\n|$)`)]).replace(/\s+/g, '');
    if (asset) return asset;
    const mindscape = firstMatch(text, [new RegExp(`(\\d+)命${escaped}`)]);
    if (mindscape) return `${mindscape}命`;
    if (new RegExp(`满命${escaped}`).test(text)) return '6命';
  }
  return 'missing';
}

function formatStatuses(statuses) {
  return Object.fromEntries(statuses.map((item) => [item.name, item.status || 'present']));
}

function parsePxb7(raw) {
  const primaryText = cleanText(raw.primaryText || raw.primaryTitleText || raw.text).replace(/\n+/g, '\n');
  const title = cleanText(raw.primaryTitleText)
    || firstMatch(primaryText, [/(【[A-Z0-9]+】[^\n]+)/i, /\b([A-Z]{2,}[A-Z0-9]+[^\n]+)/i])
    || cleanText(raw.title);
  const statuses = parseAgentStatuses(raw.titleNodes, title, raw.agentCards);
  const engines = parseWEngines(raw.titleNodes, title, raw.wEngineCards);
  const listingId = firstMatch(`${title}\n${raw.title}`, [/【([^】]+)】/, /\b([A-Z]{2,}[A-Z0-9]+)\b/i]);
  const polychromeText = primaryText.replace(/菲林底片[:：]?\s*\d+/g, '');
  const primaryDetailText = [title, raw.title].filter(Boolean).join('\n');
  return {
    listingId,
    priceCny: numberMatch(primaryText, [/￥\s*([0-9][0-9,]*(?:\.\d+)?)/]),
    title,
    binding: {
      server: scopedTokenMatch([primaryDetailText, primaryText], [/国际服/, /國際服/, /米哈游官服/, /B服/, /渠道服/]),
      region: scopedTokenMatch([primaryDetailText, primaryText], [/亚服/, /亞服/, /美服/, /欧服/, /歐服/, /台港澳服/]),
      email: scopedTokenMatch([primaryText, primaryDetailText], [/邮箱未实名出售/, /邮箱实名出售/, /邮箱未绑定/, /邮箱不出售/, /邮箱绑定/, /网易邮箱/, /QQ邮箱/, /字母Q邮箱/]),
      tap: scopedTokenMatch([primaryDetailText, primaryText], [/未绑定TAP/, /已绑定TAP/, /TAP绑定情况\s*未绑定TAP?/, /TAP绑定情况\s*已绑定TAP?/]),
      psn: scopedTokenMatch([primaryDetailText, primaryText], [/未绑定PSN/, /已绑定PSN/, /PSN绑定情况\s*未绑定PSN?/, /PSN绑定情况\s*已绑定PSN?/]),
      changeCode: scopedTokenMatch([primaryDetailText, primaryText], [/提供换绑码/, /不提供换绑码/]),
    },
    resources: {
      level: numberMatch(primaryText, [/(\d+)\s*级/]), yellowCount: numberMatch(primaryText, [/黄数\s*(\d+)/, /(\d+)\s*黄/]),
      polychrome: numberMatch(polychromeText, [/菲林[:：]?\s*(\d+)/]), filmTape: numberMatch(primaryText, [/菲林底片[:：]?\s*(\d+)/]),
      encryptedMasterTape: numberMatch(primaryText, [/加密母带[:：]?\s*(\d+)/]),
    },
    counts: {
      sAgents: numberMatch(primaryText, [/(\d+)个S级代理人/, /S级角色\s*\n?\s*(\d+)\s*\/\s*\d+/, /S级代理人\s*[：:]?\s*(\d+)/]) ?? statuses.length,
      sWEngines: numberMatch(primaryText, [/S级音擎\s*[：:]?\s*(\d+)/, /(\d+)个S级音擎/]) ?? engines.length,
      sBangboo: numberMatch(primaryText, [/S级邦布\s*[：:]?\s*(\d+)/, /(\d+)个S级邦布/]),
      skins: firstMatch(primaryText, [/时装[：:]([^；\n]+)/]),
    },
    sWEngineNames: engines,
    agentStatuses: formatStatuses(statuses),
    voidHunters: VOID_HUNTERS.map((item) => `${item.names[0]}:${statusForAgent(statuses, item.names, title)}`).join('; '),
    highlights: firstMatch(primaryText, [/商品亮点\s*x\d+\s*([^\n]+(?:\n[^\n]+){0,4})/]).replace(/\n/g, '; '),
    sellerNote: firstMatch(primaryText, [/卖家说\s*\*?卖家自主行为[^\n]*\n([^\n]+)/, /卖家说\s*([^\n]+)/]),
    listedAtRaw: firstMatch(primaryText, [/(\d+小时内发布)/, /(\d+天内发布)/, /(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?)/]),
    verifiedAt: firstMatch(primaryText, [/该账号于(\d{4}年\d{2}月\d{2}日)完成验号/]),
    url: raw.url,
  };
}

function parsePzds(raw) {
  const text = cleanText(raw.text).replace(/\n+/g, '\n');
  const nodes = Array.isArray(raw.titleNodes) ? raw.titleNodes : [];
  const statuses = parseAgentStatuses(nodes, text);
  const engines = parseWEngines(nodes, text);
  const listingId = firstMatch(`${raw.title}\n${text}`, [/账号编号([A-Z0-9]+)/, /商品编号\s*([A-Z0-9]+)/, /\b([A-Z0-9]{5,8})\s+号/]);
  const title = firstMatch(text, [new RegExp(`${listingId || '[A-Z0-9]+'}\\s+号\\s+([^\\n]+)`), /绝区零-[^\n]+账号编号[^\n]+出售/]) || cleanText(raw.title);
  const polychromeText = text.replace(/菲林底片\s*\n?\s*\d+/g, '');
  return {
    listingId,
    priceCny: numberMatch(text, [/¥\s*\n?\s*([0-9][0-9,]*(?:\.\d+)?)/]),
    title,
    binding: {
      server: tokenMatch(text, [/米哈游官服/, /B服/, /渠道服/]),
      email: tokenMatch(text, [/邮箱未绑定/, /邮箱已绑定/, /邮箱绑定/]),
      tap: tokenMatch(text, [/未绑定TAP/, /已绑定TAP/, /是否绑定Tap\s*\n?\s*未绑定/, /是否绑定Tap\s*\n?\s*已绑定/]),
      psn: tokenMatch(text, [/未绑定PSN/, /已绑定PSN/, /是否绑定PSN\s*\n?\s*未绑定/, /是否绑定PSN\s*\n?\s*已绑定/]),
      changeCode: tokenMatch(text, [/提供换绑码/, /能否提供换绑码\s*\n?\s*能/, /不能提供换绑码/]),
    },
    resources: {
      level: numberMatch(text, [/(\d+)级/]), yellowCount: numberMatch(text, [/黄数\s*\n?\s*(\d+)/, /(\d+)黄/]),
      polychrome: numberMatch(polychromeText, [/菲林\s*\n?\s*(\d+)/]), filmTape: numberMatch(text, [/菲林底片\s*\n?\s*(\d+)/]),
      encryptedMasterTape: numberMatch(text, [/加密母带\s*\n?\s*(\d+)/]),
    },
    counts: {
      sAgents: numberMatch(text, [/S代理人\s*\n?\s*(\d+)/, /(\d+)个S级代理人/]),
      sWEngines: numberMatch(text, [/(\d+)个S级音擎/]), sBangboo: numberMatch(text, [/(\d+)个S级邦布/]),
      skins: firstMatch(text, [/(\d+时装)/, /时装[：:]([^，。\n]+)/]),
    },
    sWEngineNames: engines,
    agentStatuses: formatStatuses(statuses),
    voidHunters: ['叶瞬光', '星见雅', '仪玄', '蕾米埃尔'].map((name) => `${name}:${statusForAgent(statuses, [name], text)}`).join('; '),
    sellerNote: firstMatch(text, [/卖家\s*\n留言\s*\n([^\n]+)/, /卖家 留言\s*([^\n]+)/]),
    listedAt: firstMatch(text, [/上架时间\s*\n?\s*([^\n]+)/]),
    url: raw.url,
  };
}

export function parseZzzOperation(operation, raw) {
  if (operation === 'pxb7/zzz-detail') return [parsePxb7(raw)];
  if (operation === 'pzds/zzz-detail') return [parsePzds(raw)];
  throw new Error(`Unsupported ZZZ operation: ${operation}`);
}
