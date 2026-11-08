const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function number(value) {
  if (value == null || clean(value) === '') return null;
  const parsed = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function server(text) {
  if (/国际服/.test(text)) return '国际服';
  if (/B服/.test(text)) return 'B服';
  if (/渠道服/.test(text)) return '渠道服';
  if (/官服|官方账号|完美账号/.test(text)) return '官服';
  return null;
}

export function normalizePxb7GameList(raw, options = {}) {
  const min = Number(options.minPrice) || 0;
  const max = Number(options.maxPrice) || 0;
  const rows = (raw?.rows ?? []).map((item) => {
    const price = number(item.price);
    const title = clean(item.showTitle);
    const listingId = clean(item.productId);
    return {
      listingId,
      priceCny: price == null ? null : price / 100,
      title,
      server: server((item.attrNameList ?? []).join(' ')),
      status: { guarantee: item.guarantee === 1, sourceStatus: listingId && price != null && title ? 'success' : 'partial' },
      url: listingId ? `https://www.pxb7.com/product/${listingId}/1` : null,
    };
  }).filter((row) => row.listingId && row.priceCny != null && (!min || row.priceCny >= min) && (!max || row.priceCny <= max));
  const unique = [...new Map(rows.map((row) => [row.listingId, row])).values()];
  if (options.sort === 'priceAsc') unique.sort((a, b) => a.priceCny - b.priceCny);
  if (options.sort === 'priceDesc') unique.sort((a, b) => b.priceCny - a.priceCny);
  return unique.slice(0, Math.max(1, Math.min(Number(options.limit) || 20, 60))).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function pxb7DetailIdentity(raw) {
  const text = clean(raw?.primaryText ?? raw?.text).split('商品推荐')[0];
  const title = clean(raw?.primaryTitleText) || text.match(/【[A-Z0-9]+】[^\n]+/i)?.[0] || clean(raw?.title);
  const header = text.split(/商品亮点|卖家说|验号报告|商品截图|充值包赔/)[0];
  const priceCny = number(header.match(/[￥¥]\s*([0-9][0-9,]*(?:\.\d+)?)/)?.[1]);
  const listingId = String(raw?.url ?? '').match(/^https:\/\/www\.pxb7\.com\/product\/(\d+)\/1(?:[?#]|$)/)?.[1] ?? null;
  return {
    listingId,
    productCode: title.match(/【([A-Z0-9]+)】/i)?.[1] ?? null,
    priceCny,
    title,
    rawText: text,
    server: server(header),
    url: raw?.url ?? null,
    status: {
      guarantee: /找回包赔|终身包赔|\d+年包赔/.test(header),
      officialVerification: /官方验号|官方截图/.test(header),
      verifiedAt: text.match(/该账号于(\d{4}年\d{2}月\d{2}日)完成验号/)?.[1] ?? null,
      publishedAt: null,
      listedAtRaw: header.match(/\d+(?:分钟|小时|天)内发布/)?.[0] ?? null,
    },
  };
}

function titleAssets(title, label, kind) {
  const match = title.match(new RegExp(`${label}[：:]([^；;\\n]+)`));
  if (!match) return [];
  return match[1].split(/[，,、]/).map(clean).filter(Boolean).flatMap((entry) => {
    const parsed = entry.match(/^(?:(\d+)(?:命|觉醒|阶)|精(\d+))?(.+)$/);
    if (!parsed) return [];
    const advancement = number(parsed[1] ?? parsed[2]);
    return [{ name: clean(parsed[3]).replace(/^满(?:命|觉醒|阶)/, ''), kind, advancement, cornerMark: advancement == null ? '' : String(advancement), evidenceSource: 'title_text' }];
  });
}

export function parsePxb7GameDetail(operation, raw) {
  const identity = pxb7DetailIdentity(raw);
  const wuwa = operation === 'pxb7/wuthering-waves-detail';
  const characterLabel = wuwa ? '五星角色' : 'S级角色';
  const equipmentLabel = wuwa ? '五星武器' : 'S级弧盘';
  const assetsFor = (label, kind) => {
    const cards = (raw?.assetCards ?? []).filter((card) => clean(card.section) === label || (label === 'S级弧盘' && clean(card.section) === 'S级武器')).flatMap((card) => {
      const lines = String(card.text ?? '').split('\n').map(clean).filter(Boolean);
      const levelIndex = lines.findIndex((line) => /^Lv\.\s*\d+/i.test(line));
      const name = levelIndex >= 0 ? lines[levelIndex + 1] : null;
      if (!name) return [];
      const mark = lines.slice(0, levelIndex).find((line) => /^\d+(?:\+\d+)?$/.test(line)) ?? '';
      return [{ name, kind, advancement: mark ? number(mark.split('+')[0]) : null, cornerMark: mark, evidenceSource: 'dom_asset_card' }];
    });
    return cards.length ? cards : titleAssets(identity.title, label, kind);
  };
  const assets = [...assetsFor(characterLabel, 'character'), ...assetsFor(equipmentLabel, wuwa ? 'weapon' : 'arc')];
  return [{
    ...identity,
    assets,
    status: {
      ...identity.status,
      assetCount: assets.length,
      sourceStatus: identity.listingId && identity.priceCny != null && assets.some((asset) => asset.kind === 'character') ? 'success' : 'partial',
    },
  }];
}
