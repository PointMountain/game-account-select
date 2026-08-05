#!/usr/bin/env node

const PRESETS = {
  balanced: { rarity: 20, combat: 25, progression: 15, resources: 15, skins: 5, price_efficiency: 20 },
  collector: { rarity: 55, combat: 10, progression: 10, resources: 10, skins: 5, price_efficiency: 10 },
  combat: { rarity: 5, combat: 40, progression: 30, resources: 10, skins: 0, price_efficiency: 15 },
  resource: { rarity: 10, combat: 10, progression: 10, resources: 50, skins: 0, price_efficiency: 20 },
};

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function amount(value, unit = '') {
  const base = Number(value);
  if (!Number.isFinite(base)) return null;
  if (/万|w/i.test(unit)) return Math.round(base * 10000);
  if (/千|k/i.test(unit)) return Math.round(base * 1000);
  return Math.round(base);
}

function parseOrundumConstraint(text, assumptions) {
  const unit = '(万|w|千|k)?';
  const number = '(\\d+(?:\\.\\d+)?)';
  const patterns = {
    rangeAfter: new RegExp(`合成玉[^0-9]{0,4}${number}\\s*${unit}\\s*(?:-|~|—|至|到)\\s*${number}\\s*${unit}`, 'i'),
    rangeBefore: new RegExp(`${number}\\s*${unit}\\s*(?:-|~|—|至|到)\\s*${number}\\s*${unit}\\s*(?:的)?合成玉`, 'i'),
    approximateAfter: new RegExp(`合成玉[^0-9]{0,4}${number}\\s*${unit}\\s*(?:左右|上下|附近|前后)`, 'i'),
    approximateBefore: new RegExp(`${number}\\s*${unit}\\s*(?:左右|上下|附近|前后)\\s*(?:的)?合成玉`, 'i'),
    minimumAfter: new RegExp(`合成玉[^0-9]{0,4}(?:至少|不少于)?\\s*${number}\\s*${unit}\\s*(?:以上|起|至少|不少于)`, 'i'),
    minimumBefore: new RegExp(`(?:至少|不少于)?\\s*${number}\\s*${unit}\\s*(?:以上|起|至少|不少于)\\s*(?:的)?合成玉`, 'i'),
  };
  for (const pattern of [patterns.rangeAfter, patterns.rangeBefore]) {
    const match = text.match(pattern);
    if (!match) continue;
    const sharedUnit = match[4] || match[2] || '';
    const first = amount(match[1], match[2] || sharedUnit);
    const second = amount(match[3], match[4] || sharedUnit);
    return { hard_condition: `orundum:${Math.min(first, second)}-${Math.max(first, second)}`, matched_text: match[0] };
  }
  for (const pattern of [patterns.approximateAfter, patterns.approximateBefore]) {
    const match = text.match(pattern);
    if (!match) continue;
    const target = amount(match[1], match[2]);
    assumptions.push('“合成玉左右”按目标值上下 20% 冻结为本轮资源硬条件，不写入永久默认值');
    return { hard_condition: `orundum:${Math.round(target * 0.8)}-${Math.round(target * 1.2)}`, matched_text: match[0] };
  }
  for (const pattern of [patterns.minimumAfter, patterns.minimumBefore]) {
    const match = text.match(pattern);
    if (!match) continue;
    const minimum = amount(match[1], match[2]);
    return { hard_condition: `orundum:${minimum}+`, matched_text: match[0] };
  }
  return { hard_condition: null, matched_text: null };
}

