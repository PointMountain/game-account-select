function positiveInteger(value, fallback, max) {
  return Math.max(1, Math.min(Number(value) || fallback, max));
}

export function normalizeOperationUrl(operation, input, entry) {
  if (operation.endsWith('-list')) return entry;
  if (operation === 'generic/semantic-search') {
    if (!/^https?:\/\//i.test(String(input ?? ''))) throw new Error('generic semantic search requires --url');
    return String(input);
  }
  if (operation.startsWith('pxb7/')) {
    const value = String(input ?? '').trim();
    if (/^https:\/\/www\.pxb7\.com\/product\/\d+\/1(?:[?#].*)?$/i.test(value)) return value;
    if (/^\d{10,}$/.test(value)) return `https://www.pxb7.com/product/${value}/1`;
    throw new Error(`${operation} requires a PXB7 product URL or numeric product id`);
  }
  if (operation.startsWith('pzds/')) {
    const value = String(input ?? '').trim();
    if (/^https?:\/\/(?:www\.)?pzds\.com\/goodsDetails\/[A-Za-z0-9]+\/6(?:[/?#].*)?$/i.test(value)) return value;
    if (/^[A-Za-z0-9]+$/.test(value)) return `https://www.pzds.com/goodsDetails/${value}/6`;
    throw new Error(`${operation} requires a PZDS detail URL or listing id`);
  }
  throw new Error(`Unsupported operation: ${operation}`);
}

function pxb7List(options, gameId, query) {
  const config = {
    gameId,
    query,
    apiUrl: 'https://api-pc.pxb7.com/api/search/product/v2/selectSearchPageList',
    minPrice: Math.max(0, Number(options.minPrice) || 0),
    maxPrice: Math.max(0, Number(options.maxPrice) || 0),
    limit: positiveInteger(options.limit, 20, 60),
    pages: Math.min(3, Math.ceil(positiveInteger(options.limit, 20, 60) / 20)),
    startPage: positiveInteger(options.page, 1, 100),
  };
  return `(async () => {
    const config = ${JSON.stringify(config)};
    const rows = [];
    let pageToken = null;
    for (let offset = 0; offset < config.pages && rows.length < config.limit; offset += 1) {
      const filterDTOList = [];
      if (config.minPrice || config.maxPrice) {
        filterDTOList.push({ attrId: 'price', attrType: 3, attrValList: [String(config.minPrice || 0), String(config.maxPrice || 99999999)] });
      }
      const payload = {
        query: config.query, gameId: config.gameId, pageIndex: config.startPage + offset, pageSize: 20,
        bizProd: 1, type: '2', posType: 1, filterDTOList,
        ...(pageToken ? { pageToken } : {})
      };
      const response = await fetch(config.apiUrl, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('PXB7 list HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data?.data?.list)) throw new Error('PXB7 list response missing data.list');
      const list = data.data.list;
      if (list.some((item) => item?.gameId != null && String(item.gameId) !== config.gameId)) throw new Error('PXB7 list response contains a different game');
      if (!list.length) break;
      rows.push(...list);
      pageToken = data?.data?.properties?.pageToken ?? null;
    }
    const compactRows = rows.slice(0, config.limit).map((item) => {
      const rawTitle = String(item?.showTitle || '');
      const withoutSkinNames = rawTitle.replace(/；时装[：:][\\s\\S]*$/, '');
      const scalarFacts = [
        ['合成玉数量', rawTitle.match(/合成玉(?:数量)?[：:]?\\s*(\\d+)/)?.[1]],
        ['源石数量', rawTitle.match(/源石(?:数量)?[：:]?\\s*(\\d+)/)?.[1]],
        ['联动干员数量', rawTitle.match(/联动干员数量[：:]?\\s*(\\d+)/)?.[1]],
        ['时装数量', rawTitle.match(/时装数量[：:]?\\s*(\\d+)/)?.[1]],
      ].filter((entry) => entry[1] != null).map((entry) => entry[0] + '：' + entry[1]);
      return {
        productId: item?.productId,
        gameId: item?.gameId,
        price: item?.price,
        guarantee: item?.guarantee,
        attrNameList: Array.isArray(item?.attrNameList) ? item.attrNameList.slice(0, 12) : [],
        showTitle: config.gameId === '10053' ? [withoutSkinNames, ...scalarFacts].filter(Boolean).join('；') : rawTitle,
      };
    });
    return { rows: compactRows };
  })()`;
}

function pzdsList(options) {
  const limit = positiveInteger(options.limit, 20, 60);
  const startPage = positiveInteger(options.page, 1, 100);
  const config = {
    minPrice: Math.max(0, Number(options.minPrice) || 0),
    maxPrice: Math.max(0, Number(options.maxPrice) || 0),
    requiredMatches: startPage * limit,
    maxLoads: Math.min(20, Math.max(8, startPage * limit * 2)),
    loadDelayMs: 1200,
  };
  return `(async () => {
    const config = ${JSON.stringify(config)};
    const compactRows = (rows) => (Array.isArray(rows) ? rows : []).map((item) => ({
      goodsNo: item?.goodsNo,
      price: item?.price,
      title: item?.title,
      sellingPointLabels: Array.isArray(item?.sellingPointLabels) ? item.sellingPointLabels.slice(0, 12) : [],
      simpleMessage: item?.simpleMessage,
      compensation: item?.compensation,
      isConfidenceBuy: item?.isConfidenceBuy,
      onStandTime: item?.onStandTime,
      createTime: item?.createTime,
    }));
    const nuxtRows = window.__NUXT__?.data?.find((item) => Array.isArray(item?.goodsList))?.goodsList;
    const deadline = Date.now() + 15000;
    let component = null;
    while (Date.now() < deadline) {
      component = document.querySelector('.goods-list-big')?.__vue__ || null;
      if (component && Array.isArray(component.goodsList)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!component || !Array.isArray(component.goodsList)) {
      return { rows: compactRows(nuxtRows), paginationPartial: true, paginationError: 'vue_goods_list_not_ready', loadAttempts: 0 };
    }
    const matchesPrice = (item) => {
      const price = Number(item?.price);
      if (!Number.isFinite(price)) return false;
      return (!config.minPrice || price >= config.minPrice) && (!config.maxPrice || price <= config.maxPrice);
    };
    let paginationError = null;
    if (component.goodsList.length === 0 && Array.isArray(nuxtRows) && nuxtRows.length > 0) {
      return {
        rows: compactRows(nuxtRows), paginationPartial: true, paginationError: 'vue_goods_list_empty_used_nuxt_ssr', loadAttempts: 0,
        loadedRowCount: nuxtRows.length, matchingRowCount: nuxtRows.filter(matchesPrice).length,
        serverPriceFilterApplied: false, serverPriceFilterError: (config.minPrice || config.maxPrice) ? 'bounded_local_price_scan' : null
      };
    }
    let loadAttempts = 0;
    for (let loads = 0; !paginationError && loads < config.maxLoads; loads += 1) {
      if (component.goodsList.filter(matchesPrice).length >= config.requiredMatches || component.hasMore === false) break;
      const previousLength = component.goodsList.length;
      if (typeof component.loadMore !== 'function') break;
      await new Promise((resolve) => setTimeout(resolve, config.loadDelayMs));
      loadAttempts += 1;
      try { await component.loadMore(); }
      catch (error) { paginationError = String(error?.message || error || 'loadMore failed').slice(0, 300); break; }
      const waitUntil = Date.now() + 4000;
      while (Date.now() < waitUntil && component.goodsList.length === previousLength && component.hasMore !== false) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (component.goodsList.length === previousLength) { paginationError = paginationError || 'load_more_stalled'; break; }
    }
    const matchingRowCount = component.goodsList.filter(matchesPrice).length;
    const exhausted = matchingRowCount < config.requiredMatches && component.hasMore !== false && loadAttempts >= config.maxLoads;
    return {
      rows: compactRows(component.goodsList),
      paginationPartial: Boolean(paginationError || exhausted),
      paginationError: paginationError || (exhausted ? 'scan_budget_exhausted' : null),
      loadAttempts, loadedRowCount: component.goodsList.length, matchingRowCount,
      serverPriceFilterApplied: false,
      serverPriceFilterError: (config.minPrice || config.maxPrice) ? 'bounded_local_price_scan' : null
    };
  })()`;
}

function pxb7Detail() {
  return `(() => {
    const nodes = Array.from(document.querySelectorAll('body *'));
    const recommendation = nodes.find((node) => node.children.length === 0 && node.textContent.trim() === '商品推荐');
    const isPrimary = (node) => !recommendation || (!node.contains(recommendation) && Boolean(node.compareDocumentPosition(recommendation) & Node.DOCUMENT_POSITION_FOLLOWING));
    const primaryText = (document.body?.innerText || '').split(/商品推荐/)[0]
      .split('\\n').filter((line) => !/^\\*\\*/.test(line)).join('\\n');
    const assetCards = Array.from(document.querySelectorAll('.ReportCharacter,.ReportWeapon')).filter(isPrimary).flatMap((section) => {
      const label = (section.innerText || '').split('\\n')[0].trim();
      return Array.from(section.querySelectorAll('[class*="cursor-pointer"]')).map((card) => ({ section: label, text: card.innerText || '' }));
    });
    return {
    url: location.href,
    title: document.title || '',
    text: primaryText,
    primaryText,
    primaryTitleText: (() => {
      const candidates = nodes.filter(isPrimary)
        .filter((el) => el.children.length === 0)
        .map((el) => (el.innerText || '').trim())
        .filter((value) => /^【[A-Z0-9]+】/i.test(value));
      return candidates.sort((left, right) => right.length - left.length)[0] || '';
    })(),
    titleNodes: Array.from(document.querySelectorAll('[title]')).filter(isPrimary).map((el) => ({ title: el.getAttribute('title') || '', text: el.innerText || '' })),
    assetCards,
    agentCards: assetCards.filter((card) => /S级(?:角色|代理人)/.test(card.section)),
    wEngineCards: assetCards.filter((card) => /S级(?:音擎|武器)/.test(card.section)),
    images: Array.from(document.images || []).filter(isPrimary).map((image) => ({
      src: image.currentSrc || image.src || '', width: image.naturalWidth || 0, height: image.naturalHeight || 0
    })).filter((image) => image.width >= 600 || image.height >= 600)
    };
  })()`;
}

function pzdsDetail() {
  return `(async () => {
    const resourceCount = () => {
      const details = window.__NUXT__?.data?.find((item) => item?.detailsData)?.detailsData;
      const resources = details?.metadataModel?.resources;
      return Array.isArray(resources) ? resources.length : 0;
    };
    const domCardCount = () => document.querySelectorAll('.scroll-item_box[title] img.scroll-item_cover').length;
    let assetTabState = { activated: false, alreadyLoaded: resourceCount() > 0 || domCardCount() > 0 };
    if (!assetTabState.alreadyLoaded) {
      const target = [...document.querySelectorAll('[role="tab"], button, a, div, span')].find((node) => node instanceof HTMLElement
        && node.textContent?.trim() === '游戏资产' && node.getClientRects().length > 0);
      if (target) {
        target.click(); assetTabState.activated = true;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && resourceCount() === 0 && domCardCount() === 0) await new Promise((resolve) => setTimeout(resolve, 250));
      } else assetTabState.error = 'game_assets_tab_not_found';
    }
    assetTabState.resourceCount = resourceCount();
    assetTabState.domCardCount = domCardCount();
    const details = window.__NUXT__?.data?.find((item) => item?.detailsData)?.detailsData || null;
    const resources = Array.isArray(details?.metadataModel?.resources) ? details.metadataModel.resources : [];
    return {
      url: location.href, title: document.title || '', text: document.body ? document.body.innerText || '' : '',
      details: details ? {
        goodsNo: details.goodsNo, price: details.price, title: details.title, description: details.description,
        simpleMessage: details.simpleMessage, onStandTime: details.onStandTime, createTime: details.createTime,
        verifyTime: details.verifyTime, compensation: details.compensation, isConfidenceBuy: details.isConfidenceBuy,
        shotTypeName: details.shotTypeName, detailsImages: details.detailsImages
      } : null,
      assets: resources.map((asset) => ({
        name: asset?.name || '', code: asset?.code || '', cornerMark: asset?.cornerMark || '', url: asset?.url || '', evidenceSource: 'metadata_resource'
      })),
      domAssets: [...document.querySelectorAll('.scroll-item_box[title]')].map((card) => {
        const item = card.closest('.scroll-item');
        let metadataId = '';
        try { metadataId = JSON.parse(item?.getAttribute('data-track-click') || '{}')?.metadataId || ''; } catch {}
        const imageUrl = card.querySelector('img.scroll-item_cover')?.currentSrc || card.querySelector('img.scroll-item_cover')?.src || '';
        if (!metadataId && /ganyuan/i.test(imageUrl)) metadataId = 'MR1_DOM';
        if (!metadataId && /shizhuang/i.test(imageUrl)) metadataId = 'MR2_DOM';
        return {
          name: card.getAttribute('title') || card.querySelector('.scroll-item_name')?.textContent || '', code: metadataId,
          cornerMark: card.querySelector('.scroll-item_corner')?.textContent || '', url: imageUrl, evidenceSource: 'dom_asset_grid'
        };
      }),
      titleNodes: Array.from(document.querySelectorAll('[title]')).map((el) => ({ title: el.getAttribute('title') || '', text: el.innerText || '' })),
      assetTabState
    };
  })()`;
}

function semanticSearch(options) {
  const limit = positiveInteger(options.limit, 30, 100);
  const followMatch = String(options.followMatch || '').trim();
  const matchTexts = Array.isArray(options.matchTexts)
    ? options.matchTexts.map((value) => String(value).trim()).filter(Boolean).slice(0, 12)
    : [];
  return `(async () => {
    const matchTexts = ${JSON.stringify(matchTexts)};
    const followMatch = ${JSON.stringify(followMatch)};
    let followed = null;
    if (followMatch) {
      const exact = Array.from(document.querySelectorAll('body *')).find((node) =>
        node instanceof HTMLElement
        && (node.textContent || '').replace(/\\s+/g, ' ').trim() === followMatch
        && node.getClientRects().length > 0
        && !Array.from(node.children).some((child) => (child.textContent || '').replace(/\\s+/g, ' ').trim() === followMatch));
      const clickable = exact?.closest('a[href], button, [role="button"], .game-item') || exact;
      if (clickable instanceof HTMLElement) {
        const from = location.href;
        clickable.click();
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline && location.href === from) await new Promise((resolve) => setTimeout(resolve, 200));
        followed = { term: followMatch, from, to: location.href, changed: location.href !== from };
        if (followed.changed) await new Promise((resolve) => setTimeout(resolve, 1800));
      } else followed = { term: followMatch, error: 'exact_visible_match_not_found' };
    }
    const links = Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
      text: (anchor.innerText || anchor.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 240),
      url: anchor.href
    })).filter((item) => item.text && /^https?:\\/\\//i.test(item.url));
    const unique = [...new Map(links.map((item) => [item.url, item])).values()].slice(0, ${limit});
    const matches = matchTexts.map((term) => {
      const nodes = Array.from(document.querySelectorAll('body *')).filter((node) => {
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || !text.includes(term) || node.getClientRects().length === 0) return false;
        return !Array.from(node.children).some((child) => (child.textContent || '').replace(/\\s+/g, ' ').trim().includes(term));
      }).slice(0, 8);
      return {
        term,
        nodes: nodes.map((node) => {
          const ancestry = [];
          let current = node;
          for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
            ancestry.push({
              tag: current.tagName,
              className: String(current.className || '').slice(0, 240),
              href: current instanceof HTMLAnchorElement ? current.href : null,
              dataTrackClick: current.getAttribute('data-track-click'),
              dataGameId: current.getAttribute('data-game-id'),
              dataId: current.getAttribute('data-id'),
            });
          }
          return { text: (node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 400), ancestry };
        }),
      };
    });
    return { url: location.href, title: document.title || '', links: unique, matches, followed };
  })()`;
}

export function buildBrowserScript(operation, options = {}) {
  const pxb7Games = {
    arknights: ['10053', '明日方舟'],
    zzz: ['10312', '绝区零'],
    'wuthering-waves': ['10302', '鸣潮'],
    'neverness-to-everness': ['10630', '异环'],
  };
  if (operation.startsWith('pxb7/') && operation.endsWith('-list')) {
    const game = pxb7Games[operation.slice(5, -5)];
    if (game) return pxb7List(options, ...game);
  }
  if (operation.startsWith('pzds/') && operation.endsWith('-list')) return pzdsList(options);
  if (operation.startsWith('pxb7/') && pxb7Games[operation.slice(5, -7)] && operation.endsWith('-detail')) return pxb7Detail();
  if (operation.startsWith('pzds/') && operation.endsWith('-detail')) return pzdsDetail();
  if (operation === 'generic/semantic-search') return semanticSearch(options);
  throw new Error(`Unsupported operation: ${operation}`);
}
