#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'zenless-zone-zero-validation-sample.json'), 'utf8'));

const canonicalAliases = new Map();
function addAliases(canonical, aliases) {
  canonicalAliases.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) canonicalAliases.set(alias.toLowerCase(), canonical);
}

addAliases('miyabi', ['Miyabi', '星见雅', '雅']);
addAliases('yixuan', ['Yixuan', '仪玄']);
addAliases('ye_shunguang', ['Ye Shunguang', 'Yeshunguang', '叶瞬光', '叶曙光', '小光']);
addAliases('yuzuha', ['Fubao Yuzuha', 'Yuzuha', '浮波柚叶', '柚叶', '右叶', '右翼']);
addAliases('astra_yao', ['Astra Yao', '耀嘉音', '嘉音']);
addAliases('soukaku', ['Soukaku', '苍角']);
addAliases('yanagi', ['Yanagi', '月城柳', '柳']);
addAliases('lycaon', ['Lycaon', '莱卡恩']);
addAliases('nicole', ['Nicole', '妮可']);
addAliases('burnice', ['Burnice', '柏妮思']);
addAliases('liuyin', ['Liuyin', '琉音']);
addAliases('ju_fufu', ['Ju Fufu', '橘福福']);
addAliases('qingyi', ['Qingyi', '青衣']);
addAliases('lucia', ['Lucia', '卢西娅']);
addAliases('pan_yinhu', ['Pan Yinhu', '潘引壶']);
addAliases('zhao', ['Zhao', '照']);
addAliases('qianxia', ['Qianxia', '千夏']);
addAliases('ellen', ['Ellen', '艾莲']);
addAliases('zhu_yuan', ['Zhu Yuan', '朱鸢']);
addAliases('jane', ['Jane', '简']);
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

const highValueLimited = new Set([
  'ellen', 'zhu_yuan', 'qingyi', 'jane', 'caesar', 'burnice', 'yanagi',
  'lighter', 'miyabi', 'astra_yao', 'evelyn', 'trigger', 'vivian',
  'yixuan', 'ye_shunguang', 'yuzuha', 'liuyin', 'ju_fufu', 'lucia',
  'qianxia', 'zhao'
]);
const standardAgents = new Set(['nekomata', 'soldier_11', 'koleda', 'lycaon', 'rina', 'grace']);
const voidHunterCores = ['miyabi', 'yixuan', 'ye_shunguang'];
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
  ['qianxia', '千夏']
]);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function canonicalAgentName(name) {
  const raw = String(name ?? '').trim();
  return canonicalAliases.get(raw.toLowerCase()) ?? raw.toLowerCase();
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

function pairOptionsForCore(core, roster) {
  const specs = {
    miyabi: [
      { primary: ['yuzuha'], secondary: ['soukaku', 'yanagi', 'lycaon', 'astra_yao', 'nicole', 'burnice'], tier: 'preferred' },
      { primary: ['astra_yao'], secondary: ['nicole', 'soukaku', 'lycaon', 'yanagi'], tier: 'alternative' }
    ],
    yixuan: [
      { primary: ['liuyin', 'ju_fufu', 'qingyi'], secondary: ['lucia', 'pan_yinhu'], tier: 'preferred' },
      { primary: ['liuyin', 'ju_fufu', 'qingyi'], secondary: ['astra_yao'], tier: 'alternative' }
    ],
    ye_shunguang: [
      { primary: ['liuyin', 'zhao'], secondary: ['qianxia', 'astra_yao'], tier: 'preferred' },
      { primary: ['zhao'], secondary: ['qianxia', 'astra_yao'], tier: 'alternative' }
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
  for (const engine of engines) {
    const signatureFor = canonicalAgentName(engine.signature_for);
    if (engine.signature_for && agents.some((agent) => canonicalAgentName(agent.name) === signatureFor && isHighValueLimited(agent))) {
      engineScore += 6;
      highlights.push(`${engine.signature_for} has signature W-Engine`);
    } else if (engine.signature_for) {
      engineScore += 3;
    } else {
      engineScore += 1;
      concerns.push('Generic S W-Engine has limited value without a matched core');
    }
  }
  if (!engines.length) missingFields.push('W-Engine / signature engine details');
  engineScore = clamp(engineScore, 0, 15);

  const roles = new Set(agents.map((agent) => agent.role));
  const roster = buildRoster(agents);
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
  const priceFitScore = agentScore >= 30 && engineScore >= 10 ? 8 : agentScore >= 20 ? 5 : 1;

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

  const rawScore = agentScore + engineScore + teamScore + resourceScore + progressionScore + priceFitScore + accountHygieneScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);
  const communityComparison = threeTeamPlan.hasAllVoidHunters && threeTeamPlan.completeTeams === 3 && riskPenalty < 8
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
    components: { agentScore, engineScore, teamScore, resourceScore, progressionScore, priceFitScore, accountHygieneScore, riskPenalty, missingPenalty },
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
if (!sharedSupportTrap || !threeTeamComplete || threeTeamComplete.final_score <= sharedSupportTrap.final_score) {
  throw new Error('Expected independent three-team Void Hunter account to outrank shared-support trap');
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

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks standard S-rank-count accounts.`);
