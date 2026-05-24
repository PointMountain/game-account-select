#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'zenless-zone-zero-validation-sample.json'), 'utf8'));
const signatureEngineDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'signature-engines.json'), 'utf8'));

const canonicalAliases = new Map();
function addAliases(canonical, aliases) {
  canonicalAliases.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) canonicalAliases.set(alias.toLowerCase(), canonical);
}

addAliases('miyabi', ['Miyabi', '星见雅', '雅']);
addAliases('yixuan', ['Yixuan', '仪玄']);
addAliases('ye_shunguang', ['Ye Shunguang', 'Yeshunguang', '叶瞬光', '叶曙光', '小光']);
addAliases('yuzuha', ['Fubao Yuzuha', 'Yuzuha', '浮波柚叶', '柚叶', '右叶', '右翼']);
addAliases('astra_yao', ['Astra Yao', '耀嘉音', '耀佳音', '嘉音', '佳音']);
addAliases('soukaku', ['Soukaku', '苍角']);
addAliases('yanagi', ['Yanagi', '月城柳', '柳']);
addAliases('lycaon', ['Lycaon', '莱卡恩', '狼']);
addAliases('nicole', ['Nicole', '妮可']);
addAliases('burnice', ['Burnice', '柏妮思']);
addAliases('liuyin', ['Liuyin', '琉音']);
addAliases('ju_fufu', ['Ju Fufu', '橘福福']);
addAliases('qingyi', ['Qingyi', '青衣']);
addAliases('lucia', ['Lucia', '卢西娅']);
addAliases('pan_yinhu', ['Pan Yinhu', '潘引壶']);
addAliases('zhao', ['Zhao', '照']);
addAliases('qianxia', ['Qianxia', '千夏']);
addAliases('nangong_yu', ['Nangong Yu', 'Nangong', '南宫羽', '南宫']);
addAliases('xixifu', ['Xixifu', '希希芙']);
addAliases('sid', ['Sid', 'Sidhe', '席德', '希德']);
addAliases('airi', ['Airi', '爱芮']);
addAliases('ellen', ['Ellen', '艾莲']);
addAliases('zhu_yuan', ['Zhu Yuan', '朱鸢']);
addAliases('jane', ['Jane', '简']);
addAliases('alice', ['Alice', '爱丽丝']);
addAliases('caesar', ['Caesar', '凯撒']);
addAliases('lighter', ['Lighter', '莱特']);
addAliases('evelyn', ['Evelyn', '伊芙琳']);
addAliases('trigger', ['Trigger', '扳机']);
addAliases('vivian', ['Vivian', '薇薇安']);
addAliases('nekomata', ['Nekomata', '猫又']);
addAliases('soldier_11', ['Soldier 11', '11号']);
addAliases('koleda', ['Koleda', '珂蕾妲']);
addAliases('rina', ['Rina', '丽娜']);
addAliases('grace', ['Grace', '格莉丝']);
for (const entry of signatureEngineDb.entries ?? []) {
  addAliases(entry.agent, [entry.agent, ...(entry.agent_names ?? [])]);
}

const highValueLimited = new Set([
  'ellen', 'zhu_yuan', 'qingyi', 'jane', 'caesar', 'burnice', 'yanagi',
  'lighter', 'miyabi', 'astra_yao', 'evelyn', 'trigger', 'vivian',
  'yixuan', 'ye_shunguang', 'yuzuha', 'liuyin', 'ju_fufu', 'lucia',
  'qianxia', 'zhao', 'nangong_yu', 'xixifu', 'sid', 'airi'
]);
const standardAgents = new Set(['nekomata', 'soldier_11', 'koleda', 'lycaon', 'rina', 'grace']);
const voidHunterCores = ['miyabi', 'yixuan', 'ye_shunguang'];
const directElectricTeam = ['xixifu', 'sid', 'astra_yao'];
const delusionAngelsTrio = ['qianxia', 'airi', 'nangong_yu'];
const vivianDisorderPartners = ['jane', 'burnice', 'yanagi', 'alice', 'grace'];
const agentLabels = new Map([
  ['miyabi', '星见雅'],
  ['yixuan', '仪玄'],
  ['ye_shunguang', '叶瞬光'],
  ['yuzuha', '浮波柚叶'],
  ['soukaku', '苍角'],
  ['yanagi', '月城柳'],
  ['lycaon', '莱卡恩'],
  ['astra_yao', '耀嘉音'],
  ['nicole', '妮可'],
  ['burnice', '柏妮思'],
  ['liuyin', '琉音'],
  ['ju_fufu', '橘福福'],
  ['qingyi', '青衣'],
  ['lucia', '卢西娅'],
  ['pan_yinhu', '潘引壶'],
  ['zhao', '照'],
  ['qianxia', '千夏'],
  ['nangong_yu', '南宫羽'],
  ['xixifu', '希希芙'],
  ['sid', '席德'],
  ['airi', '爱芮'],
  ['vivian', '薇薇安'],
  ['jane', '简'],
  ['alice', '爱丽丝'],
  ['grace', '格莉丝']
]);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function canonicalAgentName(name) {
  const raw = String(name ?? '').trim();
  return canonicalAliases.get(raw.toLowerCase()) ?? raw.toLowerCase();
}

