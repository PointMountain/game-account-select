#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);

function readArg(name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

function sidecarPath(inputPath, suffix) {
  return inputPath.endsWith('.json') ? `${inputPath.slice(0, -5)}.${suffix}` : `${inputPath}.${suffix}`;
}

function parseJson(text) {
  const value = String(text ?? '').trim();
  try { return JSON.parse(value); } catch {}
  const start = value.search(/[\[{]/);
  const end = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw new Error('command did not emit JSON');
}

function runNode(script, scriptArgs, timeout = 180000) {
  const run = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 32,
  });
  return { ok: run.status === 0, status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

function knowledgeState(candidates) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const applied = rows.filter((item) => /applied|accepted|merged/i.test(String(item?.apply_status ?? item?.status ?? ''))).length;
  return { total: rows.length, applied, pending: Math.max(0, rows.length - applied) };
}

function renderEvaluationSummary(artifact) {
  const evaluation = artifact.evaluation?.zenless_zone_zero_score ?? artifact.zenless_zone_zero_score ?? {};
  const listing = artifact.evaluation?.listing ?? artifact.recommendations?.[0] ?? {};
  const candidates = knowledgeState(artifact.knowledge_update_candidates);
  const money = listing.price == null ? '未披露' : `¥${Number(listing.price).toLocaleString('zh-CN')}`;
  const fairValue = listing.fair_value_cny?.low != null && listing.fair_value_cny?.high != null
    ? `¥${Number(listing.fair_value_cny.low).toLocaleString('zh-CN')}–¥${Number(listing.fair_value_cny.high).toLocaleString('zh-CN')}`
    : '未估算';
  const missing = Array.isArray(evaluation.missing_fields) && evaluation.missing_fields.length
    ? evaluation.missing_fields.join('、')
    : '无';
  return [
    `### ${listing.id ?? listing.listing_id ?? '绝区零账号'} 评估`,
    '',
    '| 挂牌价 | 合理成交区间 | 区服 | 评分 | 置信度 | 平台验号时间 |',
    '|---:|---:|---|---:|---|---|',
    `| ${money} | ${fairValue} | ${[listing.server, listing.region].filter(Boolean).join('/') || '未披露'} | ${evaluation.final_score ?? '未评分'} | ${evaluation.confidence ?? 'unknown'} | ${listing.platform_verified_at ?? '未披露'} |`,
    '',
    `缺失/待核验：${missing}。`,
    '',
    `Self-improve：知识沉淀已应用 ${candidates.applied} 条；待验证/延期 ${candidates.pending} 条。`,
    '',
  ].join('\n');
}

const input = readArg('--input');
if (!input) {
  console.error('Usage: finalize-evaluation-run.mjs --input <run-artifact.json> [--report-out <report.md>]');
  process.exit(2);
}

const artifactPath = path.resolve(input);
const reportPath = path.resolve(readArg('--report-out', sidecarPath(artifactPath, 'md')));
const optimizerPath = path.resolve(readArg('--optimizer-out', sidecarPath(artifactPath, 'optimizer.json')));
const evaluatorPath = path.resolve(readArg('--evaluator-out', sidecarPath(artifactPath, 'evaluator.json')));
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

artifact.schema_version = '2.0';
artifact.target_skill = artifact.target_skill ?? 'skills/game-account-zenless-zone-zero';
delete artifact.optimizer_report;
delete artifact.evaluation_reports;
delete artifact.quality_gate;
artifact.presentation = {
  format: 'markdown_table',
  table_output_required: true,
  report_path: reportPath,
  status: 'complete',
};
artifact.self_improve = {
  closeout_required: true,
  status: 'quality_gate_pending',
  summary_generated: Boolean(artifact.experience_summary),
  coverage_gaps_recorded: Array.isArray(artifact.coverage_gaps),
  optimizer: { status: 'pending', report_path: optimizerPath },
  evaluator: { status: 'pending', report_path: evaluatorPath },
  knowledge_candidates: knowledgeState(artifact.knowledge_update_candidates),
  profile_preferences_persisted: false,
};
artifact.final_response = renderEvaluationSummary(artifact);
artifact.final_response_draft = artifact.final_response;
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

const optimizerRun = runNode(path.join(repoRoot, 'skills', 'game-account-skill-optimizer', 'scripts', 'analyze-run.mjs'), ['--input', artifactPath, '--json']);
let optimizerReport;
try { optimizerReport = parseJson(optimizerRun.stdout); } catch (error) {
  optimizerReport = {
    target_skill: artifact.target_skill,
    findings: [{ id: 'optimizer-execution-failed', severity: 'high', category: 'quality_gate', summary: error.message, evidence: [optimizerRun.stderr || optimizerRun.stdout || 'no output'] }],
    safe_to_autopatch: false,
  };
}
fs.mkdirSync(path.dirname(optimizerPath), { recursive: true });
fs.writeFileSync(optimizerPath, `${JSON.stringify(optimizerReport, null, 2)}\n`);
const actionable = (optimizerReport.findings ?? []).filter((finding) => String(finding.severity ?? '').toLowerCase() !== 'info');
artifact.optimizer_report = optimizerReport;
artifact.self_improve.optimizer = {
  status: optimizerRun.ok && actionable.length === 0 ? 'passed' : 'needs_action',
  report_path: optimizerPath,
  finding_count: (optimizerReport.findings ?? []).length,
  actionable_finding_count: actionable.length,
};
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

const evaluatorRun = runNode(path.join(repoRoot, 'skills', 'game-account-skill-evaluator', 'scripts', 'evaluate-skill.mjs'), [`--from-report=${artifactPath}`, '--json']);
let evaluatorReport;
try { evaluatorReport = parseJson(evaluatorRun.stdout); } catch (error) {
  evaluatorReport = { mode: 'run_artifact_analysis', passed: false, redo_required: true, blocking_issues: [{ message: error.message, blocking: true }], stderr: evaluatorRun.stderr };
}
fs.mkdirSync(path.dirname(evaluatorPath), { recursive: true });
fs.writeFileSync(evaluatorPath, `${JSON.stringify(evaluatorReport, null, 2)}\n`);
artifact.evaluation_reports = [evaluatorReport];
artifact.quality_gate = {
  optimizer: actionable.length === 0 ? 'info_only' : 'needs_action',
  evaluator_passed: evaluatorReport.passed === true,
  redo_required: evaluatorReport.redo_required === true || actionable.length > 0,
  actionable_optimizer_findings: actionable.map((finding) => finding.id),
  blocking_issues: evaluatorReport.blocking_issues ?? [],
};
artifact.self_improve.evaluator = {
  status: evaluatorReport.passed === true ? 'passed' : 'redo_required',
  passed: evaluatorReport.passed === true,
  report_path: evaluatorPath,
  blocking_issue_count: Array.isArray(evaluatorReport.blocking_issues) ? evaluatorReport.blocking_issues.length : 0,
};
artifact.self_improve.status = artifact.quality_gate.redo_required ? 'needs_revision' : 'complete';
artifact.finished_at = new Date().toISOString();
artifact.final_response = renderEvaluationSummary(artifact);
artifact.final_response_draft = artifact.final_response;
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, artifact.final_response);

console.log(JSON.stringify({
  artifact: artifactPath,
  report: reportPath,
  optimizer_report: optimizerPath,
  evaluator_report: evaluatorPath,
  self_improve: artifact.self_improve,
  quality_gate: artifact.quality_gate,
}, null, 2));
process.exit(artifact.quality_gate.redo_required ? 1 : 0);
