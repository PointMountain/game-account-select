#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { playContexts, resolveContextKnowledge } from './community-evidence.mjs';

export function planCommunityRefresh({ request = '', listings = [], evidence = null, knowledge = { operators: {} }, now = new Date().toISOString() }) {
  const contexts = playContexts(request);
  const names = [...new Set(listings.flatMap((row) => (row.game_assets?.operators ?? []).map((operator) => operator.name)))];
  const labels = { story: '主线 活动 日常 阵容', roguelike: '集成战略 肉鸽 抓位 队伍', high_difficulty: '高难 合约 阵容 练度门槛' };
  const gaps = contexts.map((context) => {
    const resolved = resolveContextKnowledge(knowledge, evidence, { context, now, game: 'Arknights' });
    return { context, missing_subjects: names.filter((name) => !resolved.knowledge.operators[name]?.current_claim_id), applied_claim_ids: resolved.applied_claim_ids };
  }).filter((item) => !item.applied_claim_ids.length || item.missing_subjects.length);
  return { schema_version: 1, generated_at: now, required: gaps.length > 0, contexts, gaps,
    budget_minutes: 8, execution: 'agent_in_current_task_space',
    tasks: gaps.map((item) => ({ context: item.context, query: `明日方舟 ${now.slice(0, 7)} ${labels[item.context]} ${item.missing_subjects.slice(0, 3).join(' ')}`.trim(),
      required_content: ['版本及发布日期', '两位独立作者的正文、字幕或清晰图表', '同一玩法的结论和练度条件'],
      subjects: item.missing_subjects, stop_rule: '同一来源失败一次换独立来源；耗尽研究预算保留待核实，不续写当前共识' })),
    next: gaps.length ? '按 tasks 获取内容并写入 community-evidence.json；对同一批账号重新评分。无法证实的主张继续待核实。' : '当前请求已有适用证据；出现新干员或版本变化时重新规划。' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const get = (key) => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
  const artifact = get('--input') ? JSON.parse(fs.readFileSync(get('--input'), 'utf8')) : {};
  const evidence = get('--evidence') && fs.existsSync(get('--evidence')) ? JSON.parse(fs.readFileSync(get('--evidence'), 'utf8')) : null;
  const knowledge = get('--knowledge') ? JSON.parse(fs.readFileSync(get('--knowledge'), 'utf8')) : { operators: {} };
  const result = planCommunityRefresh({ request: get('--request') ?? artifact.selection_profile?.source_text ?? artifact.user_request ?? '', listings: artifact.rankings ?? [], evidence, knowledge });
  const body = `${JSON.stringify(result, null, 2)}\n`;
  if (get('--out')) fs.writeFileSync(get('--out'), body); else process.stdout.write(body);
}
