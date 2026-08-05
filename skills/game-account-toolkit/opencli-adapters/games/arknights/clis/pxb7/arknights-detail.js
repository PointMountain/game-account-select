import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';

const HOST = 'www.pxb7.com';
const clean = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

function normalizeUrl(value) {
  const input = clean(value);
  if (/^https:\/\/www\.pxb7\.com\/product\/\d+\/1(?:[?#].*)?$/i.test(input)) return input;
  if (/^\d{10,}$/.test(input)) return `https://${HOST}/product/${input}/1`;
  throw new CliError('INVALID_ARGUMENT', 'pxb7 arknights-detail requires a pxb7 product URL or numeric product id');
}

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
  return match ? match[1].split(/[，,、]/).map(clean).filter(Boolean) : [];
}

function tags(text, patterns) {
  const values = [];
  for (const pattern of patterns) {
    const match = String(text ?? '').match(pattern);
    if (match) values.push(clean(match[0]));
  }
  return [...new Set(values)];
}

function parseDetail(raw) {
  const text = clean(raw.text).replace(/\n+/g, '\n');
  const operatorLabels = ['精一六星', '六星干员', '联动干员', '时装'];
  const listingId = (raw.url.match(/\/product\/(\d+)\/1/) || [])[1] ?? null;
  const productCode = (text.match(/【([A-Z0-9]{6,})】/) || [])[1] ?? null;
  const serverTag = tags(text, [/官方账号/, /B服/, /渠道服/])[0] ?? null;
  const server = serverTag === '官方账号' ? '官服' : serverTag;
  const operators = {
    elite2: section(text, '精二六星', operatorLabels),
    elite1: section(text, '精一六星', ['六星干员', '联动干员', '时装']),
    sixStar: section(text, '六星干员', ['联动干员', '时装']),
    collab: section(text, '联动干员', ['时装']),
  };
  const elite2 = new Set(operators.elite2);
  const elite1 = new Set(operators.elite1);
  const verificationImageUrls = [...new Set((Array.isArray(raw.images) ? raw.images : [])
    .map((image) => clean(image?.src))
    .filter((src) => /^https:\/\/public-image\.pxb7\.com\/AutoGame\/AutoGameMainContent\//i.test(src)))];
  return {
    listingId,
    priceCny: numberMatch(text, /￥\s*([0-9][0-9,]*(?:\.\d+)?)/),
    server,
    riskFacts: [
      ...tags(text, [/找回包赔/, /终身包赔/, /\d+年包赔/]),
      ...tags(text, [/官方验号/, /官方截图/, /平台验号/]),
      ...tags(text, [/换绑[^。；\n]{0,60}/, /未注册鹰角账号[^。；\n]{0,40}/, /实名[^。；\n]{0,40}/]),
    ],
    status: {
      productCode,
      verifiedAt: (text.match(/该账号于(\d{4}年\d{2}月\d{2}日)完成验号/) || [])[1] ?? null,
      sourceStatus: operators.sixStar.length || operators.elite2.length ? 'success' : 'partial',
    },
    counts: {
      level: numberMatch(text, /(\d+)级/),
      sixStar: numberMatch(text, /(\d+)六星/),
      elite2: numberMatch(text, /(\d+)精二/),
      elite1: numberMatch(text, /(\d+)精一/),
      collab: numberMatch(text, /联动干员数量[：:]\s*(\d+)/),
      skins: numberMatch(text, /时装数量[：:]\s*(\d+)/),
    },
    resources: {
      orundum: numberMatch(text, /合成玉数量[：:]\s*(\d+)/),
      originitePrime: numberMatch(text, /源石数量[：:]\s*(\d+)/),
    },
    operatorNames: operators.sixStar,
    elite2OperatorNames: operators.elite2,
    elite1OperatorNames: operators.elite1,
    operatorProgression: operators.sixStar.map((name) => ({
      name,
      elite: elite2.has(name) ? 2 : elite1.has(name) ? 1 : null,
      mastery: null,
      module: null,
      evidence: elite2.has(name) ? 'platform_text_elite2' : elite1.has(name) ? 'platform_text_elite1' : 'elite_status_not_exposed',
    })),
    collabOperatorNames: operators.collab,
    skins: section(text, '时装', []),
    verificationImageUrls,
    progressionEvidence: {
      elite: operators.elite2.length || operators.elite1.length ? 'platform_text_verified' : 'not_exposed',
      mastery: 'not_exposed',
      module: 'not_exposed',
      verification_images: verificationImageUrls.length ? 'available' : 'not_exposed',
      verification_image_count: verificationImageUrls.length,
    },
    url: raw.url,
  };
}

cli({
  site: 'pxb7',
  name: 'arknights-detail',
  description: '螃蟹明日方舟账号详情事实字段（干员、资源、时装、验号与换绑）',
  access: 'read',
  example: 'opencli pxb7 arknights-detail https://www.pxb7.com/product/2280754884445079984/1 -f json',
  domain: HOST,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'input', type: 'string', required: true, positional: true, help: 'pxb7 商品详情 URL 或数字商品 ID' },
    { name: 'wait', type: 'int', default: 3, help: '页面加载等待秒数' },
  ],
  columns: ['listingId', 'priceCny', 'server', 'riskFacts', 'status', 'counts', 'resources', 'operatorNames', 'elite2OperatorNames', 'elite1OperatorNames', 'operatorProgression', 'collabOperatorNames', 'skins', 'verificationImageUrls', 'progressionEvidence', 'url'],
  func: async (page, args) => {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page is required for pxb7 arknights-detail');
    const url = normalizeUrl(args.input);
    const waitSeconds = Math.max(1, Math.min(Number(args.wait) || 3, 10));
    await page.goto(url, { waitUntil: 'load', settleMs: 1800 });
    await page.wait(waitSeconds);
    const raw = await page.evaluate(`(() => ({
      url: location.href,
      title: document.title || '',
      text: document.body ? document.body.innerText || '' : '',
      images: Array.from(document.images || []).map((image) => ({
        src: image.currentSrc || image.src || '',
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0
      })).filter((image) => image.width >= 600 || image.height >= 600)
    }))()`);
    if (/验证|滑块|访问过于频繁|安全校验/.test(raw.text || '') && !/明日方舟|账号详情|商品亮点/.test(raw.text || '')) {
      throw new CliError('ANTI_BOT', 'pxb7 returned an anti-bot or verification page in the connected browser');
    }
    const row = parseDetail(raw);
    if (!row.listingId || row.priceCny == null) throw new CliError('NO_DATA', `Could not parse pxb7 Arknights detail from ${url}`);
    return [row];
  },
});
