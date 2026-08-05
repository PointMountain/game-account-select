import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pxb7.com';
const LIST_URL = 'https://www.pxb7.com/buy/10053/1?keyword=%E6%98%8E%E6%97%A5%E6%96%B9%E8%88%9F&searchType=%E8%87%AA%E7%84%B6%E6%90%9C%E7%B4%A2';
const API_URL = 'https://api-pc.pxb7.com/api/search/product/v2/selectSearchPageList';

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function numberMatch(text, pattern) {
  const match = String(text ?? '').match(pattern);
  if (!match) return null;
  const value = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function section(text, label, nextLabels) {
  const tail = nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`${label}[：:]([\\s\\S]*?)(?=；(?:${tail})[：:]|；【|$)`);
  const match = String(text ?? '').match(pattern);
  if (!match) return [];
  return match[1].split(/[，,、]/).map(clean).filter(Boolean);
}

function parseSummary(text) {
  const value = clean(text);
  const next = ['精一六星', '六星干员', '联动干员', '时装'];
  return {
    counts: {
      level: numberMatch(value, /(\d+)级/),
      sixStar: numberMatch(value, /(\d+)六星/),
      elite2: numberMatch(value, /(\d+)精二/),
      elite1: numberMatch(value, /(\d+)精一/),
      collab: numberMatch(value, /联动干员数量[：:]\s*(\d+)/),
      skins: numberMatch(value, /时装数量[：:]\s*(\d+)/),
    },
    resources: {
      orundum: numberMatch(value, /合成玉数量[：:]\s*(\d+)/),
      originitePrime: numberMatch(value, /源石数量[：:]\s*(\d+)/),
    },
    operators: {
      elite2: section(value, '精二六星', next),
      elite1: section(value, '精一六星', ['六星干员', '联动干员', '时装']),
      sixStar: section(value, '六星干员', ['联动干员', '时装']),
      collab: section(value, '联动干员', ['时装']),
    },
    skins: section(value, '时装', []),
  };
}

function normalizeItem(item, rank) {
  const parsed = parseSummary(item.showTitle);
  const tags = Array.isArray(item.attrNameList) ? item.attrNameList.map(clean).filter(Boolean) : [];
  const serverTag = tags.find((tag) => /官方账号|B服|渠道服/.test(tag)) ?? null;
  const server = /官方账号|官服/.test(serverTag ?? '')
    ? '官服'
    : /B服/i.test(serverTag ?? '') ? 'B服'
      : /渠道服/.test(serverTag ?? '') ? '渠道服' : serverTag;
  return {
    rank,
    listingId: String(item.productId ?? ''),
    priceCny: Number.isFinite(Number(item.price)) ? Number(item.price) / 100 : null,
    server,
    status: {
      guarantee: item.guarantee === 1,
      sourceStatus: parsed.operators.sixStar.length || parsed.operators.elite2.length ? 'success' : 'partial',
    },
    counts: parsed.counts,
    resources: parsed.resources,
    operatorNames: parsed.operators.sixStar,
    elite2OperatorNames: parsed.operators.elite2,
    collabOperatorNames: parsed.operators.collab,
    skins: parsed.skins,
    url: item.productId ? `https://${HOST}/product/${item.productId}/1` : null,
  };
}

cli({
  site: 'pxb7',
  name: 'arknights-list',
  description: '螃蟹明日方舟账号列表事实字段（动态价格区间、干员、资源与时装）',
  access: 'read',
  example: 'opencli pxb7 arknights-list --minPrice 800 --maxPrice 1200 --limit 20 -f json',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'minPrice', type: 'int', default: 0, help: '最低价格（CNY，0 表示不限制）' },
    { name: 'maxPrice', type: 'int', default: 0, help: '最高价格（CNY，0 表示不限制）' },
    { name: 'limit', type: 'int', default: 20, help: '返回数量（max 60）' },
    { name: 'page', type: 'int', default: 1, help: '起始页（从 1 开始）' },
    { name: 'sort', type: 'string', default: 'default', help: '当前批次排序：default / priceAsc / priceDesc' },
  ],
  columns: ['rank', 'listingId', 'priceCny', 'server', 'status', 'counts', 'resources', 'operatorNames', 'elite2OperatorNames', 'collabOperatorNames', 'skins', 'url'],
  func: async (page, args) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pxb7 arknights-list');
    const minPrice = Math.max(0, Number(args.minPrice) || 0);
    const maxPrice = Math.max(0, Number(args.maxPrice) || 0);
    if (minPrice && maxPrice && minPrice > maxPrice) throw new CliError('INVALID_ARGUMENT', 'minPrice cannot exceed maxPrice');
    const limit = Math.max(1, Math.min(Number(args.limit) || 20, 60));
    const startPage = Math.max(1, Number(args.page) || 1);
    const sort = String(args.sort ?? 'default');
    if (!['default', 'priceAsc', 'priceDesc'].includes(sort)) throw new CliError('INVALID_ARGUMENT', `Unknown sort "${sort}"`);

    await page.goto(LIST_URL, { waitUntil: 'load', settleMs: 1500 });
    const pages = Math.min(3, Math.ceil(limit / 20));
    const requestConfig = { apiUrl: API_URL, minPrice, maxPrice, limit, pages, startPage };
    const rawRows = await page.evaluate(`(async () => {
      const config = ${JSON.stringify(requestConfig)};
      const rows = [];
      let pageToken = null;
      for (let offset = 0; offset < config.pages && rows.length < config.limit; offset += 1) {
        const filterDTOList = [];
        if (config.minPrice || config.maxPrice) {
          filterDTOList.push({ attrId: 'price', attrType: 3, attrValList: [String(config.minPrice || 0), String(config.maxPrice || 99999999)] });
        }
        const payload = {
          query: '明日方舟', gameId: '10053', pageIndex: config.startPage + offset, pageSize: 20,
          bizProd: 1, type: '2', posType: 1, filterDTOList,
          ...(pageToken ? { pageToken } : {})
        };
        const response = await fetch(config.apiUrl, {
          method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Pxb7 list HTTP ' + response.status);
        const data = await response.json();
        const list = Array.isArray(data?.data?.list) ? data.data.list : [];
        if (!list.length) break;
        rows.push(...list);
        pageToken = data?.data?.properties?.pageToken ?? null;
      }
      return rows.slice(0, config.limit);
    })()`);
    const rows = (Array.isArray(rawRows) ? rawRows : []).map((item, index) => normalizeItem(item, index + 1));
    const uniqueRows = [...new Map(rows.map((row, index) => [row.listingId || row.url || `row-${index}`, row])).values()];
    if (!uniqueRows.length) throw new CliError('NO_DATA', 'Pxb7 returned no Arknights listings for this query');
    if (sort === 'priceAsc') uniqueRows.sort((a, b) => (a.priceCny ?? Infinity) - (b.priceCny ?? Infinity));
    if (sort === 'priceDesc') uniqueRows.sort((a, b) => (b.priceCny ?? -Infinity) - (a.priceCny ?? -Infinity));
    return uniqueRows.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
  },
});
