const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

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

function section(text, label, nextLabels) {
  const structuralLabels = [
    ...nextLabels,
    '精二六星',
    '精一六星',
    '六星干员',
    '联动干员',
    '时装',
    '合成玉数量',
    '源石数量',
    '联动干员数量',
    '时装数量',
  ].filter((item) => item !== label);
  const tail = [...new Set(structuralLabels)].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`${label}[：:]([\\s\\S]*?)(?=；(?:${tail})[：:]|；【|$)`);
  const match = String(text ?? '').match(pattern);
  return match ? match[1].split(/[，,、]/).map(clean).filter(Boolean) : [];
}

function namesAfter(text, pattern) {
  const match = String(text ?? '').match(pattern);
  return match ? match[1].split(/[，,、；;|/]/).map(clean).filter(Boolean) : [];
}

function tags(text, patterns) {
  const values = [];
  for (const pattern of patterns) {
    const match = String(text ?? '').match(pattern);
    if (match) values.push(clean(match[0]));
  }
  return [...new Set(values)];
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
  if (/官服|官方|官方账号/.test(text)) return '官服';
  return null;
}

function pxb7Summary(text) {
  const value = clean(text);
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
      elite2: section(value, '精二六星', ['精一六星', '六星干员', '联动干员', '时装']),
      elite1: section(value, '精一六星', ['六星干员', '联动干员', '时装']),
      sixStar: section(value, '六星干员', ['联动干员', '时装']),
      collab: section(value, '联动干员', ['时装']),
    },
    skins: section(value, '时装', []),
  };
}

function pzdsSummary(text) {
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

function normalizePxb7List(raw, options) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, 60));
  const sort = String(options.sort ?? 'default');
  const rows = (Array.isArray(raw?.rows) ? raw.rows : []).map((item, index) => {
    const parsed = pxb7Summary(item.showTitle);
    const itemTags = Array.isArray(item.attrNameList) ? item.attrNameList.map(clean).filter(Boolean) : [];
    const serverTag = itemTags.find((tag) => /官方账号|B服|渠道服/.test(tag)) ?? null;
    return {
      rank: index + 1,
      listingId: String(item.productId ?? ''),
      priceCny: Number.isFinite(Number(item.price)) ? Number(item.price) / 100 : null,
      server: parseServer(serverTag),
      status: { guarantee: item.guarantee === 1, sourceStatus: parsed.operators.sixStar.length || parsed.operators.elite2.length ? 'success' : 'partial' },
      counts: parsed.counts,
      resources: parsed.resources,
      operatorNames: parsed.operators.sixStar,
      elite2OperatorNames: parsed.operators.elite2,
      collabOperatorNames: parsed.operators.collab,
      skins: parsed.skins,
      url: item.productId ? `https://www.pxb7.com/product/${item.productId}/1` : null,
    };
  });
  const unique = [...new Map(rows.map((row, index) => [row.listingId || row.url || `row-${index}`, row])).values()];
  if (sort === 'priceAsc') unique.sort((a, b) => (a.priceCny ?? Infinity) - (b.priceCny ?? Infinity));
  if (sort === 'priceDesc') unique.sort((a, b) => (b.priceCny ?? -Infinity) - (a.priceCny ?? -Infinity));
  return unique.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function normalizePzdsList(raw, options) {
  const minPrice = Math.max(0, Number(options.minPrice) || 0);
  const maxPrice = Math.max(0, Number(options.maxPrice) || 0);
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, 60));
  const page = Math.max(1, Number(options.page) || 1);
  const sort = String(options.sort ?? 'default');
  const source = Array.isArray(raw) ? { rows: raw } : raw ?? {};
  const meta = {
    paginationPartial: Boolean(source.paginationPartial), paginationError: clean(source.paginationError) || null,
    loadAttempts: Number(source.loadAttempts ?? 0), loadedRowCount: Number(source.loadedRowCount ?? 0),
    matchingRowCount: Number(source.matchingRowCount ?? 0), serverPriceFilterApplied: Boolean(source.serverPriceFilterApplied),
    serverPriceFilterError: clean(source.serverPriceFilterError) || null,
  };
  const rows = (Array.isArray(source.rows) ? source.rows : []).map((item, index) => {
    const title = clean(item.title);
    const parsed = pzdsSummary(title);
    const labels = Array.isArray(item.sellingPointLabels) ? item.sellingPointLabels.map((label) => clean(label?.name ?? label?.labelName ?? label)).filter(Boolean) : [];
    return {
      rank: index + 1,
      listingId: clean(item.goodsNo),
      priceCny: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      server: parseServer(item.simpleMessage),
      status: {
        guarantee: Boolean(item.compensation), confidenceBuy: Boolean(item.isConfidenceBuy),
        sourceStatus: meta.paginationPartial || !item.goodsNo || item.price == null ? 'partial' : 'success',
        ...meta,
      },
      counts: parsed.counts, resources: parsed.resources, skins: parsed.skins,
      publishedAt: clean(item.onStandTime || item.createTime) || null,
      title, sellingPointLabels: labels,
      url: item.goodsNo ? `https://www.pzds.com/goodsDetails/${item.goodsNo}/6` : null,
    };
  }).filter((row) => row.priceCny != null)
    .filter((row) => (!minPrice || row.priceCny >= minPrice) && (!maxPrice || row.priceCny <= maxPrice));
  const unique = [...new Map(rows.map((row, index) => [row.listingId || row.url || `row-${index}`, row])).values()];
  if (sort === 'priceAsc') unique.sort((a, b) => (a.priceCny ?? Infinity) - (b.priceCny ?? Infinity));
  if (sort === 'priceDesc') unique.sort((a, b) => (b.priceCny ?? -Infinity) - (a.priceCny ?? -Infinity));
  const offset = (page - 1) * limit;
  return unique.slice(offset, offset + limit).map((row, index) => ({ ...row, rank: offset + index + 1 }));
}

