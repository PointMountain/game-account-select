#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { renderSelectionReport, selectPlatformRows } from './render-selection-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);

function readArg(name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

function runNode(script, scriptArgs, timeout = 120000) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 32,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function parseJson(value) {
  const text = String(value ?? '').trim();
  try { return JSON.parse(text); } catch {}
  const start = text.search(/[\[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('command did not emit JSON');
}

function sidecarPath(inputPath, suffix) {
  return inputPath.endsWith('.json') ? `${inputPath.slice(0, -5)}.${suffix}` : `${inputPath}.${suffix}`;
}

function knowledgeState(candidates) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const statusOf = (item) => String(item?.apply_status ?? item?.status ?? '').trim().toLowerCase();
  const appliedStatuses = new Set(['applied', 'accepted', 'merged']);
  const verifiedExistingStatuses = new Set(['verified_existing', 'already_implemented', 'observed_existing']);
  const applied = rows.filter((item) => appliedStatuses.has(statusOf(item))).length;
  const verifiedExisting = rows.filter((item) => verifiedExistingStatuses.has(statusOf(item))).length;
  return {
    total: rows.length,
    applied,
    verified_existing: verifiedExisting,
    pending: Math.max(0, rows.length - applied - verifiedExisting),
  };
}

const input = readArg('--input');
if (!input) {
  console.error('Usage: finalize-selection-run.mjs --input <artifact.json> [--report-out <report.md>] [--per-platform 5]');
  process.exit(2);
}

const artifactPath = path.resolve(input);
const reportPath = path.resolve(readArg('--report-out', sidecarPath(artifactPath, 'md')));
const optimizerPath = path.resolve(readArg('--optimizer-out', sidecarPath(artifactPath, 'optimizer.json')));
const evaluatorPath = path.resolve(readArg('--evaluator-out', sidecarPath(artifactPath, 'evaluator.json')));
const perPlatform = Math.max(1, Math.min(Number(readArg('--per-platform', 5)) || 5, 15));
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const platforms = Array.isArray(artifact?.success_criteria?.minimum_source_coverage?.platforms)
  ? artifact.success_criteria.minimum_source_coverage.platforms
  : ['pxb7', 'pzds'];
const renderedCounts = Object.fromEntries(platforms.map((platform) => [platform, selectPlatformRows(artifact.platform_shortlists?.[platform], perPlatform).length]));
const availableCounts = Object.fromEntries(platforms.map((platform) => {
  const section = artifact.platform_shortlists?.[platform];
  return [platform, selectPlatformRows(section, 1000).length];
}));
const underfilled = platforms.filter((platform) => renderedCounts[platform] < Math.min(perPlatform, availableCounts[platform]));
const candidateShortages = platforms.filter((platform) => availableCounts[platform] < perPlatform);

artifact.schema_version = '2.0';
artifact.presentation = {
  format: 'markdown_tables',
  table_output_required: true,
  per_platform_requested: perPlatform,
  per_platform_available: availableCounts,
  per_platform_rendered: renderedCounts,
  report_path: reportPath,
  underfilled_platforms: underfilled,
  candidate_shortage_platforms: candidateShortages,
  status: underfilled.length ? 'render_underfilled' : candidateShortages.length ? 'candidate_shortage' : 'complete',
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
artifact.final_response = renderSelectionReport(artifact, { perPlatform });
artifact.final_response_draft = artifact.final_response;
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

const optimizerRun = runNode(path.join(repoRoot, 'skills', 'game-account-skill-optimizer', 'scripts', 'analyze-run.mjs'), ['--input', artifactPath, '--json']);
let optimizerReport = null;
try { optimizerReport = parseJson(optimizerRun.stdout); } catch (error) {
  optimizerReport = { target_skill: artifact.target_skill, findings: [{ id: 'optimizer-execution-failed', severity: 'high', category: 'quality_gate', summary: error.message, evidence: [optimizerRun.stderr || optimizerRun.stdout || 'no output'] }], safe_to_autopatch: false };
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

const evaluatorRun = runNode(path.join(repoRoot, 'skills', 'game-account-skill-evaluator', 'scripts', 'evaluate-skill.mjs'), [`--from-report=${artifactPath}`, '--json'], 180000);
let evaluatorReport = null;
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
artifact.final_response = renderSelectionReport(artifact, { perPlatform });
artifact.final_response_draft = artifact.final_response;
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, artifact.final_response);

console.log(JSON.stringify({
  artifact: artifactPath,
  report: reportPath,
  optimizer_report: optimizerPath,
  evaluator_report: evaluatorPath,
  presentation: artifact.presentation,
  self_improve: artifact.self_improve,
  quality_gate: artifact.quality_gate,
}, null, 2));
process.exit(artifact.quality_gate.redo_required ? 1 : 0);
