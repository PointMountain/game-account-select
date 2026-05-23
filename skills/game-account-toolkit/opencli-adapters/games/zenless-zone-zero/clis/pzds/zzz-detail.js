import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pzds.com';
const VOID_HUNTERS = ['叶瞬光', '星见雅', '仪玄'];

function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function cleanWEngineName(value) {
  return cleanText(value)
    .replace(/^(?:精\s*\d+|精炼\s*\d+|精煉\s*\d+|Lv\.?\s*\d+)\s*/i, '')
    .replace(/^(?:S级音擎|S級音擎|S级武器|S級武器|音擎)\s*[：:]?\s*/i, '')
    .replace(/[。；;，,、]+$/g, '')
    .trim();
}

function normalizeUrl(input) {
  const raw = cleanText(input);
  if (!raw) throw new CliError('INVALID_ARGUMENT', 'pzds zzz-detail requires a goods detail URL or listing id');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[A-Za-z0-9]+$/.test(raw)) return `https://${HOST}/goodsDetails/${raw}/6`;
  throw new CliError('INVALID_ARGUMENT', `Unsupported pzds zzz-detail input: ${raw}`);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
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
    const match = text.match(pattern);
    if (match) return cleanText(match[0]);
  }
  return '';
}

function parseStatusToken(value) {
  const text = cleanText(value);
  const explicit = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (explicit) {
    const dupes = Number(explicit[1]);
    const signatureEngine = Number(explicit[2]);
    return {
      status: `${dupes}+${signatureEngine}`,
      dupes,
      signatureEngine,
      hasSignatureEngine: signatureEngine > 0,
    };
  }

  const single = text.match(/(?:^|\s)(\d+)(?=\s|$)/);
  if (single) {
    const dupes = Number(single[1]);
    return {
      status: String(dupes),
      dupes,
      signatureEngine: null,
      hasSignatureEngine: false,
    };
  }

  return null;
}

function parseAgentStatuses(nodes) {
  const byName = new Map();
  for (const item of nodes) {
    const name = cleanText(item.title);
    if (!name || byName.has(name)) continue;
    const text = cleanText(item.text);
    const parsed = parseStatusToken(text);
    if (!parsed) continue;
    byName.set(name, {
      name,
      ...parsed,
      raw: text,
      source: 'asset_dom',
    });
  }
  return Array.from(byName.values());
}

function parseWEngineNamesFromText(text) {
  const names = [];
  const raw = String(text ?? '');
  for (const match of raw.matchAll(/(?:\d+\s*个)?S级(?:音擎|武器)[：:]\s*([^；;\n]+)/g)) {
    for (const part of String(match[1] ?? '').split(/[，,、；;|/]/)) {
      const name = cleanWEngineName(part);
      if (name && !/^\d+(?:\s*\/\s*\d+)?$/.test(name)) names.push(name);
    }
  }
  return names;
}