function cleanEngineName(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/^(?:精\s*\d+|精炼\s*\d+|精煉\s*\d+|Lv\.?\s*\d+)\s*/i, '')
    .replace(/^(?:S级音擎|S級音擎|S级武器|S級武器|音擎|W-Engine|W Engine)\s*[：:]?\s*/i, '')
    .replace(/[。；;，,、]+$/g, '')
    .trim();
}

function normalizeEngineName(value) {
  return cleanEngineName(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・\-_'".:：()（）[\]【】<>《》]/g, '');
}

const signatureEngineEntries = (signatureEngineDb.entries ?? []).map((entry) => ({
  agent: canonicalAgentName(entry.agent),
  names: entry.signature_engines ?? [],
  normalizedNames: new Set((entry.signature_engines ?? []).map(normalizeEngineName).filter(Boolean))
}));

function signatureEntryForEngineName(value) {
  const normalized = normalizeEngineName(value);
  if (!normalized) return null;
  return signatureEngineEntries.find((entry) => entry.normalizedNames.has(normalized)) ?? null;
}

function collectEngineNamesFromValue(value, bucket) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectEngineNamesFromValue(item, bucket);
    return;
  }
  if (typeof value === 'object') {
    for (const key of ['name', 'title', 'engine', 'w_engine', 'wEngine', '音擎', 'weapon']) {
      if (value[key] != null) collectEngineNamesFromValue(value[key], bucket);
    }
    return;
  }
  const text = String(value);
  for (const part of text.split(/[，,、；;|/]/)) {
    const name = cleanEngineName(part);
    if (name && !/^(?:\d+|S级音擎|S級音擎|S级武器|S級武器)$/i.test(name)) bucket.push(name);
  }
}

function extractEngineNamesFromText(text) {
  const names = [];
  const raw = String(text ?? '');
  for (const match of raw.matchAll(/(?:\d+\s*个)?S级(?:音擎|武器)[：:]\s*([^；;\n]+)/g)) {
    collectEngineNamesFromValue(match[1], names);
  }
  return names;
}

