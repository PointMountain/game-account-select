import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pzds.com';
const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function normalizeUrl(value) {
  const input = clean(value);
  if (/^https?:\/\/(?:www\.)?pzds\.com\/goodsDetails\/[A-Za-z0-9]+\/6(?:[/?#].*)?$/i.test(input)) return input;
  if (/^[A-Za-z0-9]+$/.test(input)) return `https://${HOST}/goodsDetails/${input}/6`;
  throw new CliError('INVALID_ARGUMENT', 'pzds arknights-detail requires a PZDS goods detail URL or listing id');
}

function numberValue(value) {
  const match = String(value ?? '').match(/[0-9][0-9,]*/);
  if (!match) return null;
  const number = Number(match[0].replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function numberMatch(text, pattern) {
  const match = String(text ?? '').match(pattern);
  return match ? numberValue(match[1]) : null;
}

function bracketField(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text ?? '').match(new RegExp(`【${escaped}】([\\s\\S]*?)(?=\\n?【|$)`));
  return match ? clean(match[1]) : '';
}

function splitNames(value) {
  return [...new Set(String(value ?? '').split(/[，,、；;|/\n]/).map(clean).filter(Boolean))];
}

function parseServer(...values) {
  const text = values.map(clean).join(' ');
  if (/B服/i.test(text)) return 'B服';
  if (/渠道服/.test(text)) return '渠道服';
  if (/官服|官方/.test(text)) return '官服';
  return null;
}

function parseDetail(raw) {
  const details = raw.details || {};
  const description = String(details.description ?? '');
  const metadataAssets = Array.isArray(raw.assets) ? raw.assets : [];
  const domAssets = Array.isArray(raw.domAssets) ? raw.domAssets : [];
  const assetsByName = new Map();
  for (const asset of [...metadataAssets, ...domAssets]) {
    const name = clean(asset?.name);
    if (!name) continue;
    const previous = assetsByName.get(name) || {};
    assetsByName.set(name, {
      ...previous,
      ...asset,
      name,
      code: clean(asset?.code) || clean(previous?.code),
      cornerMark: clean(asset?.cornerMark) || clean(previous?.cornerMark),
      url: clean(asset?.url) || clean(previous?.url),
      evidenceSources: [...new Set([...(previous?.evidenceSources || []), asset?.evidenceSource].filter(Boolean))],
    });
  }
  const assets = [...assetsByName.values()];
  const operatorAssets = assets.filter((asset) => /^MR1/i.test(clean(asset.code)) && clean(asset.name));
  const skinAssets = assets.filter((asset) => /^MR2/i.test(clean(asset.code)) && clean(asset.name));
  const operatorNames = [...new Set(operatorAssets.map((asset) => clean(asset.name)))];
  const elite2OperatorNames = [...new Set(operatorAssets.filter((asset) => /精二/.test(clean(asset.cornerMark))).map((asset) => clean(asset.name)))];
  const elite1OperatorNames = [...new Set(operatorAssets.filter((asset) => /精一/.test(clean(asset.cornerMark))).map((asset) => clean(asset.name)))];
  // Keep image URLs index-aligned with operatorNames. This preserves one-card-
  // per-operator evidence without returning deeply nested objects that violate
  // OpenCLI's strict-memory row-shape convention.
  const operatorImageByName = new Map(operatorAssets.map((asset) => [clean(asset.name), /^https?:\/\//i.test(clean(asset.url)) ? clean(asset.url) : null]));
  const operatorImageUrls = operatorNames.map((name) => operatorImageByName.get(name) ?? null);
  const elite2 = new Set(elite2OperatorNames);
  const elite1 = new Set(elite1OperatorNames);
  const descriptionSkins = splitNames(bracketField(description, '时装'));
  const skins = descriptionSkins.length ? descriptionSkins : [...new Set(skinAssets.map((asset) => clean(asset.name)))];
  const officialVerification = /官方/.test(clean(details.shotTypeName));
  const verificationImageUrls = [...new Set((Array.isArray(details.detailsImages) ? details.detailsImages : [])
    .map((image) => clean(typeof image === 'string' ? image : image?.url || image?.imageUrl || image?.src))
    .filter((url) => /^https?:\/\//i.test(url)))];
  return {
    listingId: clean(details.goodsNo),
    priceCny: Number.isFinite(Number(details.price)) ? Number(details.price) : null,
    server: parseServer(details.simpleMessage, description),
    riskFacts: [
      ...(details.compensation ? ['找回包赔'] : []),
      ...(officialVerification ? [`${clean(details.shotTypeName)}验号`] : []),
      ...(details.isConfidenceBuy ? ['放心购'] : []),
    ],
    status: {
      guarantee: Boolean(details.compensation),
      confidenceBuy: Boolean(details.isConfidenceBuy),
      officialVerification,
      verificationMethod: clean(details.shotTypeName) || null,
      verifiedAt: clean(details.verifyTime) || null,
      publishedAt: clean(details.onStandTime || details.createTime) || null,
      eliteEvidence: elite2OperatorNames.length || elite1OperatorNames.length ? 'platform_asset_cards_verified' : 'not_exposed',
      masteryEvidence: 'not_exposed',
      moduleEvidence: 'not_exposed',
      verificationImageCount: verificationImageUrls.length,
      assetTabActivated: raw.assetTabState?.activated === true,
      assetResourceCount: Number(raw.assetTabState?.resourceCount ?? assets.length),
      assetGridCardCount: Number(raw.assetTabState?.domCardCount ?? domAssets.length),
      operatorMetadataCount: metadataAssets.filter((asset) => /^MR1/i.test(clean(asset.code)) && clean(asset.name)).length,
      operatorDomCount: domAssets.filter((asset) => /^MR1/i.test(clean(asset.code)) && clean(asset.name)).length,
      sourceStatus: operatorNames.length && details.goodsNo && details.price != null ? 'success' : 'partial',
    },
    counts: {
      level: numberValue(bracketField(description, '等级')),
      sixStar: numberValue(bracketField(description, '六星干员数量')) ?? numberMatch(details.title, /(?:^|[，,；;])\s*六星(\d+)/),
      limitedSixStar: numberValue(bracketField(description, '限定六星干员数量')) ?? numberMatch(details.title, /限定六星(\d+)/),
      elite2: numberValue(bracketField(description, '精二六星数量')),
      skins: numberMatch(details.title, /时装(\d+)\s*\(/) ?? (skins.length || null),
      orundum: numberValue(bracketField(description, '合成玉')),
      originitePrime: numberValue(bracketField(description, '源石')),
    },
    operatorNames,
    elite2OperatorNames,
    operatorImageUrls,
    skins,
    verificationImageUrls,
    url: raw.url,
  };
}

cli({
  site: 'pzds',
  name: 'arknights-detail',
  description: '盼之明日方舟账号详情事实字段（干员、养成、资源、时装、上架与验号）',
  access: 'read',
  example: 'opencli pzds arknights-detail MRHP2E -f json',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'input', type: 'string', required: true, positional: true, help: 'PZDS 商品详情 URL 或商品编号' },
    { name: 'wait', type: 'int', default: 3, help: '页面加载等待秒数' },
  ],
  columns: ['listingId', 'priceCny', 'server', 'riskFacts', 'status', 'counts', 'operatorNames', 'elite2OperatorNames', 'operatorImageUrls', 'skins', 'verificationImageUrls', 'url'],
  func: async (page, args) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pzds arknights-detail');
    const url = normalizeUrl(args.input);
    const waitSeconds = Math.max(1, Math.min(Number(args.wait) || 3, 10));
    await page.goto(url, { waitUntil: 'load', settleMs: 2000 });
    await page.wait(waitSeconds);
    const assetTabState = await page.evaluate(`(async () => {
      const resourceCount = () => {
        const details = window.__NUXT__?.data?.find((item) => item?.detailsData)?.detailsData;
        const resources = details?.metadataModel?.resources;
        return Array.isArray(resources) ? resources.length : 0;
      };
      const domCardCount = () => document.querySelectorAll('.scroll-item_box[title] img.scroll-item_cover').length;
      if (resourceCount() > 0 || domCardCount() > 0) {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline && domCardCount() === 0) await new Promise((resolve) => setTimeout(resolve, 150));
        return { activated: false, alreadyLoaded: true, resourceCount: resourceCount(), domCardCount: domCardCount() };
      }
      const nodes = [...document.querySelectorAll('[role="tab"], button, a, div, span')];
      const target = nodes.find((node) => node instanceof HTMLElement
        && node.textContent?.trim() === '游戏资产'
        && node.getClientRects().length > 0);
      if (!target) return { activated: false, alreadyLoaded: false, resourceCount: 0, domCardCount: 0, error: 'game_assets_tab_not_found' };
      target.click();
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && resourceCount() === 0 && domCardCount() === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return { activated: true, alreadyLoaded: false, resourceCount: resourceCount(), domCardCount: domCardCount(), error: resourceCount() || domCardCount() ? null : 'game_assets_not_loaded_after_click' };
    })()`);
    const raw = await page.evaluate(`(() => {
      const details = window.__NUXT__?.data?.find((item) => item?.detailsData)?.detailsData || null;
      const resources = Array.isArray(details?.metadataModel?.resources) ? details.metadataModel.resources : [];
      return {
        url: location.href,
        text: document.body ? document.body.innerText || '' : '',
        details: details ? {
          goodsNo: details.goodsNo, price: details.price, title: details.title,
          description: details.description, simpleMessage: details.simpleMessage,
          onStandTime: details.onStandTime, createTime: details.createTime,
          verifyTime: details.verifyTime, compensation: details.compensation,
          isConfidenceBuy: details.isConfidenceBuy, shotTypeName: details.shotTypeName,
          detailsImages: details.detailsImages
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
            name: card.getAttribute('title') || card.querySelector('.scroll-item_name')?.textContent || '',
            code: metadataId,
            cornerMark: card.querySelector('.scroll-item_corner')?.textContent || '',
            url: imageUrl,
            evidenceSource: 'dom_asset_grid'
          };
        })
      };
    })()`);
    raw.assetTabState = assetTabState;
    if (/验证|滑块|访问过于频繁|安全校验/.test(raw.text || '') && !/明日方舟|商品编号|账号编号/.test(raw.text || '')) {
      throw new CliError('ANTI_BOT', 'pzds returned an anti-bot or verification page in the connected browser');
    }
    const row = parseDetail(raw);
    if (!row.listingId || row.priceCny == null) throw new CliError('NO_DATA', `Could not parse pzds Arknights detail from ${url}`);
    return [row];
  },
});
