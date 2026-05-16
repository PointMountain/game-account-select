#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-fixtures', 'arknights-validation-sample.json'), 'utf8'));

const highValueLimited = new Set(['W', '迷迭香', '浊心斯卡蒂', '耀骑士临光', '归溟幽灵鲨', '斥罪', '缄默德克萨斯', '麒麟R夜刀', '百炼嘉维尔', '假日威龙陈', '黍', '令', '年', '夕', '井', 'Ash', 'Ela', 'Iana']);
const highImpactStandard = new Set(['玛恩纳', '史尔特尔', '银灰', '塞雷娅', '伊内丝', '焰影苇草', '艾雅法拉', '伊芙利特', '山', '棘刺', '澄闪', '提丰', '维什戴尔', '锏']);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function progressValue(operator) {
  const elite = Number(operator.elite ?? 0);
  const mastery = Number(operator.mastery ?? 0);
  const moduleLevel = Number(operator.module ?? 0);
  if (elite >= 2 && mastery >= 3 && moduleLevel >= 2) return 4;
  if (elite >= 2 && mastery >= 3) return 3;
  if (elite >= 2) return 2;
  if (operator.elite == null || operator.mastery == null) return 0;
  return 1;
}

function scoreListing(listing) {
  const assets = listing.game_assets ?? {};
  const operators = assets.operators ?? [];
  const resources = assets.resources ?? {};
  const risk = assets.risk ?? {};
  const highlights = [];
  const concerns = [];
  const missingFields = [];

  let limitedScore = 0;
  let impactScore = 0;
  let progressScore = 0;

  for (const operator of operators) {
    const progress = progressValue(operator);
    progressScore += progress;
    if (highValueLimited.has(operator.name) || operator.category === 'collab') {
      limitedScore += progress >= 3 ? 7 : progress >= 2 ? 5 : 3;
      highlights.push(`${operator.name} is limited/collab account value`);
      if (progress === 0) concerns.push(`${operator.name} lacks visible elite/mastery/module data`);
    } else if (highImpactStandard.has(operator.name)) {
      impactScore += progress >= 3 ? 5 : progress >= 2 ? 3 : 1;
      highlights.push(`${operator.name} is a high-impact standard operator`);
    } else {
      concerns.push(`${operator.name} has limited account-selection weight without context`);
    }
  }

  limitedScore = clamp(limitedScore, 0, 30);
  impactScore = clamp(impactScore, 0, 20);
  progressScore = clamp(progressScore, 0, 20);

  const orundum = Number(resources.orundum ?? 0);
  const prime = Number(resources.originite_prime ?? 0);
  const tickets = Number(resources.ten_pull_tickets ?? 0);
  const certs = Number(resources.distinction_certificates ?? 0);
  let resourceScore = 0;
  if (orundum || prime || tickets || certs) {
    resourceScore = clamp(Math.floor(orundum / 6000) + Math.floor(prime / 30) + tickets + Math.floor(certs / 90), 1, 15);
    highlights.push('Pull and certificate resources are disclosed');
  } else {
    missingFields.push('orundum / originite prime / tickets / certificates');
  }

  const collectionScore = clamp((assets.skins ?? []).length * 2, 0, 5);
  const priceFitScore = limitedScore >= 25 && progressScore >= 15 ? 8 : limitedScore >= 15 ? 5 : 1;

  let riskPenalty = 0;
  if (risk.real_name_status === 'unknown') {
    riskPenalty += 15;
    missingFields.push('real-name / retrieval status');
  } else if (risk.real_name_status === 'changeable') {
    highlights.push('Real-name status is disclosed as changeable');
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
  if (missingFields.includes('orundum / originite prime / tickets / certificates')) missingPenalty += 6;
  if (operators.some((operator) => operator.elite == null || operator.mastery == null)) {
    missingPenalty += 10;
    missingFields.push('operator elite / mastery / module details');
  }

  const rawScore = limitedScore + impactScore + progressScore + resourceScore + collectionScore + priceFitScore;
  const finalScore = clamp(rawScore - riskPenalty - missingPenalty, 0, 100);
  const communityComparison = limitedScore >= 25 && progressScore >= 15 && riskPenalty < 8
    ? 'strong alignment'
    : limitedScore >= 15 && riskPenalty >= 20
      ? 'asset-positive but risk-conflicted'
      : limitedScore < 10
        ? 'conflicts with community valuation'
        : 'partial alignment';
  const confidence = missingPenalty >= 12 || riskPenalty >= 25 ? 'low' : missingPenalty >= 6 || riskPenalty >= 10 ? 'medium' : 'high';

  return {
    id: listing.id,
    final_score: finalScore,
    community_comparison: communityComparison,
    confidence,
    components: { limitedScore, impactScore, progressScore, resourceScore, collectionScore, priceFitScore, riskPenalty, missingPenalty },
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

if (results.some((result) => !result.id || Number.isNaN(result.final_score))) throw new Error('Invalid Arknights validation result');
if (results[0]?.id !== fixture.expected_top_id) throw new Error(`Expected ${fixture.expected_top_id}, got ${results[0]?.id ?? 'none'}`);

console.log(`\nValidation passed: ${fixture.expected_top_id} outranks generic six-star-count accounts.`);