function extractEngineNames(assets, listing) {
  const names = [];
  for (const candidate of [
    assets.w_engines,
    assets.wEngines,
    assets.s_w_engines,
    assets.sWEngines,
    assets.s_w_engine_names,
    assets.sWEngineNames,
    listing.w_engines,
    listing.wEngines,
    listing.s_w_engine_names,
    listing.sWEngineNames,
    listing.signature_engines,
    listing.signatureEngines
  ]) {
    collectEngineNamesFromValue(candidate, names);
  }
  names.push(...extractEngineNamesFromText(`${listing.title ?? ''}\n${listing.raw_text ?? ''}`));

  const seen = new Set();
  return names.filter((name) => {
    const normalized = normalizeEngineName(name);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildMatchedSignatureEngineMap(engineNames) {
  const matched = new Map();
  for (const engineName of engineNames) {
    const entry = signatureEntryForEngineName(engineName);
    if (!entry) continue;
    if (!matched.has(entry.agent)) matched.set(entry.agent, []);
    matched.get(entry.agent).push(cleanEngineName(engineName));
  }
  return matched;
}

function labelAgent(id) {
  return agentLabels.get(id) ?? id;
}

function isHighValueLimited(agent) {
  return highValueLimited.has(canonicalAgentName(agent.name)) || agent.category === 'limited';
}

function buildRoster(agents) {
  return new Set(agents.map((agent) => canonicalAgentName(agent.name)));
}

function parseAgentStatus(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value.status ?? value.raw ?? value.text;
    const mindscape = Number(value.mindscape ?? value.dupes ?? value.dupe ?? value.m ?? value.影画);
    const signatureCount = Number(value.signature_engines ?? value.signature_engine_count ?? value.signatureEngineCount ?? value.engine_count ?? value.w_engine_count ?? value.音擎);
    if (Number.isFinite(mindscape) || Number.isFinite(signatureCount)) {
      return {
        mindscape: Number.isFinite(mindscape) ? mindscape : 0,
        signatureCount: Number.isFinite(signatureCount) ? signatureCount : 0,
        raw: raw ?? JSON.stringify(value)
      };
    }
    if (raw !== undefined) return parseAgentStatus(raw);
  }

  const raw = String(value ?? '').trim();
  const match = raw.match(/(\d+)\s*(?:\+\s*(\d+))?/);
  if (!match) return { mindscape: 0, signatureCount: 0, raw };
  return {
    mindscape: Number(match[1]),
    signatureCount: Number(match[2] ?? 0),
    raw
  };
}

function buildAgentStatusMap(assets, listing) {
  const rawStatuses = assets.agent_statuses ?? assets.agentStatuses ?? listing.agentStatuses ?? {};
  const statusMap = new Map();
  for (const [name, value] of Object.entries(rawStatuses)) {
    statusMap.set(canonicalAgentName(name), parseAgentStatus(value));
  }
  return statusMap;
}

function agentMindscapeValue(agentId, agents, statusMap) {
  const status = statusMap.get(agentId);
  if (status && Number.isFinite(status.mindscape)) return status.mindscape;
  const agent = agents.find((item) => canonicalAgentName(item.name) === agentId);
  return Number(agent?.mindscape ?? 0);
}

function signatureCountForAgent(agentId, engines, statusMap, matchedSignatureEngines) {
  const statusCount = Number(statusMap.get(agentId)?.signatureCount ?? 0);
  const engineCount = engines.filter((engine) => canonicalAgentName(engine.signature_for) === agentId).length;
  const nameMatchedCount = matchedSignatureEngines.get(agentId)?.length ?? 0;
  return Math.max(statusCount, engineCount, nameMatchedCount);
}

function hasInvestment(agentId, agents, engines, statusMap, matchedSignatureEngines, minMindscape, minSignatureCount) {
  return agentMindscapeValue(agentId, agents, statusMap) >= minMindscape
    && signatureCountForAgent(agentId, engines, statusMap, matchedSignatureEngines) >= minSignatureCount;
}

function hasSignature(agentId, agents, engines, statusMap, matchedSignatureEngines) {
  return signatureCountForAgent(agentId, engines, statusMap, matchedSignatureEngines) > 0;
}

function pairOptionsForCore(core, roster) {
  const specs = {
    miyabi: [
      { primary: ['yuzuha'], secondary: ['nangong_yu', 'lycaon', 'soukaku'], tier: 'preferred' }
    ],
    yixuan: [
      { primary: ['lucia'], secondary: ['ju_fufu', 'liuyin'], tier: 'preferred' }
    ],
    ye_shunguang: [
      { primary: ['zhao'], secondary: ['astra_yao', 'liuyin'], tier: 'preferred' }
    ]
  };

  const options = [];
  for (const spec of specs[core] ?? []) {
    for (const primary of spec.primary) {
      if (!roster.has(primary)) continue;
      for (const secondary of spec.secondary) {
        if (!roster.has(secondary) || primary === secondary) continue;
        options.push({ core, members: [primary, secondary], tier: spec.tier });
      }
    }
  }
  return options;
}

function bestThreeVoidHunterPlan(roster) {
  const hasAllVoidHunters = voidHunterCores.every((core) => roster.has(core));
  if (!hasAllVoidHunters) return { hasAllVoidHunters: false, completeTeams: 0, preferredTeams: 0, assignments: [] };

  let best = { completeTeams: -1, preferredTeams: -1, assignments: [] };
  function visit(index, used, assignments, preferredTeams) {
    if (index === voidHunterCores.length) {
      const completeTeams = assignments.filter((assignment) => assignment.members.length === 2).length;
      if (
        completeTeams > best.completeTeams
        || (completeTeams === best.completeTeams && preferredTeams > best.preferredTeams)
      ) {
        best = { completeTeams, preferredTeams, assignments };
      }
      return;
    }

    const core = voidHunterCores[index];
    const options = pairOptionsForCore(core, roster).filter((option) => option.members.every((member) => !used.has(member)));
    for (const option of options) {
      const nextUsed = new Set(used);
      for (const member of option.members) nextUsed.add(member);
      visit(index + 1, nextUsed, [...assignments, option], preferredTeams + (option.tier === 'preferred' ? 1 : 0));
    }
    visit(index + 1, used, [...assignments, { core, members: [], tier: 'missing' }], preferredTeams);
  }

  visit(0, new Set(voidHunterCores), [], 0);
  return { hasAllVoidHunters: true, ...best };
}

function describeThreeTeamPlan(plan) {
  return plan.assignments
    .map((assignment) => {
      const core = labelAgent(assignment.core);
      return assignment.members.length === 2
        ? `${core}+${assignment.members.map(labelAgent).join('+')}`
        : `${core}: missing independent teammates`;
    })
    .join('; ');
}

function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const agents = assets.agents ?? [];
  const engines = assets.w_engines ?? [];
  const resources = assets.resources ?? {};
  const risk = assets.risk ?? {};
  const rawText = `${listing.title ?? ''}\n${listing.raw_text ?? ''}`;
  const roster = buildRoster(agents);
  const statusMap = buildAgentStatusMap(assets, listing);
  const engineNames = extractEngineNames(assets, listing);
  const matchedSignatureEngines = buildMatchedSignatureEngineMap(engineNames);
  const highlights = [];
  const concerns = [];
  const missingFields = [];

  let agentScore = 0;
  let standardScore = 0;
  for (const agent of agents) {
    if (isHighValueLimited(agent)) {
      agentScore += 8 + Math.min(Number(agent.mindscape ?? 0), 1);
      highlights.push(`${agent.name} is a limited S-rank core`);
    } else if (standardAgents.has(canonicalAgentName(agent.name)) || agent.category === 'standard') {
      standardScore += Math.min(3, 1 + Math.floor(Number(agent.mindscape ?? 0) / 3));
      concerns.push(`${agent.name} is standard/high-mindscape low priority compared with limited cores`);
    } else {
      agentScore += 2;
      concerns.push(`${agent.name} is not covered by the current snapshot`);
    }
  }
  agentScore = clamp(agentScore + standardScore, 0, 35);

  let engineScore = 0;
  const scoredSignatureAgents = new Set();
  for (const engine of engines) {
    const signatureFor = canonicalAgentName(engine.signature_for);
    const engineName = cleanEngineName(engine.name ?? engine.title ?? engine.engine ?? engine.w_engine ?? '');
    const inferredSignatureFor = signatureEntryForEngineName(engineName)?.agent;
    const matchedAgent = engine.signature_for ? signatureFor : inferredSignatureFor;
    if (matchedAgent && roster.has(matchedAgent) && highValueLimited.has(matchedAgent)) {
      engineScore += 6;
      scoredSignatureAgents.add(matchedAgent);
      highlights.push(engine.signature_for
        ? `${engine.signature_for} has signature W-Engine`
        : `${labelAgent(matchedAgent)} has signature W-Engine (${engineName}) from S-rank W-Engine list`);
    } else if (matchedAgent && roster.has(matchedAgent)) {
      engineScore += 3;
      scoredSignatureAgents.add(matchedAgent);
      highlights.push(`${labelAgent(matchedAgent)} has signature W-Engine (${engineName}) from S-rank W-Engine list`);
    } else if (engine.signature_for) {
      engineScore += 3;
      scoredSignatureAgents.add(signatureFor);
    } else {
      engineScore += 1;
      concerns.push('Generic S W-Engine has limited value without a matched core');
    }
  }
  for (const [agentId, names] of matchedSignatureEngines.entries()) {
    if (!roster.has(agentId) || scoredSignatureAgents.has(agentId)) continue;
    engineScore += highValueLimited.has(agentId) ? 6 : 3;
    scoredSignatureAgents.add(agentId);
    highlights.push(`${labelAgent(agentId)} has signature W-Engine (${names[0]}) from S-rank W-Engine list`);
  }
  for (const [agentId, status] of statusMap.entries()) {
    if (!roster.has(agentId) || status.signatureCount <= 0 || scoredSignatureAgents.has(agentId)) continue;
    engineScore += highValueLimited.has(agentId) ? 6 : 3;
    scoredSignatureAgents.add(agentId);
    highlights.push(`${labelAgent(agentId)} has signature W-Engine from asset-card status ${status.raw}`);
  }
  const hasAssetCardSignature = Array.from(statusMap.values()).some((status) => Number(status.signatureCount ?? 0) > 0);
  if (!engines.length && !engineNames.length && !hasAssetCardSignature) {
    missingFields.push('W-Engine / signature engine details');
  }
  engineScore = clamp(engineScore, 0, 15);

  const roles = new Set(agents.map((agent) => agent.role));
  const limitedCount = agents.filter(isHighValueLimited).length;
  const threeTeamPlan = bestThreeVoidHunterPlan(roster);
  let teamScore = 0;
  if (threeTeamPlan.hasAllVoidHunters) {
    if (threeTeamPlan.completeTeams === 3) {
      teamScore = 20;
      highlights.push(`All three Void Hunters can form independent teams: ${describeThreeTeamPlan(threeTeamPlan)}`);
    } else if (threeTeamPlan.completeTeams === 2) {
      teamScore = 13;
      concerns.push(`All three Void Hunters are present, but only two independent teams are visible: ${describeThreeTeamPlan(threeTeamPlan)}`);
      missingFields.push('independent three-team support roster');
    } else if (threeTeamPlan.completeTeams === 1) {
      teamScore = 8;
      concerns.push(`Three Void Hunters share too few compatible teammates: ${describeThreeTeamPlan(threeTeamPlan)}`);
      missingFields.push('independent three-team support roster');
    } else {
      teamScore = 4;
      concerns.push('Three Void Hunters are present, but no independent full team can be verified from named teammates');
      missingFields.push('independent three-team support roster');
    }
  } else if (limitedCount >= 4 && roles.has('support') && (roles.has('stun') || roles.has('defense'))) {
    teamScore = 18;
    highlights.push('Roster can form limited-core teams with support and control roles');
  } else if (limitedCount >= 3) {
    teamScore = 11;
    concerns.push('Limited cores exist, but team role coverage needs checking');
  } else if (limitedCount >= 1) {
    teamScore = 6;
    concerns.push('Limited core is isolated or role support is incomplete');
  } else {
    teamScore = 2;
    concerns.push('Roster mostly relies on standard S-rank count');
  }

  let comfortScore = 0;
  const voidHunterTwoPlusOne = voidHunterCores.filter((core) => hasInvestment(core, agents, engines, statusMap, matchedSignatureEngines, 2, 1));
  if (voidHunterTwoPlusOne.length) {
    comfortScore += voidHunterTwoPlusOne.length * 2;
    highlights.push(`${voidHunterTwoPlusOne.map(labelAgent).join('、')} reach 2+1 Void Hunter comfort breakpoints`);
    if (voidHunterTwoPlusOne.length === voidHunterCores.length) comfortScore += 2;
  }
  if (hasInvestment('astra_yao', agents, engines, statusMap, matchedSignatureEngines, 1, 1)) {
    comfortScore += 1;
    highlights.push('耀嘉音 reaches the 1+1 comfort breakpoint');
  } else if (roster.has('astra_yao')) {
    highlights.push('耀嘉音 is present; 0+0 is usable when Void Hunter investment and teams are stronger');
  }
  const nonVoidZeroPlusOne = [
    'xixifu', 'sid', 'yuzuha', 'lucia', 'ju_fufu', 'zhao',
    'qianxia', 'airi', 'nangong_yu', 'vivian', 'jane', 'yanagi'
  ].filter((core) => hasInvestment(core, agents, engines, statusMap, matchedSignatureEngines, 0, 1));
  if (nonVoidZeroPlusOne.length) {
    comfortScore += Math.min(nonVoidZeroPlusOne.length, 3);
    highlights.push(`${nonVoidZeroPlusOne.map(labelAgent).join('、')} have 0+1 value; signature access usually beats 1+0 for non-Void-Hunter roles`);
  }
  if (directElectricTeam.every((agentId) => roster.has(agentId))) {
    comfortScore += 2;
    highlights.push(`Direct electric team is visible: ${directElectricTeam.map(labelAgent).join('+')}`);
  } else if (/直伤电|希希芙|希德|席德/.test(rawText)) {
    missingFields.push('direct electric team: 希希芙 + 席德 + 耀嘉音');
    concerns.push('Direct electric team is mentioned but 希希芙 + 席德 + 耀嘉音 is not fully visible');
  }
  if (delusionAngelsTrio.every((agentId) => roster.has(agentId))) {
    comfortScore += 1;
    const angelsWithSignatures = delusionAngelsTrio.filter((agentId) => hasSignature(agentId, agents, engines, statusMap, matchedSignatureEngines));
    if (hasSignature('nangong_yu', agents, engines, statusMap, matchedSignatureEngines)) {
      comfortScore += 2;
      highlights.push('南宫羽 has signature W-Engine, covering the most important Delusion Angels signature');
    } else {
      missingFields.push('Nangong Yu signature W-Engine for Delusion Angels');
      concerns.push('Delusion Angels trio is present, but 南宫羽 signature W-Engine is not confirmed');
    }
    if (angelsWithSignatures.length === delusionAngelsTrio.length) {
      comfortScore += 2;
      highlights.push(`Delusion Angels trio has signature support: ${delusionAngelsTrio.map(labelAgent).join('+')}`);
    } else {
      missingFields.push('Delusion Angels trio signature W-Engines');
      concerns.push('Delusion Angels trio is visible, but not every member has confirmed signature W-Engine');
    }
  } else if (/异放|妄想天使/.test(rawText)) {
    missingFields.push('Delusion Angels trio: 千夏 + 爱芮 + 南宫羽');
    concerns.push('Anomaly-release team is mentioned but the Delusion Angels trio is not fully visible');
  }
  if (roster.has('liuyin')) {
    comfortScore += 1;
    highlights.push('琉音 is present as a special-mechanism support');
  }
  const vivianDisorderPartner = vivianDisorderPartners.find((agentId) => roster.has(agentId));
  if (roster.has('vivian') && vivianDisorderPartner) {
    comfortScore += hasInvestment('vivian', agents, engines, statusMap, matchedSignatureEngines, 0, 1) ? 2 : 1;
    highlights.push(`Vivian disorder team is visible: 薇薇安+${labelAgent(vivianDisorderPartner)}`);
  } else if (/薇薇安|Vivian|紊乱|disorder/i.test(rawText)) {
    missingFields.push('Vivian disorder team partner');
    concerns.push('Vivian disorder team is mentioned but 薇薇安 plus a disorder partner is not fully visible');
  }
  comfortScore = clamp(comfortScore, 0, 10);

  const polychrome = Number(resources.polychrome ?? 0);
  const encrypted = Number(resources.encrypted_master_tape ?? 0);
  const master = Number(resources.master_tape ?? 0);
  const boopon = Number(resources.boopon ?? 0);
  const residual = Number(resources.residual_signal ?? 0);
  let resourceScore = 0;
  if (polychrome || encrypted || master || boopon || residual) {
    resourceScore = clamp(Math.floor(polychrome / 3000) + Math.floor((encrypted + master + boopon) / 10) + Math.floor(residual / 120), 1, 15);
    highlights.push('Pull resources are disclosed');
  } else {
    missingFields.push('polychrome / tapes / boopon / residual signal');
  }

  const progressionScore = clamp(Math.floor(Number(assets.progression?.inter_knot_level ?? 0) / 15), 0, 5);
  const price = Number(listing.price ?? 0);
  let priceFitScore = agentScore >= 30 && engineScore >= 10 ? 8 : agentScore >= 20 ? 5 : 1;
  if (price > 0 && threeTeamPlan.completeTeams === 3 && agentScore >= 30 && engineScore >= 10) {
    if (price <= 1500 && voidHunterTwoPlusOne.length === voidHunterCores.length) priceFitScore = 10;
    else if (price <= 2000) priceFitScore = Math.max(priceFitScore, 9);
  }

  let accountHygieneScore = 0;
  let riskPenalty = 0;
  switch (risk.email_status) {
    case 'unbound':
      accountHygieneScore += 5;
      highlights.push('Email is unbound, lowering retrieval risk');
      break;
    case 'unverified_email_included':
      accountHygieneScore += 4;
      highlights.push('Unverified email is included, lowering retrieval risk');
      break;
    case 'verified_email_included':
      riskPenalty += 4;
      concerns.push('Verified email is included and needs identity/retrieval confirmation');
      break;
    case 'not_included':
      riskPenalty += 14;
      concerns.push('Email is not included, raising retrieval risk');
      break;
    case 'cancelled':
    case 'unknown':
    case undefined:
      riskPenalty += 8;
      missingFields.push('email transfer / real-name status');
      break;
    default:
      riskPenalty += 6;
      missingFields.push('email transfer / real-name status');
      concerns.push(`Email status ${risk.email_status} is not covered by the rules`);
      break;
  }

  for (const [field, label] of [
    ['hoyoverse_binding', 'HoYoverse binding'],
    ['psn_binding', 'PSN binding'],
    ['tap_binding', 'TAP binding']
  ]) {
    if (risk[field] === 'bound') {
      riskPenalty += field === 'hoyoverse_binding' ? 18 : 12;
      concerns.push(`${label} is bound`);
    } else if (risk[field] === 'unknown') {
      riskPenalty += 8;
      missingFields.push(label);
    } else if (risk[field] === 'clean' || risk[field] === 'changeable') {
      highlights.push(`${label} is disclosed as ${risk[field]}`);
    }
  }
  if (risk.guarantee === 'none' || risk.guarantee === 'unknown') {
    riskPenalty += risk.guarantee === 'none' ? 10 : 8;
    missingFields.push('retrieval compensation');
  }
  if (!risk.official_verification) {
    riskPenalty += 8;
    missingFields.push('official verification');
  }
  if (listing.server && listing.server !== '官服') {
    riskPenalty += 10;
    concerns.push(`${listing.server} may not match official-server preference`);
  }

  let missingPenalty = 0;
  if (missingFields.includes('W-Engine / signature engine details')) missingPenalty += 7;
  if (missingFields.includes('polychrome / tapes / boopon / residual signal')) missingPenalty += 7;
  if (missingFields.includes('HoYoverse binding')) missingPenalty += 8;
  if (missingFields.includes('PSN binding') || missingFields.includes('TAP binding')) missingPenalty += 5;
  if (missingFields.includes('email transfer / real-name status')) missingPenalty += 5;
  if (missingFields.includes('independent three-team support roster')) missingPenalty += 10;
  if (missingFields.includes('direct electric team: 希希芙 + 席德 + 耀嘉音')) missingPenalty += 4;
  if (missingFields.includes('Delusion Angels trio: 千夏 + 爱芮 + 南宫羽')) missingPenalty += 4;
  if (missingFields.includes('Nangong Yu signature W-Engine for Delusion Angels')) missingPenalty += 15;
  if (missingFields.includes('Delusion Angels trio signature W-Engines')) missingPenalty += 8;
  if (missingFields.includes('Vivian disorder team partner')) missingPenalty += 3;

  const rawScore = agentScore + engineScore + teamScore + resourceScore + progressionScore + priceFitScore + accountHygieneScore + comfortScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);
  const hasKeyAngelsSignatureGap = missingFields.includes('Nangong Yu signature W-Engine for Delusion Angels')
    || missingFields.includes('Delusion Angels trio signature W-Engines');
  const communityComparison = threeTeamPlan.hasAllVoidHunters && threeTeamPlan.completeTeams === 3 && riskPenalty < 8 && !hasKeyAngelsSignatureGap
    ? 'strong alignment'
    : threeTeamPlan.hasAllVoidHunters && threeTeamPlan.completeTeams < 3
      ? 'partial alignment; three-team support incomplete'
      : limitedCount >= 4 && engineScore >= 10 && riskPenalty < 8
    ? 'strong alignment'
    : limitedCount === 0
      ? riskPenalty >= 24
        ? 'conflicts with community valuation; also risk-conflicted'
        : 'conflicts with community valuation'
      : riskPenalty >= 24
        ? 'asset-positive but risk-conflicted'
        : 'partial alignment';
  const confidence = missingPenalty >= 15 || riskPenalty >= 25 ? 'low' : missingPenalty >= 7 || riskPenalty >= 10 ? 'medium' : 'high';

  return {
    id: listing.id,
    final_score: finalScore,
    community_comparison: communityComparison,
    confidence,
    components: { agentScore, engineScore, teamScore, resourceScore, progressionScore, priceFitScore, accountHygieneScore, comfortScore, riskPenalty, missingPenalty },
    highlights,
    concerns,
    missing_fields: [...new Set(missingFields)]
  };
}

