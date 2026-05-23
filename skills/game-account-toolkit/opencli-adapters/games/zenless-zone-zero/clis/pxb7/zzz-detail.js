import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pxb7.com';
const VOID_HUNTERS = [
  { key: 'miyabi', names: ['星见雅', '雅'] },
  { key: 'yixuan', names: ['仪玄'] },
  { key: 'yeshunguang', names: ['叶瞬光'] },
];

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

function normalizeAgentName(value) {
  const name = cleanText(value);
  return name === '雅' ? '星见雅' : name;
}

function normalizeUrl(input) {
  const raw = cleanText(input);
  if (!raw) throw new CliError('INVALID_ARGUMENT', 'pxb7 zzz-detail requires a product URL or numeric product id');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\d{10,}$/.test(raw)) return `https://${HOST}/product/${raw}/1`;
  throw new CliError('INVALID_ARGUMENT', `Unsupported pxb7 product input: ${raw}`);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanText(match[1] ?? match[0]);
  }
  return '';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    return {
      status: `${dupes}+${signatureEngine}`,
      dupes,
      signatureEngine,
      hasSignatureEngine: signatureEngine > 0,
    };
  }

  const single = text.match(/(?:^|\s)(\d+)(?=\s|Lv\.|$)/);
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

function parseAgentCardStatuses(cards) {
  const byName = new Map();
  for (const card of cards) {
    const section = cleanText(card.section);
    if (section && !/S级(?:角色|代理人)/.test(section)) continue;

    const lines = String(card.text ?? '').split(/\n+/).map(cleanText).filter(Boolean);
    const statusIndex = lines.findIndex((line) => /^\d+(?:\s*\+\s*\d+)?$/.test(line));
    const levelIndex = lines.findIndex((line) => /^Lv\.\s*\d+/i.test(line));
    if (statusIndex === -1 || levelIndex === -1) continue;

    const nameLine = lines.slice(levelIndex + 1).find((line) => (
      !/^\d+(?:\s*\+\s*\d+)?$/.test(line)
      && !/^Lv\.\s*\d+/i.test(line)
      && !/^S级/.test(line)
    ));
    const name = normalizeAgentName(nameLine);
    const parsed = parseStatusToken(lines[statusIndex]);
    if (!name || !parsed || byName.has(name)) continue;

    byName.set(name, {
      name,
      ...parsed,
      level: Number((lines[levelIndex].match(/Lv\.\s*(\d+)/i) || [])[1]) || null,
      raw: lines.join('\n'),
      source: 'asset_card_dom',
    });
  }
  return Array.from(byName.values());
}

function parseAgentStatuses(nodes, text, cards = []) {
  const byName = new Map();

  for (const item of parseAgentCardStatuses(cards)) {
    byName.set(item.name, item);
  }

  for (const item of nodes) {
    const name = normalizeAgentName(item.title);
    if (!name || byName.has(name)) continue;
    const nodeText = cleanText(item.text);
    const parsed = parseStatusToken(nodeText);
    if (!parsed) continue;
    byName.set(name, {
      name,
      ...parsed,
      raw: nodeText,
      source: 'asset_dom',
    });
  }

  const titleText = cleanText(text);
  const titleAgentBlock = firstMatch(titleText, [
    /(?:\d+个S级代理人|S级代理人)[：:]([^；\n]+)/,
  ]);
  if (titleAgentBlock) {
    for (const part of titleAgentBlock.split(/[，,、]/)) {
      const item = cleanText(part);
      if (!item) continue;
      const named = item.match(/^(?:(\d+)命)?(.+)$/);
      if (!named) continue;
      const name = normalizeAgentName(named[2]);
      if (!name || byName.has(name)) continue;
      const dupes = named[1] == null ? 0 : Number(named[1]);
      byName.set(name, {
        name,
        status: String(dupes),
        dupes,
        signatureEngine: null,
        hasSignatureEngine: false,
        raw: item,
        source: 'title_text',
      });
    }
  }

  return Array.from(byName.values());
}

function parseWEngineNamesFromText(text) {
  const blocks = [];
  const raw = String(text ?? '');
  for (const match of raw.matchAll(/(?:(\d+)\s*个)?S级(?:音擎|武器)[：:]\s*([^；;\n]+)/g)) {
    const names = [];
    for (const part of String(match[2] ?? '').split(/[，,、；;|/]/)) {
      const name = cleanWEngineName(part);
      if (name) names.push(name);
    }
    if (names.length) blocks.push({ hasCount: match[1] != null, names });
  }
  const countedBlock = blocks.find((block) => block.hasCount);
  return countedBlock ? countedBlock.names : blocks.flatMap((block) => block.names);
}