function parseWEngineNames(nodes, text) {
  const candidates = [
    ...parseWEngineNamesFromText(text),
    ...parseWEngineNamesFromText(nodes.map((item) => `${item.title}\n${item.text}`).join('\n')),
  ];

  for (const item of nodes) {
    const nodeText = cleanText(`${item.title}\n${item.text}`);
    if (!/S级(?:音擎|武器)|音擎/.test(nodeText)) continue;
    const name = cleanWEngineName(item.title);
    if (name && !/S级(?:代理人|角色|邦布)|账号|商品|绝区零/.test(name)) candidates.push(name);
  }

  const seen = new Set();
  return candidates.filter((name) => {
    const key = name.toLowerCase().replace(/\s+/g, '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAssetStatus(agentStatuses, name) {
  const node = agentStatuses.find((item) => item.name === name);
  return node?.status || '';
}

function formatAgentStatuses(agentStatuses) {
  return Object.fromEntries(agentStatuses.map((item) => [item.name, item.status || 'present']));
}

function parseLabelValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return firstMatch(text, [new RegExp(`${escaped}\\s*\\n?\\s*([^\\n]+)`)]);
}

function parseDetail(raw) {
  const text = cleanText(raw.text).replace(/\n+/g, '\n');
  const nodes = Array.isArray(raw.titleNodes) ? raw.titleNodes : [];
  const agentStatusRows = parseAgentStatuses(nodes);
  const sWEngineNames = parseWEngineNames(nodes, text);
  const listingId = firstMatch(`${raw.title}\n${text}`, [/账号编号([A-Z0-9]+)/, /商品编号\s*([A-Z0-9]+)/, /\b([A-Z0-9]{5,8})\s+号/]);
  const title = firstMatch(text, [new RegExp(`${listingId ? listingId : '[A-Z0-9]+'}\\s+号\\s+([^\\n]+)`), /绝区零-[^\n]+账号编号[^\n]+出售/]) || cleanText(raw.title);
  const polychromeText = text.replace(/菲林底片\s*\n?\s*\d+/g, '');
  const voidHunters = VOID_HUNTERS.map((name) => `${name}:${parseAssetStatus(agentStatusRows, name) || (text.includes(name) ? 'present' : 'missing')}`).join('; ');

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
      level: numberMatch(text, [/(\d+)级/]),
      yellowCount: numberMatch(text, [/黄数\s*\n?\s*(\d+)/, /(\d+)黄/]),
      polychrome: numberMatch(polychromeText, [/菲林\s*\n?\s*(\d+)/]),
      filmTape: numberMatch(text, [/菲林底片\s*\n?\s*(\d+)/]),
      encryptedMasterTape: numberMatch(text, [/加密母带\s*\n?\s*(\d+)/]),
    },
    counts: {
      sAgents: numberMatch(text, [/S代理人\s*\n?\s*(\d+)/, /(\d+)个S级代理人/]),
      sWEngines: numberMatch(text, [/(\d+)个S级音擎/]),
      sBangboo: numberMatch(text, [/(\d+)个S级邦布/]),
      skins: firstMatch(text, [/(\d+时装)/, /时装[：:]([^，。\n]+)/]),
    },
    sWEngineNames,
    agentStatuses: formatAgentStatuses(agentStatusRows),
    voidHunters,
    sellerNote: firstMatch(text, [/卖家\s*\n留言\s*\n([^\n]+)/, /卖家 留言\s*([^\n]+)/]),
    listedAt: parseLabelValue(text, '上架时间'),
    url: raw.url,
  };
}

cli({
  site: 'pzds',
  name: 'zzz-detail',
  description: '盼之代售账号详情页字段抽取（价格、绑定状态、ZZZ 虚狩关键资产）',
  access: 'read',
  example: 'opencli pzds zzz-detail QL9CHD -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'input', type: 'string', required: true, positional: true, help: 'PZDS 商品详情 URL 或商品编号，如 QL9CHD' },
    { name: 'wait', type: 'int', default: 3, help: '页面加载等待秒数' },
  ],
  columns: [
    'listingId', 'priceCny', 'title', 'binding', 'resources', 'counts',
    'sWEngineNames', 'agentStatuses', 'voidHunters', 'sellerNote', 'listedAt', 'url',
  ],
  func: async (page, kwargs) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pzds zzz-detail');
    const url = normalizeUrl(kwargs.input);
    const waitSeconds = Math.max(1, Math.min(Number(kwargs.wait) || 3, 10));
    await page.goto(url, { waitUntil: 'load', settleMs: 2000 });
    await page.wait(waitSeconds);

    const raw = await page.evaluate(`(() => ({
      url: location.href,
      title: document.title || '',
      text: document.body ? document.body.innerText || '' : '',
      titleNodes: Array.from(document.querySelectorAll('[title]')).map((el) => ({
        title: el.getAttribute('title') || '',
        text: el.innerText || '',
      })),
    }))()`);

    if (/验证|滑块|访问过于频繁|安全校验/.test(raw.text || '') && !/商品编号|账号编号|S代理人/.test(raw.text || '')) {
      throw new CliError('ANTI_BOT', 'pzds returned an anti-bot or verification page in the connected browser');
    }

    const row = parseDetail(raw);
    if (!row.listingId || !row.priceCny) {
      throw new CliError('NO_DATA', `Could not parse pzds product detail from ${url}`);
    }
    return [row];
  },
});