const results = fixture.listings.map(scoreListing).sort((a, b) => b.final_score - a.final_score);
for (const [index, result] of results.entries()) {
  console.log(`${index + 1}. ${result.id} (${result.final_score}) - ${result.community_comparison}`);
  console.log(`   confidence: ${result.confidence}`);
  console.log(`   components: ${JSON.stringify(result.components)}`);
  console.log(`   missing: ${result.missing_fields.join(', ') || 'none'}`);
}

if (results.some((result) => !result.id || Number.isNaN(result.final_score))) throw new Error('Invalid ZZZ validation result');
if (results[0]?.id !== fixture.expected_top_id) throw new Error(`Expected ${fixture.expected_top_id}, got ${results[0]?.id ?? 'none'}`);
const standardTrap = results.find((result) => result.id === 'standard-mindscape-trap');
if (!standardTrap?.community_comparison.includes('conflicts with community valuation')) {
  throw new Error('Expected standard S-rank count listing to conflict with community valuation');
}
const unverifiedEmail = results.find((result) => result.id === 'email-unverified-safe');
const noEmail = results.find((result) => result.id === 'email-not-included-risk');
if (!unverifiedEmail || !noEmail || unverifiedEmail.final_score <= noEmail.final_score) {
  throw new Error('Expected unverified-email-included listing to outrank email-not-included listing with similar assets');
}
if (!unverifiedEmail.highlights.some((item) => /Unverified email/.test(item))) {
  throw new Error('Expected unverified email status to be a positive account hygiene signal');
}
if (!noEmail.concerns.some((item) => /Email is not included/.test(item))) {
  throw new Error('Expected email-not-included status to raise retrieval-risk concern');
}
const sharedSupportTrap = results.find((result) => result.id === 'void-hunters-shared-support-trap');
const threeTeamComplete = results.find((result) => result.id === 'void-hunters-three-team-complete');
const oldTeamTrap = results.find((result) => result.id === 'old-team-archetype-trap');
if (!sharedSupportTrap || !threeTeamComplete || threeTeamComplete.final_score <= sharedSupportTrap.final_score) {
  throw new Error('Expected independent three-team Void Hunter account to outrank shared-support trap');
}
if (!oldTeamTrap || threeTeamComplete.final_score <= oldTeamTrap.final_score) {
  throw new Error('Expected current Void Hunter team rules to outrank the old team-archetype trap');
}
if (!oldTeamTrap.missing_fields.includes('independent three-team support roster')) {
  throw new Error('Expected old team-archetype trap to require current independent three-team support confirmation');
}
if (!sharedSupportTrap.concerns.some((item) => /only two independent teams|too few compatible teammates|no independent full team/.test(item))) {
  throw new Error('Expected shared-support trap to warn about incomplete independent Void Hunter teams');
}
if (!sharedSupportTrap.missing_fields.includes('independent three-team support roster')) {
  throw new Error('Expected shared-support trap to require independent three-team support roster confirmation');
}
if (!threeTeamComplete.highlights.some((item) => /All three Void Hunters can form independent teams/.test(item))) {
  throw new Error('Expected complete account to explain the independent three-team plan');
}
if (!threeTeamComplete.highlights.some((item) => /Direct electric team/.test(item))) {
  throw new Error('Expected complete account to recognize 希希芙 + 席德 + 耀嘉音 direct electric team');
}
if (!threeTeamComplete.highlights.some((item) => /Delusion Angels trio/.test(item))) {
  throw new Error('Expected complete account to recognize the Delusion Angels trio');
}
if (!threeTeamComplete.highlights.some((item) => /Vivian disorder team/.test(item))) {
  throw new Error('Expected complete account to recognize the Vivian disorder team bonus');
}
if (!threeTeamComplete.highlights.some((item) => /from S-rank W-Engine list/.test(item))) {
  throw new Error('Expected complete account to confirm signature engines from the S-rank W-Engine name list');
}
if (threeTeamComplete.components.comfortScore < 6) {
  throw new Error('Expected complete account to receive comfort bonuses for 2+1 / 0+1 / 耀嘉音 1+1');
}
const userBestValue = results.find((result) => result.id === 'jhyxj3297-user-best-value');
const astraTrap = results.find((result) => result.id === 'astra-1-plus-1-lower-value-trap');
if (!userBestValue || !astraTrap || userBestValue.final_score <= astraTrap.final_score) {
  throw new Error('Expected JHYXJ3297-style 2+1 Void Hunter account to outrank Astra 1+1 lower-value trap');
}
if (!userBestValue.highlights.some((item) => /南宫羽 has signature W-Engine/.test(item))) {
  throw new Error('Expected Nangong Yu signature W-Engine to be recognized as key Delusion Angels value');
}
if (!astraTrap.missing_fields.includes('Nangong Yu signature W-Engine for Delusion Angels')) {
  throw new Error('Expected missing Nangong Yu signature W-Engine to penalize lower-value trap');
}
if (!userBestValue.highlights.some((item) => /signature access usually beats 1\+0/.test(item))) {
  throw new Error('Expected non-Void-Hunter 0+1 priority over 1+0 to be explained');
}

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks standard S-rank-count accounts.`);