function parseWEngineNames(nodes, text, cards = []) {
  const uniqueNames = (candidates) => {
    const seen = new Set();
    return candidates.filter((name) => {
      const key = name.toLowerCase().replace(/\s+/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const textNames = uniqueNames(parseWEngineNamesFromText(text));
  if (textNames.length) return textNames;

  const candidates = parseWEngineNamesFromText(nodes.map((item) => `${item.title}\n${item.text}`).join('\n'));

  for (const card of cards) {
    const section = cleanText(card.section);
    if (section && !/S级(?:音擎|武器)/.test(section)) continue;
    const lines = String(card.text ?? '').split(/\n+/).map(cleanText).filter(Boolean);
    const nameLine = lines.find((line) => (
      !/^\d+(?:\s*\+\s*\d+)?$/.test(line)
      && !/^Lv\.\s*\d+/i.test(line)
      && !/^S级/.test(line)
    ));
    const name = cleanWEngineName(nameLine);
    if (name) candidates.push(name);
  }

  return uniqueNames(candidates);
}

function statusForAgent(agentStatuses, names, text) {
  const node = agentStatuses.find((item) => names.some((name) => item.name === name || item.name.includes(name)));
  if (node) return node.status || 'present';
  const assetStatus = firstMatch(text, names.map((name) => {
    const escaped = escapeRegExp(name);
    return new RegExp(`(?:^|\\n)(\\d+\\s*(?:\\+\\s*\\d+)?)\\s*\\n\\s*Lv\\.\\s*\\d+\\s*\\n\\s*${escaped}(?=\\n|$)`);
  })).replace(/\s+/g, '');
  if (assetStatus) return assetStatus;
  const titleStatus = firstMatch(text, names.map((name) => new RegExp(`(\\d+)命${escapeRegExp(name)}`)));
  return titleStatus ? `${titleStatus}命` : '';
}

function parseVoidHunters(agentStatuses, text) {
  return VOID_HUNTERS.map((target) => {
    const status = statusForAgent(agentStatuses, target.names, text);
    const label = target.names[0];
    return `${label}:${status || 'present'}`;
  }).join('; ');
}

function formatAgentStatuses(agentStatuses) {
  return Object.fromEntries(agentStatuses.map((item) => [item.name, item.status || 'present']));
}

function parseDetail(raw) {
  const text = cleanText(raw.text).replace(/\n+/g, '\n');
  const nodes = Array.isArray(raw.titleNodes) ? raw.titleNodes : [];
  const cards = Array.isArray(raw.agentCards) ? raw.agentCards : [];
  const agentStatusRows = parseAgentStatuses(nodes, text, cards);
  const sWEngineNames = parseWEngineNames(nodes, text, raw.wEngineCards ?? []);
  const title = firstMatch(text, [/(【JHYXJ[^】]+】[^\n]+)/, /(JHYXJ[A-Z0-9]+[^\n]+)/]) || cleanText(raw.title);
  const listingId = firstMatch(`${raw.title}\n${text}`, [/【([^】]+)】/, /\b(JHYXJ[A-Z0-9]+)\b/i]);
  const polychromeText = text.replace(/菲林底片[:：]?\s*\d+/g, '');
  const detailPhotoTags = Array.from(title.matchAll(/【([^】]+)】/g)).map((match) => match[0]).join(' ');
  const primaryDetailText = [title, detailPhotoTags, raw.title].filter(Boolean).join('\n');

  return {
    listingId,
    priceCny: numberMatch(text, [/￥\s*([0-9][0-9,]*(?:\.\d+)?)/]),
    title,
    binding: {
      server: scopedTokenMatch([primaryDetailText, text], [/米哈游官服/, /B服/, /渠道服/]),
      email: scopedTokenMatch([primaryDetailText, text], [/邮箱未实名出售/, /邮箱实名出售/, /邮箱未绑定/, /邮箱不出售/, /邮箱绑定/, /网易邮箱/, /QQ邮箱/]),
      tap: scopedTokenMatch([primaryDetailText, text], [/未绑定TAP/, /已绑定TAP/, /TAP绑定情况\s*未绑定TAP?/, /TAP绑定情况\s*已绑定TAP?/]),
      psn: scopedTokenMatch([primaryDetailText, text], [/未绑定PSN/, /已绑定PSN/, /PSN绑定情况\s*未绑定PSN?/, /PSN绑定情况\s*已绑定PSN?/]),
      changeCode: scopedTokenMatch([primaryDetailText, text], [/提供换绑码/, /不提供换绑码/]),
    },
    resources: {
      level: numberMatch(text, [/(\d+)\s*级/]),
      yellowCount: numberMatch(text, [/黄数\s*(\d+)/, /(\d+)\s*黄/]),
      polychrome: numberMatch(polychromeText, [/菲林[:：]?\s*(\d+)/]),
      filmTape: numberMatch(text, [/菲林底片[:：]?\s*(\d+)/]),
      encryptedMasterTape: numberMatch(text, [/加密母带[:：]?\s*(\d+)/]),
    },
    counts: {
      sAgents: numberMatch(text, [/(\d+)个S级代理人/, /S级角色\s*\n?\s*(\d+)\s*\/\s*\d+/, /S级代理人\s*[：:]?\s*(\d+)/]),
      sWEngines: numberMatch(text, [/S级音擎\s*[：:]?\s*(\d+)/, /(\d+)个S级音擎/]),
      sBangboo: numberMatch(text, [/S级邦布\s*[：:]?\s*(\d+)/, /(\d+)个S级邦布/]),
      skins: firstMatch(text, [/时装[：:]([^；\n]+)/]),
    },
    sWEngineNames,
    agentStatuses: formatAgentStatuses(agentStatusRows),
    voidHunters: parseVoidHunters(agentStatusRows, text),
    highlights: firstMatch(text, [/商品亮点\s*x\d+\s*([^\n]+(?:\n[^\n]+){0,4})/]).replace(/\n/g, '; '),
    sellerNote: firstMatch(text, [/卖家说\s*\*?卖家自主行为[^\n]*\n([^\n]+)/, /卖家说\s*([^\n]+)/]),
    verifiedAt: firstMatch(text, [/该账号于(\d{4}年\d{2}月\d{2}日)完成验号/]),
    url: raw.url,
  };
}

cli({
  site: 'pxb7',
  name: 'zzz-detail',
  description: '螃蟹游戏服务网账号详情页字段抽取（价格、绑定状态、ZZZ 虚狩关键资产）',
  access: 'read',
  example: 'opencli pxb7 zzz-detail https://www.pxb7.com/product/2187082765844721999/1 -f yaml',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'input', type: 'string', required: true, positional: true, help: 'pxb7 商品详情 URL 或数字商品 ID' },
    { name: 'wait', type: 'int', default: 3, help: '页面加载等待秒数' },
  ],
  columns: [
    'listingId', 'priceCny', 'title', 'binding', 'resources', 'counts',
    'sWEngineNames', 'agentStatuses', 'voidHunters', 'highlights', 'sellerNote', 'verifiedAt', 'url',
  ],
  func: async (page, kwargs) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pxb7 zzz-detail');
    const url = normalizeUrl(kwargs.input);
    const waitSeconds = Math.max(1, Math.min(Number(kwargs.wait) || 3, 10));
    await page.goto(url, { waitUntil: 'load', settleMs: 2000 });
    await page.wait(waitSeconds);
    await page.evaluate(`(() => {
      const assetSection = Array.from(document.querySelectorAll('.ReportCharacter, *')).find((el) => /S级(?:角色|代理人)/.test(el.innerText || ''));
      if (assetSection && assetSection.scrollIntoView) {
        assetSection.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo(0, Math.max(window.innerHeight, 600));
      }
      return true;
    })()`);
    await page.wait(1);

    const raw = await page.evaluate(`(() => ({
      url: location.href,
      title: document.title || '',
      text: document.body ? document.body.innerText || '' : '',
      titleNodes: Array.from(document.querySelectorAll('[title]')).map((el) => ({
        title: el.getAttribute('title') || '',
        text: el.innerText || '',
      })),
      agentCards: Array.from(document.querySelectorAll('.ReportCharacter')).flatMap((section) => {
        const sectionText = section.innerText || '';
        const sectionLabel = (sectionText.match(/S级(?:角色|代理人)|A级(?:角色|代理人)/) || [])[0] || '';
        return Array.from(section.querySelectorAll('[class*="cursor-pointer"]')).map((card) => ({
          section: sectionLabel,
          text: card.innerText || '',
        })).filter((card) => /^\\s*\\d+(?:\\s*\\+\\s*\\d+)?\\s*\\n\\s*Lv\\./.test(card.text));
      }),
      wEngineCards: Array.from(document.querySelectorAll('.ReportCharacter')).flatMap((section) => {
        const sectionText = section.innerText || '';
        const sectionLabel = (sectionText.match(/S级(?:音擎|武器)|A级(?:音擎|武器)/) || [])[0] || '';
        return Array.from(section.querySelectorAll('[class*="cursor-pointer"]')).map((card) => ({
          section: sectionLabel,
          text: card.innerText || '',
        })).filter((card) => sectionLabel && /S级(?:音擎|武器)/.test(sectionLabel));
      }),
    }))()`);

    if (/验证|滑块|访问过于频繁|安全校验/.test(raw.text || '') && !/JHYXJ|账号详情|商品亮点/.test(raw.text || '')) {
      throw new CliError('ANTI_BOT', 'pxb7 returned an anti-bot or verification page in the connected browser');
    }

    const row = parseDetail(raw);
    if (!row.listingId || !row.priceCny) {
      throw new CliError('NO_DATA', `Could not parse pxb7 product detail from ${url}`);
    }
    return [row];
  },
});
