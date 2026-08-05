import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pzds.com';
const LIST_URL = 'https://www.pzds.com/goodsList/84/6/headerSearch?queryFrom=search&searchType=GAME_NAME';
const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function numberMatch(text, pattern) {
  const match = String(text ?? '').match(pattern);
  if (!match) return null;
  const value = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function namesAfter(text, pattern) {
  const match = String(text ?? '').match(pattern);
  if (!match) return [];
  return match[1].split(/[，,、；;|/]/).map(clean).filter(Boolean);
}

function parseSummary(text) {
  const value = clean(text);
  return {
    counts: {
      level: numberMatch(value, /(\d+)级/),
      sixStar: numberMatch(value, /(?:^|[，,；;])\s*六星(\d+)/),
      limitedSixStar: numberMatch(value, /限定六星(\d+)/),
      elite2: numberMatch(value, /精二(\d+)/),
      skins: numberMatch(value, /时装(\d+)\s*\(/),
      dynamicSkins: numberMatch(value, /动态(\d+)/),
      collabSkins: numberMatch(value, /(?:特典联名|联名)(\d+)/),
    },
    resources: {
      orundum: numberMatch(value, /合成玉(\d+)/),
      originitePrime: numberMatch(value, /源石(\d+)/),
    },
    skins: namesAfter(value, /(?:联名时装|特典时装)[：:]([^；;]+)/),
  };
}

function normalizeItem(item, rank, sourceMeta = {}) {
  const title = clean(item.title);
  const message = clean(item.simpleMessage);
  const parsed = parseSummary(title);
  const server = /官服|官方/.test(message) ? '官服'
    : /B服/i.test(message) ? 'B服'
      : /渠道服/.test(message) ? '渠道服' : null;
  const labels = Array.isArray(item.sellingPointLabels)
    ? item.sellingPointLabels.map((label) => clean(label?.name ?? label?.labelName ?? label)).filter(Boolean)
    : [];
  return {
    rank,
    listingId: clean(item.goodsNo),
    priceCny: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    server,
    status: {
      guarantee: Boolean(item.compensation),
      confidenceBuy: Boolean(item.isConfidenceBuy),
      sourceStatus: sourceMeta.paginationPartial || !item.goodsNo || item.price == null ? 'partial' : 'success',
      paginationPartial: Boolean(sourceMeta.paginationPartial),
      paginationError: sourceMeta.paginationError || null,
      loadAttempts: Number(sourceMeta.loadAttempts ?? 0),
      loadedRowCount: Number(sourceMeta.loadedRowCount ?? 0),
      matchingRowCount: Number(sourceMeta.matchingRowCount ?? 0),
      serverPriceFilterApplied: Boolean(sourceMeta.serverPriceFilterApplied),
      serverPriceFilterError: sourceMeta.serverPriceFilterError || null,
    },
    counts: parsed.counts,
    resources: parsed.resources,
    skins: parsed.skins,
    publishedAt: clean(item.onStandTime || item.createTime) || null,
    title,
    sellingPointLabels: labels,
    url: item.goodsNo ? `https://${HOST}/goodsDetails/${item.goodsNo}/6` : null,
  };
}

cli({
  site: 'pzds',
  name: 'arknights-list',
  description: '盼之明日方舟账号列表事实字段（动态价格区间、资源、时装与上架时间）',
  access: 'read',
  example: 'opencli pzds arknights-list --minPrice 800 --maxPrice 1200 --limit 20 -f json',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'minPrice', type: 'int', default: 0, help: '最低价格（CNY，0 表示不限制）' },
    { name: 'maxPrice', type: 'int', default: 0, help: '最高价格（CNY，0 表示不限制）' },
    { name: 'limit', type: 'int', default: 20, help: '返回数量（max 60）' },
    { name: 'page', type: 'int', default: 1, help: '本地结果分页（从 1 开始）' },
    { name: 'sort', type: 'string', default: 'default', help: '当前批次排序：default / priceAsc / priceDesc' },
  ],
  columns: ['rank', 'listingId', 'priceCny', 'server', 'status', 'counts', 'resources', 'skins', 'publishedAt', 'title', 'sellingPointLabels', 'url'],
  func: async (page, args) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pzds arknights-list');
    const minPrice = Math.max(0, Number(args.minPrice) || 0);
    const maxPrice = Math.max(0, Number(args.maxPrice) || 0);
    if (minPrice && maxPrice && minPrice > maxPrice) throw new CliError('INVALID_ARGUMENT', 'minPrice cannot exceed maxPrice');
    const limit = Math.max(1, Math.min(Number(args.limit) || 20, 60));
    const startPage = Math.max(1, Number(args.page) || 1);
    const sort = String(args.sort ?? 'default');
    if (!['default', 'priceAsc', 'priceDesc'].includes(sort)) throw new CliError('INVALID_ARGUMENT', `Unknown sort "${sort}"`);

    await page.goto(LIST_URL, { waitUntil: 'load', settleMs: 1800 });
    const config = {
      minPrice,
      maxPrice,
      requiredMatches: startPage * limit,
      maxLoads: Math.min(20, Math.max(8, startPage * limit * 2)),
      loadDelayMs: 1200,
    };
    const rawResult = await page.evaluate(`(async () => {
      const config = ${JSON.stringify(config)};
      const nuxtRows = window.__NUXT__?.data?.find((item) => Array.isArray(item?.goodsList))?.goodsList;
      const deadline = Date.now() + 15000;
      let component = null;
      while (Date.now() < deadline) {
        component = document.querySelector('.goods-list-big')?.__vue__ || null;
        if (component && Array.isArray(component.goodsList)) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!component || !Array.isArray(component.goodsList)) {
        return { rows: Array.isArray(nuxtRows) ? nuxtRows : [], paginationPartial: true, paginationError: 'vue_goods_list_not_ready', loadAttempts: 0 };
      }
      const matchesPrice = (item) => {
        const price = Number(item?.price);
        if (!Number.isFinite(price)) return false;
        return (!config.minPrice || price >= config.minPrice) && (!config.maxPrice || price <= config.maxPrice);
      };
      let serverPriceFilterApplied = false;
      let serverPriceFilterError = (config.minPrice || config.maxPrice) ? 'bounded_local_price_scan' : null;
      let paginationError = null;
      if (component.goodsList.length === 0 && Array.isArray(nuxtRows) && nuxtRows.length > 0) {
        const matchingRowCount = nuxtRows.filter(matchesPrice).length;
        return {
          rows: nuxtRows,
          paginationPartial: true,
          paginationError: 'vue_goods_list_empty_used_nuxt_ssr',
          loadAttempts: 0,
          loadedRowCount: nuxtRows.length,
          matchingRowCount,
          serverPriceFilterApplied,
          serverPriceFilterError,
        };
      }
      let loadAttempts = 0;
      for (let loads = 0; !paginationError && loads < config.maxLoads; loads += 1) {
        if (component.goodsList.filter(matchesPrice).length >= config.requiredMatches || component.hasMore === false) break;
        const previousLength = component.goodsList.length;
        if (typeof component.loadMore !== 'function') break;
        await new Promise((resolve) => setTimeout(resolve, config.loadDelayMs));
        loadAttempts += 1;
        try {
          await component.loadMore();
        } catch (error) {
          paginationError = String(error?.message || error || 'loadMore failed').slice(0, 300);
          break;
        }
        const waitUntil = Date.now() + 4000;
        while (Date.now() < waitUntil && component.goodsList.length === previousLength && component.hasMore !== false) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (component.goodsList.length === previousLength) {
          paginationError = paginationError || 'load_more_stalled';
          break;
        }
      }
      const matchingRowCount = component.goodsList.filter(matchesPrice).length;
      const scanBudgetExhausted = matchingRowCount < config.requiredMatches
        && component.hasMore !== false
        && loadAttempts >= config.maxLoads;
      return {
        rows: component.goodsList,
        paginationPartial: Boolean(paginationError || scanBudgetExhausted),
        paginationError: paginationError || (scanBudgetExhausted ? 'scan_budget_exhausted' : null),
        loadAttempts,
        loadedRowCount: component.goodsList.length,
        matchingRowCount,
        serverPriceFilterApplied,
        serverPriceFilterError,
      };
    })()`);
    const rawRows = Array.isArray(rawResult) ? rawResult : rawResult?.rows;
    const sourceMeta = Array.isArray(rawResult) ? {} : {
      paginationPartial: Boolean(rawResult?.paginationPartial),
      paginationError: clean(rawResult?.paginationError) || null,
      loadAttempts: Number(rawResult?.loadAttempts ?? 0),
      loadedRowCount: Number(rawResult?.loadedRowCount ?? 0),
      matchingRowCount: Number(rawResult?.matchingRowCount ?? 0),
      serverPriceFilterApplied: Boolean(rawResult?.serverPriceFilterApplied),
      serverPriceFilterError: clean(rawResult?.serverPriceFilterError) || null,
    };
    const offset = (startPage - 1) * limit;
    const rows = (Array.isArray(rawRows) ? rawRows : [])
      .map((item, index) => normalizeItem(item, index + 1, sourceMeta))
      .filter((row) => row.priceCny != null)
      .filter((row) => (!minPrice || row.priceCny >= minPrice) && (!maxPrice || row.priceCny <= maxPrice));
    const uniqueRows = [...new Map(rows.map((row, index) => [row.listingId || row.url || `row-${index}`, row])).values()];
    if (!uniqueRows.length) {
      throw new CliError('NO_DATA', `PZDS returned no Arknights listings for this query; loaded=${sourceMeta.loadedRowCount}, matching=${sourceMeta.matchingRowCount}, pagination=${sourceMeta.paginationError || 'none'}`);
    }
    if (sort === 'priceAsc') uniqueRows.sort((a, b) => (a.priceCny ?? Infinity) - (b.priceCny ?? Infinity));
    if (sort === 'priceDesc') uniqueRows.sort((a, b) => (b.priceCny ?? -Infinity) - (a.priceCny ?? -Infinity));
    return uniqueRows.slice(offset, offset + limit).map((row, index) => ({ ...row, rank: offset + index + 1 }));
  },
});
