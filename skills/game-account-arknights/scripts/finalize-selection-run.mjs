#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knowledgeState as verifiedKnowledgeState } from '../../game-account-skill-optimizer/scripts/lib/learning-store.mjs';

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
  return verifiedKnowledgeState(candidates, repoRoot);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function allKnownListings(value) {
  const shortlists = value.platform_shortlists ?? {};
  const rows = [
    ...(Array.isArray(value.recommendations) ? value.recommendations : []),
    ...(Array.isArray(value.backup_listings) ? value.backup_listings : []),
    ...(Array.isArray(value.near_match_listings) ? value.near_match_listings : []),
    ...(Array.isArray(value.budget_breakthrough_listings) ? value.budget_breakthrough_listings : []),
    ...Object.values(shortlists).flatMap((section) => selectPlatformRows(section, 1000)),
  ];
  return [...new Map(rows.filter(Boolean).map((row) => [`${row.platform ?? ''}:${row.listing_id ?? row.url ?? ''}`, row])).values()];
}

function finalizeResponseContract(value, perPlatform) {
  value.final_response = renderSelectionReport(value, { perPlatform });
  value.final_response_draft = value.final_response;
  value.delivery_contract = {
    mode: 'verbatim_required',
    generated_by: 'skills/game-account-arknights/scripts/render-selection-report.mjs',
    final_response_sha256: sha256(value.final_response),
    rendered_listing_ids: allKnownListings(value)
      .filter((row) => {
        const id = String(row.listing_id ?? '');
        const url = String(row.url ?? '');
        return Boolean((id && value.final_response.includes(id)) || (url && value.final_response.includes(url)));
      })
      .map((row) => String(row.listing_id ?? row.url)),
    required_sections: ['预算分层', '螃蟹候选', '盼之候选', '本轮复盘与 Self-improve'],
    instruction: 'Return final_response verbatim. Do not replace it with a handwritten shortlist or omit the self-improve closeout.',
  };
}

const input = readArg('--input');
if (!input) {
  console.error('Usage: finalize-selection-run.mjs --input <artifact.json> [--report-out <report.md>] [--per-platform 10]');
  process.exit(2);
}

const artifactPath = path.resolve(input);
const reportPath = path.resolve(readArg('--report-out', sidecarPath(artifactPath, 'md')));
const optimizerPath = path.resolve(readArg('--optimizer-out', sidecarPath(artifactPath, 'optimizer.json')));
const evaluatorPath = path.resolve(readArg('--evaluator-out', sidecarPath(artifactPath, 'evaluator.json')));
const outputPaths = [artifactPath, reportPath, optimizerPath, evaluatorPath];
if (new Set(outputPaths).size !== outputPaths.length) {
  console.error('Artifact, report, optimizer, and evaluator paths must be distinct');
  process.exit(1);
}
const perPlatform = Math.max(1, Math.min(Number(readArg('--per-platform', 10)) || 10, 15));
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const requestProvenance = artifact.request_provenance;
const inputIssues = [
  ...(artifact.game !== 'Arknights' && artifact.game !== '明日方舟' ? ['game must identify Arknights'] : []),
  ...(artifact.target_skill !== 'skills/game-account-arknights' ? ['target_skill must equal skills/game-account-arknights'] : []),
  ...(!artifact.user_request ? ['user_request is required'] : []),
  ...(!requestProvenance || typeof requestProvenance !== 'object' ? ['request_provenance is required'] : []),
  ...(requestProvenance && String(requestProvenance.raw_user_request ?? '') !== String(artifact.user_request ?? '') ? ['raw_user_request must equal user_request'] : []),
  ...(requestProvenance && requestProvenance.raw_user_request_sha256 !== sha256(requestProvenance.raw_user_request ?? '') ? ['raw_user_request_sha256 is invalid'] : []),
  ...(requestProvenance && !String(requestProvenance.profile_input ?? '') ? ['profile_input is required'] : []),
  ...(requestProvenance && requestProvenance.profile_input_sha256 !== sha256(requestProvenance.profile_input ?? '') ? ['profile_input_sha256 is invalid'] : []),
];
if (inputIssues.length) {
  console.error(`Invalid Arknights artifact identity/provenance: ${inputIssues.join('; ')}`);
  process.exit(1);
}
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

artifact.schema_version = '3.0';
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
finalizeResponseContract(artifact, perPlatform);
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
finalizeResponseContract(artifact, perPlatform);
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
