#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { knowledgeState as verifiedKnowledgeState } from '../../game-account-skill-optimizer/scripts/lib/learning-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readArg(args, name, fallback = null) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
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
  return verifiedKnowledgeState(candidates, repoRoot);
}

function markdownCell(value) {
  return String(value ?? '未披露').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function evaluationRows(artifact, scoreKey) {
  const source = Array.isArray(artifact.evaluations)
    ? artifact.evaluations
    : artifact.evaluation
      ? [artifact.evaluation]
      : Array.isArray(artifact.recommendations)
        ? artifact.recommendations
        : [];
  return source.map((row) => {
    const listing = row.listing ?? row;
    const score = row[scoreKey] ?? row.score ?? row.evaluation?.[scoreKey] ?? {};
    return {
      id: listing.id ?? listing.listing_id ?? row.id ?? row.listing_id ?? '未编号',
      platform: listing.platform ?? row.platform ?? 'user_material',
      price: listing.price ?? row.price ?? null,
      server: listing.server ?? row.server ?? null,
      url: listing.url ?? row.url ?? null,
      published_at: listing.published_at ?? row.published_at ?? null,
      platform_verified_at: listing.platform_verified_at ?? row.platform_verified_at ?? null,
      final_score: score.final_score ?? row.final_score ?? row.score ?? null,
      confidence: score.confidence ?? row.confidence ?? 'unknown',
      missing_fields: score.missing_fields ?? row.missing_fields ?? [],
      highlights: score.highlights ?? row.highlights ?? [],
      concerns: score.concerns ?? row.concerns ?? [],
    };
  });
}

export function renderGameEvaluationReport(artifact, config) {
  const rows = evaluationRows(artifact, config.scoreKey);
  const attempts = Array.isArray(artifact.platform_attempts) ? artifact.platform_attempts : [];
  const gaps = Array.isArray(artifact.coverage_gaps) ? artifact.coverage_gaps : [];
  const knowledge = knowledgeState(artifact.knowledge_update_candidates);
  const lines = [
    `# ${config.gameLabel}账号评估`,
    '',
    '## 候选结果',
    '',
    '| 账号 | 来源 | 价格 | 区服 | 评分 | 置信度 | 上架时间 | 平台验号时间 | 链接 |',
    '|---|---|---:|---|---:|---|---|---|---|',
  ];
  if (rows.length === 0) {
    lines.push('| 无可交付候选 | 未披露 | 未披露 | 未披露 | 未评分 | low | 未披露 | 未披露 | 未提供 |');
  } else {
    for (const row of rows) {
      const link = row.url ? `[查看](${row.url})` : '未提供';
      lines.push(`| ${markdownCell(row.id)} | ${markdownCell(row.platform)} | ${row.price == null ? '未披露' : `¥${Number(row.price).toLocaleString('zh-CN')}`} | ${markdownCell(row.server)} | ${row.final_score ?? '未评分'} | ${markdownCell(row.confidence)} | ${markdownCell(row.published_at)} | ${markdownCell(row.platform_verified_at)} | ${link} |`);
    }
  }
  lines.push('', '## 证据覆盖', '', '| 来源 | 状态 | 结果数 | Operation |', '|---|---|---:|---|');
  if (attempts.length === 0) lines.push('| 无 | 未执行 | 0 | 无 |');
  for (const attempt of attempts) {
    lines.push(`| ${markdownCell(attempt.platform ?? attempt.source)} | ${markdownCell(attempt.status)} | ${Number(attempt.result_count ?? 0)} | ${markdownCell(attempt.operation ?? attempt.knowledge_status ?? 'user_material')} |`);
  }
  lines.push('', `覆盖缺口：${gaps.length ? gaps.map((gap) => typeof gap === 'string' ? gap : gap.summary ?? gap.id ?? JSON.stringify(gap)).join('；') : '无。'}`);
  lines.push('', '## 本轮复盘与 Self-improve', '');
  lines.push(`知识候选：已应用 ${knowledge.applied} 条，已验证既有能力 ${knowledge.verified_existing} 条，待验证 ${knowledge.pending} 条。`);
  lines.push('本轮 selection_profile 仅用于本次排序，不写入永久估值知识；未知字段不获得隐含加分。');
  if (rows.length) {
    const missing = [...new Set(rows.flatMap((row) => row.missing_fields))];
    lines.push(`仍需人工核验：${missing.length ? missing.join('、') : '无额外字段。'}`);
  }
  return `${lines.join('\n')}\n`;
}

function ensureRunProvenance(artifact) {
  const rawUserRequest = String(artifact.request_provenance.raw_user_request);
  const profileInput = String(artifact.request_provenance.profile_input);
  artifact.request_provenance = {
    ...(artifact.request_provenance ?? {}),
    raw_user_request: rawUserRequest,
    raw_user_request_sha256: sha256(rawUserRequest),
    profile_input: profileInput,
    profile_input_sha256: sha256(profileInput),
  };
  if (artifact.selection_profile) {
    artifact.selection_profile.persistence_scope = 'run_only';
    artifact.profile_isolation = {
      persistence_scope: 'run_only',
      durable_updates_from_profile: [],
      ...(artifact.profile_isolation ?? {}),
    };
  }
}

function validateArtifactIdentityAndProvenance(artifact, config) {
  const issues = [];
  if (String(artifact.game ?? '') !== config.gameLabel) issues.push(`game must equal ${config.gameLabel}`);
  if (String(artifact.target_skill ?? '') !== config.targetSkill) issues.push(`target_skill must equal ${config.targetSkill}`);
  const userRequest = String(artifact.user_request ?? '');
  const provenance = artifact.request_provenance;
  if (!userRequest) issues.push('user_request is required');
  if (!provenance || typeof provenance !== 'object') {
    issues.push('request_provenance is required');
    return issues;
  }
  const rawUserRequest = String(provenance.raw_user_request ?? '');
  const profileInput = String(provenance.profile_input ?? '');
  if (!rawUserRequest) issues.push('request_provenance.raw_user_request is required');
  if (rawUserRequest !== userRequest) issues.push('request_provenance.raw_user_request must equal user_request');
  if (provenance.raw_user_request_sha256 !== sha256(rawUserRequest)) issues.push('request_provenance.raw_user_request_sha256 is invalid');
  if (!profileInput) issues.push('request_provenance.profile_input is required');
  if (provenance.profile_input_sha256 !== sha256(profileInput)) issues.push('request_provenance.profile_input_sha256 is invalid');
  return issues;
}

function bindDeliveryContract(artifact, config) {
  artifact.final_response = renderGameEvaluationReport(artifact, config);
  artifact.final_response_draft = artifact.final_response;
  const rows = evaluationRows(artifact, config.scoreKey);
  artifact.delivery_contract = {
    mode: 'verbatim_required',
    generated_by: 'skills/game-account-toolkit/scripts/finalize-game-evaluation.mjs',
    final_response_sha256: sha256(artifact.final_response),
    rendered_listing_ids: rows.map((row) => String(row.id)),
    required_sections: ['候选结果', '证据覆盖', '本轮复盘与 Self-improve'],
    instruction: 'Return final_response verbatim after the quality gate passes.',
  };
}

export function finalizeGameEvaluation(config, args = process.argv.slice(2)) {
  const input = readArg(args, '--input');
  if (!input) {
    console.error('Usage: finalize-evaluation-run.mjs --input <run-artifact.json> [--report-out <report.md>]');
    return 2;
  }

  const artifactPath = path.resolve(input);
  const reportPath = path.resolve(readArg(args, '--report-out', sidecarPath(artifactPath, 'md')));
  const optimizerPath = path.resolve(readArg(args, '--optimizer-out', sidecarPath(artifactPath, 'optimizer.json')));
  const evaluatorPath = path.resolve(readArg(args, '--evaluator-out', sidecarPath(artifactPath, 'evaluator.json')));
  const outputPaths = [artifactPath, reportPath, optimizerPath, evaluatorPath];
  if (new Set(outputPaths).size !== outputPaths.length) {
    console.error('Artifact, report, optimizer, and evaluator paths must be distinct');
    return 1;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const inputIssues = validateArtifactIdentityAndProvenance(artifact, config);
  if (inputIssues.length) {
    console.error(`Invalid run artifact identity/provenance: ${inputIssues.join('; ')}`);
    return 1;
  }

  artifact.schema_version = '3.0';
  artifact.game = config.gameLabel;
  artifact.target_skill = config.targetSkill;
  artifact.coverage_gaps = Array.isArray(artifact.coverage_gaps) ? artifact.coverage_gaps : [];
  artifact.knowledge_update_candidates = Array.isArray(artifact.knowledge_update_candidates) ? artifact.knowledge_update_candidates : [];
  delete artifact.optimizer_report;
  delete artifact.evaluation_reports;
  delete artifact.quality_gate;
  ensureRunProvenance(artifact);
  artifact.presentation = { format: 'markdown_table', table_output_required: true, report_path: reportPath, status: 'complete' };
  artifact.self_improve = {
    closeout_required: true,
    status: 'quality_gate_pending',
    summary_generated: true,
    coverage_gaps_recorded: true,
    optimizer: { status: 'pending', report_path: optimizerPath },
    evaluator: { status: 'pending', report_path: evaluatorPath },
    knowledge_candidates: knowledgeState(artifact.knowledge_update_candidates),
    profile_preferences_persisted: false,
  };
  bindDeliveryContract(artifact, config);
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
  bindDeliveryContract(artifact, config);
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
    delivery_contract: artifact.delivery_contract,
  }, null, 2));
  return artifact.quality_gate.redo_required ? 1 : 0;
}