function parsePxb7Detail(raw) {
  const text = clean(raw.primaryText ?? raw.text).replace(/\n+/g, '\n');
  const labels = ['精一六星', '六星干员', '联动干员', '时装'];
  const operators = {
    elite2: section(text, '精二六星', labels),
    elite1: section(text, '精一六星', ['六星干员', '联动干员', '时装']),
    sixStar: section(text, '六星干员', ['联动干员', '时装']),
    collab: section(text, '联动干员', ['时装']),
  };
  const elite2 = new Set(operators.elite2);
  const elite1 = new Set(operators.elite1);
  const verificationImageUrls = [...new Set((Array.isArray(raw.images) ? raw.images : [])
    .map((image) => clean(image?.src))
    .filter((src) => /^https:\/\/public-image\.pxb7\.com\/AutoGame\/AutoGameMainContent\//i.test(src)))];
  const listingId = raw.url?.match(/\/product\/(\d+)\/1/)?.[1] ?? null;
  return {
    listingId,
    priceCny: numberMatch(text, /￥\s*([0-9][0-9,]*(?:\.\d+)?)/),
    server: parseServer(text),
    riskFacts: [
      ...tags(text, [/找回包赔/, /终身包赔/, /\d+年包赔/]),
      ...tags(text, [/官方验号/, /官方截图/, /平台验号/]),
      ...tags(text, [/换绑[^。；\n]{0,60}/, /未注册鹰角账号[^。；\n]{0,40}/, /实名[^。；\n]{0,40}/]),
    ],
    status: {
      productCode: text.match(/【([A-Z0-9]{6,})】/)?.[1] ?? null,
      verifiedAt: text.match(/该账号于(\d{4}年\d{2}月\d{2}日)完成验号/)?.[1] ?? null,
      sourceStatus: operators.sixStar.length || operators.elite2.length ? 'success' : 'partial',
    },
    counts: {
      level: numberMatch(text, /(\d+)级/), sixStar: numberMatch(text, /(\d+)六星/), elite2: numberMatch(text, /(\d+)精二/),
      elite1: numberMatch(text, /(\d+)精一/), collab: numberMatch(text, /联动干员数量[：:]\s*(\d+)/), skins: numberMatch(text, /时装数量[：:]\s*(\d+)/),
    },
    resources: { orundum: numberMatch(text, /合成玉数量[：:]\s*(\d+)/), originitePrime: numberMatch(text, /源石数量[：:]\s*(\d+)/) },
    operatorNames: operators.sixStar,
    elite2OperatorNames: operators.elite2,
    elite1OperatorNames: operators.elite1,
    operatorProgression: operators.sixStar.map((name) => ({
      name, elite: elite2.has(name) ? 2 : elite1.has(name) ? 1 : null, mastery: null, module: null,
      evidence: elite2.has(name) ? 'platform_text_elite2' : elite1.has(name) ? 'platform_text_elite1' : 'elite_status_not_exposed',
    })),
    collabOperatorNames: operators.collab,
    skins: section(text, '时装', []),
    verificationImageUrls,
    progressionEvidence: {
      elite: operators.elite2.length || operators.elite1.length ? 'platform_text_verified' : 'not_exposed',
      mastery: 'not_exposed', module: 'not_exposed',
      verification_images: verificationImageUrls.length ? 'available' : 'not_exposed', verification_image_count: verificationImageUrls.length,
    },
    url: raw.url,
  };
}

function parsePzdsDetail(raw) {
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
      ...previous, ...asset, name,
      code: clean(asset?.code) || clean(previous?.code), cornerMark: clean(asset?.cornerMark) || clean(previous?.cornerMark),
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
  const imageByName = new Map(operatorAssets.map((asset) => [clean(asset.name), /^https?:\/\//i.test(clean(asset.url)) ? clean(asset.url) : null]));
  const operatorImageUrls = operatorNames.map((name) => imageByName.get(name) ?? null);
  const descriptionSkins = splitNames(bracketField(description, '时装'));
  const skins = descriptionSkins.length ? descriptionSkins : [...new Set(skinAssets.map((asset) => clean(asset.name)))];
  const verificationImageUrls = [...new Set((Array.isArray(details.detailsImages) ? details.detailsImages : [])
    .map((image) => clean(typeof image === 'string' ? image : image?.url || image?.imageUrl || image?.src))
    .filter((url) => /^https?:\/\//i.test(url)))];
  const officialVerification = /官方/.test(clean(details.shotTypeName));
  return {
    listingId: clean(details.goodsNo), priceCny: Number.isFinite(Number(details.price)) ? Number(details.price) : null,
    server: parseServer(details.simpleMessage, description),
    riskFacts: [...(details.compensation ? ['找回包赔'] : []), ...(officialVerification ? [`${clean(details.shotTypeName)}验号`] : []), ...(details.isConfidenceBuy ? ['放心购'] : [])],
    status: {
      guarantee: Boolean(details.compensation), confidenceBuy: Boolean(details.isConfidenceBuy), officialVerification,
      verificationMethod: clean(details.shotTypeName) || null, verifiedAt: clean(details.verifyTime) || null,
      publishedAt: clean(details.onStandTime || details.createTime) || null,
      eliteEvidence: elite2OperatorNames.length || elite1OperatorNames.length ? 'platform_asset_cards_verified' : 'not_exposed',
      masteryEvidence: 'not_exposed', moduleEvidence: 'not_exposed', verificationImageCount: verificationImageUrls.length,
      assetTabActivated: raw.assetTabState?.activated === true, assetResourceCount: Number(raw.assetTabState?.resourceCount ?? assets.length),
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
      orundum: numberValue(bracketField(description, '合成玉')), originitePrime: numberValue(bracketField(description, '源石')),
    },
    operatorNames, elite2OperatorNames, elite1OperatorNames, operatorImageUrls, skins, verificationImageUrls, url: raw.url,
  };
}

export function parseArknightsOperation(operation, raw, options = {}) {
  if (operation === 'pxb7/arknights-list') return normalizePxb7List(raw, options);
  if (operation === 'pzds/arknights-list') return normalizePzdsList(raw, options);
  if (operation === 'pxb7/arknights-detail') return [parsePxb7Detail(raw)];
  if (operation === 'pzds/arknights-detail') return [parsePzdsDetail(raw)];
  throw new Error(`Unsupported Arknights operation: ${operation}`);
}
