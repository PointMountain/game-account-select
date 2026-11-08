import { normalizePzdsList } from './arknights-parsers.mjs';
import { normalizePxb7GameList, parsePxb7GameDetail } from './pxb7-parsers.mjs';

const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function parsePzdsDetail(raw) {
  const details = raw?.details ?? {};
  const metadataAssets = Array.isArray(raw?.assets) ? raw.assets : [];
  const domAssets = Array.isArray(raw?.domAssets) ? raw.domAssets : [];
  const assets = [...new Map([...metadataAssets, ...domAssets]
    .map((asset) => [clean(asset?.name), {
      name: clean(asset?.name),
      code: clean(asset?.code),
      cornerMark: clean(asset?.cornerMark),
      evidenceSource: clean(asset?.evidenceSource),
    }])
    .filter(([name]) => name)).values()];
  const text = clean([details.title, details.description, details.simpleMessage, raw?.text].filter(Boolean).join('\n')).replace(/\n+/g, '\n');
  const officialVerification = /官方/.test(clean(details.shotTypeName));
  return [{
    listingId: clean(details.goodsNo),
    priceCny: Number.isFinite(Number(details.price)) ? Number(details.price) : null,
    title: clean(details.title || raw?.title),
    rawText: text,
    server: /B服/i.test(text) ? 'B服' : /渠道服/.test(text) ? '渠道服' : /官服|官方/.test(text) ? '官服' : null,
    assets,
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
      assetCount: assets.length,
      sourceStatus: details.goodsNo && details.price != null && (assets.length || text.length > 80) ? 'success' : 'partial',
    },
    url: raw?.url,
  }];
}

export function parseGenericGameOperation(operation, raw, options = {}) {
  if (/^pxb7\/(wuthering-waves|neverness-to-everness)-list$/.test(operation)) return normalizePxb7GameList(raw, options);
  if (/^pxb7\/(wuthering-waves|neverness-to-everness)-detail$/.test(operation)) return parsePxb7GameDetail(operation, raw);
  if (operation.startsWith('pzds/') && operation.endsWith('-list')) return normalizePzdsList(raw, options);
  if (operation.startsWith('pzds/') && operation.endsWith('-detail')) return parsePzdsDetail(raw);
  throw new Error(`Unsupported generic game operation: ${operation}`);
}