function parseBudget(text, assumptions) {
  const range = text.match(/(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?\s*(?:-|~|—|至|到)\s*(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?/i);
  if (range) {
    const sharedUnit = range[4] || range[2] || '';
    const min = amount(range[1], range[2] || sharedUnit);
    const max = amount(range[3], range[4] || sharedUnit);
    return {
      target: Math.round((min + max) / 2),
      primary_min: Math.min(min, max),
      primary_max: Math.max(min, max),
      flex_min: Math.min(min, max),
      flex_max: Math.max(min, max),
      interpretation: 'explicit_range',
    };
  }

  const approximate = text.match(/(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?\s*(?:左右|上下|附近|前后)/i);
  if (approximate) {
    const target = amount(approximate[1], approximate[2]);
    assumptions.push('“左右”按目标价上下 20% 为主区间、上下 30% 为价格浮动区间；查询前展示后自动冻结');
    return {
      target,
      primary_min: Math.max(0, Math.round(target * 0.8)),
      primary_max: Math.round(target * 1.2),
      flex_min: Math.max(0, Math.round(target * 0.7)),
      flex_max: Math.round(target * 1.3),
      interpretation: 'approximate_target',
    };
  }

  const approximatePrefix = text.match(/(?:约|大约|大概|差不多)\s*(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?/i);
  if (approximatePrefix) {
    const target = amount(approximatePrefix[1], approximatePrefix[2]);
    assumptions.push('“约”按目标价上下 20% 为主区间、上下 30% 为价格浮动区间；查询前展示后自动冻结');
    return {
      target,
      primary_min: Math.max(0, Math.round(target * 0.8)),
      primary_max: Math.round(target * 1.2),
      flex_min: Math.max(0, Math.round(target * 0.7)),
      flex_max: Math.round(target * 1.3),
      interpretation: 'approximate_target',
    };
  }

  const ceiling = text.match(/(?:预算(?:是|为)?\s*)?(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?\s*(?:以内|以下|封顶|不超过)/i);
  if (ceiling) {
    const max = amount(ceiling[1], ceiling[2]);
    return { target: max, primary_min: 0, primary_max: max, flex_min: 0, flex_max: max, interpretation: 'hard_ceiling' };
  }

  const budget = text.match(/(?:预算|价位)\s*(?:是|为|约)?\s*(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?/i);
  if (budget) {
    const target = amount(budget[1], budget[2]);
    assumptions.push('未声明“左右”或明确范围，暂按预算上限理解');
    return { target, primary_min: 0, primary_max: target, flex_min: 0, flex_max: target, interpretation: 'stated_budget' };
  }

  return { target: null, primary_min: null, primary_max: null, flex_min: null, flex_max: null, interpretation: 'missing' };
}

function detectObjective(text) {
  const signals = {
    collector: /限定|联动|稀缺|收藏|保值|绝版/.test(text),
    combat: /战力|强度|高难|开荒|推图|肉鸽|危机合约|养成|练度|(?:队伍|阵容).{0,8}(?:成熟|成型|完整|能推图)/.test(text),
    resource: /资源|抽数|合成玉|源石|寻访|黄票/.test(text),
    skins: /皮肤|时装/.test(text),
    price: /性价比|便宜|划算|低价/.test(text),
  };
  const primary = ['collector', 'combat', 'resource'].filter((key) => signals[key]);
  if (primary.length === 1 && !signals.skins && !signals.price) return { objective: primary[0], signals };
  if (primary.length === 0 && !signals.skins && !signals.price) return { objective: 'balanced', signals };
  return { objective: 'custom', signals };
}

function weightsFor(objective, signals) {
  const base = { ...(PRESETS[objective] ?? PRESETS.balanced) };
  if (objective !== 'custom') return base;

  const weights = { rarity: 0, combat: 0, progression: 0, resources: 0, skins: 0, price_efficiency: 0 };
  if (signals.collector) Object.assign(weights, { rarity: weights.rarity + 45, progression: weights.progression + 5, skins: weights.skins + 10, price_efficiency: weights.price_efficiency + 10 });
  if (signals.combat) Object.assign(weights, { combat: weights.combat + 40, progression: weights.progression + 30, resources: weights.resources + 10, price_efficiency: weights.price_efficiency + 15 });
  if (signals.resource) Object.assign(weights, { rarity: weights.rarity + 5, progression: weights.progression + 5, resources: weights.resources + 50, price_efficiency: weights.price_efficiency + 20 });
  if (signals.skins) weights.skins += 30;
  if (signals.price) weights.price_efficiency += 35;
  return normalizePriorities(weights);
}

export function normalizePriorities(priorities) {
  const keys = ['rarity', 'combat', 'progression', 'resources', 'skins', 'price_efficiency'];
  const values = Object.fromEntries(keys.map((key) => [key, Math.max(0, Number(priorities?.[key]) || 0)]));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...PRESETS.balanced };

  const normalized = Object.fromEntries(keys.map((key) => [key, Number(((values[key] / total) * 100).toFixed(4))]));
  const roundedTotal = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const adjustmentKey = keys.reduce((best, key) => values[key] > values[best] ? key : best, keys[0]);
  normalized[adjustmentKey] = Number((normalized[adjustmentKey] + 100 - roundedTotal).toFixed(4));
  return normalized;
}

function captureList(text, leadPattern) {
  const match = text.match(leadPattern);
  if (!match) return [];
  return match[1]
    .split(/、|，|,|和|以及|\/|\s+/)
    .map((item) => item.replace(/(?:的号|账号|干员|角色)$/g, '').trim())
    .filter(Boolean);
}

function classifyExclusions(text, assumptions) {
  const captured = captureList(text, /(?:不要|排除|不能有|不考虑)\s*([^，。；;]+)/);
  const accountRecencyPattern = /(?:账号|新号|老号|陈年|仓库号|仓库|阵容断代|早期收藏|近期活跃)/;
  const softPreferences = [];
  const exclusions = [];

  for (const item of captured) {
    if (!accountRecencyPattern.test(item)) {
      exclusions.push(item);
      continue;
    }
    softPreferences.push({
      type: 'account_recency',
      preference: /(?:陈年|老号|仓库|阵容断代|早期收藏)/.test(item) ? 'avoid_stale_roster' : 'manual_account_recency_check',
      source_text: item,
      verification: 'roster_recency_and_manual_account_history',
    });
  }

  if (softPreferences.length) {
    assumptions.push('账号新度、活跃度或“陈年仓库号”无法由干员名单直接证明，仅记录为软偏好，不转成干员排除硬条件；付款前结合近期阵容与账号历史人工复核');
  }
  return { exclusions, softPreferences };
}

function parseBudgetExpansion(text, budget) {
  const explicitEnabled = /(?:找不到|没有|无).{0,16}(?:可以|可|允许).{0,8}(?:超预算|突破.{0,4}(?:预算|价位|价格).{0,4}(?:上限|范围)|提高.{0,4}(?:预算|额度)|加预算)|(?:可以|可|允许).{0,8}(?:超预算|突破.{0,4}(?:预算|价位|价格).{0,4}(?:上限|范围)|提高.{0,4}(?:预算|额度)|加预算)|预算外.{0,8}(?:也|仍).{0,4}(?:可以|可接受)/.test(text);
  const explicitlyStrict = /(?:严格|只|仅).{0,8}(?:预算|价位|价格).{0,8}(?:内|以内|范围内)|(?:绝不|不得|不能|不可|不要).{0,6}(?:超预算|突破预算|超过.{0,4}(?:预算|价位|价格)|看预算外)|最高不超过/.test(text);
  const explicitMax = text.match(/(?:超预算(?:最高|上限)?(?:到|至)?|最高(?:加|提|放宽)到|预算(?:可|可以)?提高到)\s*(\d+(?:\.\d+)?)\s*(万|千|k)?\s*(?:元|块)?/i);
  const hasBudget = budget?.target != null || budget?.primary_max != null;
  const enabled = hasBudget && !explicitlyStrict;
  return {
    enabled,
    trigger: 'no_in_budget_hard_condition_match',
    mode: 'bidirectional_first_satisfying_band',
    directions: enabled ? ['lower', 'higher'] : [],
    max_price: explicitMax ? amount(explicitMax[1], explicitMax[2]) : null,
    authorization: explicitlyStrict ? 'disabled_by_user' : explicitEnabled ? 'user_explicit' : enabled ? 'default_fallback' : 'not_applicable',
    explicitly_strict: explicitlyStrict,
  };
}

export function parseSelectionProfile(input) {
  const sourceText = cleanText(input);
  const assumptions = [];
  const orundumConstraint = parseOrundumConstraint(sourceText, assumptions);
  const budgetText = orundumConstraint.matched_text ? sourceText.replace(orundumConstraint.matched_text, ' ') : sourceText;
  const budget = parseBudget(budgetText, assumptions);
  const budgetExpansion = parseBudgetExpansion(sourceText, budget);
  const { objective, signals } = detectObjective(sourceText);
  const priorities = normalizePriorities(weightsFor(objective, signals));
  const mustHave = captureList(sourceText, /(?:必须|一定要|务必)(?:有|带|包含)\s*([^，。；;]+)/);
  const { exclusions, softPreferences } = classifyExclusions(sourceText, assumptions);
  const serverPreferences = ['官服', 'B服', '渠道服'].filter((server) => sourceText.includes(server));
  const hardConditions = [];
  if (/(?:必须|只要|仅限|只考虑)\s*官服/.test(sourceText)) hardConditions.push('server:官服');
  if (/(?:必须|只要|仅限|只考虑)\s*B服/i.test(sourceText)) hardConditions.push('server:B服');
  if (/必须(?:有|带)?(?:官方)?验号|只要验号/.test(sourceText)) hardConditions.push('official_verification:true');
  if (/必须(?:有|带)?(?:找回)?包赔|只要包赔/.test(sourceText)) hardConditions.push('guarantee:required');
  if (/(?:联动(?:干员|角色)?).{0,4}(?:全齐|齐全|全有|全收集|全图鉴)|(?:全齐|齐全|全有|全收集|全图鉴).{0,4}联动/.test(sourceText)) {
    hardConditions.push('collab_complete:true');
  }
  if (orundumConstraint.hard_condition) hardConditions.push(orundumConstraint.hard_condition);

  let riskTolerance = 'unknown';
  if (/低风险|安全优先|风险低|不接受找回/.test(sourceText)) riskTolerance = 'low';
  else if (/可以接受风险|不介意风险|高风险也行/.test(sourceText)) riskTolerance = 'high';
  else if (/风险适中|中等风险/.test(sourceText)) riskTolerance = 'medium';

  const platforms = [];
  if (/螃蟹|pxb7/i.test(sourceText)) platforms.push('pxb7');
  if (/盼之|pzds/i.test(sourceText)) platforms.push('pzds');
  if (/交易猫/.test(sourceText)) platforms.push('jiaoyimao');
  if (/淘手游/.test(sourceText)) platforms.push('taoshouyou');
  if (/闲鱼/.test(sourceText)) platforms.push('xianyu');

  const clarificationRequired = [];
  if (budget.target == null && budget.primary_max == null) clarificationRequired.push('budget');
  if (objective === 'balanced' && !signals.price) clarificationRequired.push('objective');
  const primaryObjectiveCount = ['collector', 'combat', 'resource'].filter((key) => signals[key]).length;
  const conflictResolvedInText = /兼顾|都要|同等|均衡|平衡|为主|优先|其次|第一|第二|相对|好一点|稍好|然后/.test(sourceText);
  const structuredCompositeRequest = hardConditions.length >= 2;
  if (primaryObjectiveCount > 1 && !conflictResolvedInText && !structuredCompositeRequest) clarificationRequired.push('objective_conflict');

  if (serverPreferences.length === 0) assumptions.push('未指定区服，区服仅作为风险事实展示，不做硬过滤');
  if (riskTolerance === 'unknown') assumptions.push('未指定风险容忍度，使用中性风险罚分，不做风险硬过滤');
  if (budgetExpansion.enabled && budgetExpansion.max_price == null) {
    assumptions.push('预算附近无硬条件完整项时，默认向更低价和更高价逐档低频扩展，各自在首个精确满足价档停止；明确要求严格预算时才禁用');
  }

  return {
    source_text: sourceText,
    budget,
    budget_expansion: budgetExpansion,
    objective,
    priorities,
    must_have: mustHave,
    exclusions,
    soft_preferences: softPreferences,
    server_preferences: serverPreferences,
    hard_conditions: hardConditions,
    risk_tolerance: riskTolerance,
    platforms,
    assumptions,
    clarification_required: clarificationRequired,
    confirmation_required: clarificationRequired.length > 0,
    persistence_scope: 'run_only',
  };
}

function usage() {
  console.error('Usage: node parse-selection-profile.mjs --request <text> [--json]');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === '--request');
  const inline = args.find((arg) => arg.startsWith('--request='));
  const request = inline ? inline.slice('--request='.length) : index >= 0 ? args[index + 1] : args.join(' ');
  if (!request) {
    usage();
    process.exit(2);
  }
  console.log(JSON.stringify(parseSelectionProfile(request), null, 2));
}
