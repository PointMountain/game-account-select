#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'zenless-zone-zero-validation-sample.json'), 'utf8'));

const highValueLimited = new Set(['Ellen', 'Zhu Yuan', 'Qingyi', 'Jane', 'Caesar', 'Burnice', 'Yanagi', 'Lighter', 'Miyabi', 'Astra Yao', 'Evelyn', 'Trigger', 'Vivian', 'Yixuan', 'Ju Fufu']);
const standardAgents = new Set(['Nekomata', 'Soldier 11', 'Koleda', 'Lycaon', 'Rina', 'Grace']);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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
    if (highValueLimited.has(agent.name) || agent.category === 'limited') {
      agentScore += 8 + Math.min(Number(agent.mindscape ?? 0), 1);
      highlights.push(`${agent.name} is a limited S-rank core`);
    } else if (standardAgents.has(agent.name) || agent.category === 'standard') {
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
    if (engine.signature_for && agents.some((agent) => agent.name === engine.signature_for && highValueLimited.has(agent.name))) {
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
  const limitedCount = agents.filter((agent) => highValueLimited.has(agent.name) || agent.category === 'limited').length;
  let teamScore = 0;
  if (limitedCount >= 4 && roles.has('support') && (roles.has('stun') || roles.has('defense'))) {
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

  let riskPenalty = 0;
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

  const rawScore = agentScore + engineScore + teamScore + resourceScore + progressionScore + priceFitScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);
  const communityComparison = limitedCount >= 4 && engineScore >= 10 && riskPenalty < 8
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
    components: { agentScore, engineScore, teamScore, resourceScore, progressionScore, priceFitScore, riskPenalty, missingPenalty },
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

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks standard S-rank-count accounts.`);
