#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseArknightsOperation } from '../ego-operations/arknights-parsers.mjs';
import { buildBrowserScript, normalizeOperationUrl } from '../ego-operations/browser-scripts.mjs';
import { parseGenericGameOperation } from '../ego-operations/generic-game-parsers.mjs';
import { parseZzzOperation } from '../ego-operations/zzz-parsers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolkitRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(toolkitRoot, 'ego-operations', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rawArgs = process.argv.slice(2);
const wantsJson = rawArgs.includes('--json');

function valueAfter(flag, fallback = null) {
  const inline = rawArgs.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = rawArgs.indexOf(flag);
  return index === -1 ? fallback : rawArgs[index + 1] ?? fallback;
}

function valuesAfter(flag) {
  const values = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (rawArgs[index].startsWith(`${flag}=`)) values.push(rawArgs[index].slice(flag.length + 1));
    else if (rawArgs[index] === flag && rawArgs[index + 1] != null) values.push(rawArgs[index + 1]);
  }
  return [...new Set(values.filter(Boolean).map(String))];
}

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation <site/name> --task-space <name> [options]',
    '',
    'Runs one read-only ego-ops-governed operation through ego-browser.',
    '',
    'Options:',
    '  --operation <site/name>           Operation id from ego-operations/manifest.json.',
    '  --task-space <name|id>            Named task space reused by the parent query goal.',
    '  --input <url|id>                  Detail operation input.',
    '  --url <url>                       URL for generic/semantic-search.',
    '  --match <public text>             Return bounded DOM ancestry for matching public text. Repeatable.',
    '  --follow-match <public text>      Follow one exact visible match before returning page evidence.',
    '  --expected <text>                 Additional live page signal. Repeatable.',
    '  --min-price <CNY> --max-price <CNY> --limit <n> --page <n> --sort <mode>',
    '  --task-space-disposition <mode>   complete (default) or keep for a parent multi-operation run.',
    '  --allow-exploration              Explicitly allow an unverified operation for controlled exploration.',
    '  --raw-fixture <file>              Parse a deterministic raw page fixture without opening a browser.',
    '  --json                            Emit JSON.',
  ].join('\n');
}

if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  console.log(usage());
  process.exit(0);
}

const operationId = valueAfter('--operation');
const operation = manifest.operations.find((item) => item.id === operationId);
if (!operation) {
  console.error(`Unknown or missing --operation. Available: ${manifest.operations.map((item) => item.id).join(', ')}`);
  process.exit(2);
}

const fixturePath = valueAfter('--raw-fixture');
const taskSpace = valueAfter('--task-space', `game-account-${operation.site}-${Date.now()}`);
const disposition = valueAfter('--task-space-disposition', 'complete');
const allowExploration = rawArgs.includes('--allow-exploration');
if (!['complete', 'keep'].includes(disposition)) {
  console.error('--task-space-disposition must be complete or keep');
  process.exit(2);
}

const options = {
  minPrice: valueAfter('--min-price', '0'),
  maxPrice: valueAfter('--max-price', '0'),
  limit: valueAfter('--limit', '20'),
  page: valueAfter('--page', '1'),
  sort: valueAfter('--sort', 'default'),
  matchTexts: valuesAfter('--match'),
  followMatch: valueAfter('--follow-match'),
};
const input = operation.id === 'generic/semantic-search' ? valueAfter('--url') : valueAfter('--input');
let url;
try {
  url = normalizeOperationUrl(operation.id, input, operation.entry);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

function resolveEgoOpsRoot() {
  const candidates = [
    process.env.GAME_ACCOUNT_EGO_OPS_DIR,
    path.join(os.homedir(), '.codex', 'skills', 'ego-ops'),
    path.join(os.homedir(), '.agents', 'skills', 'ego-ops'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md'))) ?? null;
}

function markdownSection(content, heading) {
  const source = String(content ?? '');
  const marker = `## ${heading}`;
  const markerIndex = source.split('\n').findIndex((line) => line.trim() === marker);
  if (markerIndex < 0) return '';
  const lines = source.split('\n').slice(markerIndex + 1);
  const nextHeading = lines.findIndex((line) => line.startsWith('## '));
  return (nextHeading < 0 ? lines : lines.slice(0, nextHeading)).join('\n').trim();
}

function frontmatterValue(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(content ?? '').match(new RegExp(`^${escaped}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
}

function resolveKnowledge(root) {
  if (operation.site === 'dynamic') return {
    status: 'generic_readonly_operation', reference: null, site_index: null, progressive_read: [], checkpoints: [], success: null, knowledge_sha256: null,
  };
  if (!root) return {
    status: 'exploration_required', reference: null, site_index: null, progressive_read: [], checkpoints: [], success: null, knowledge_sha256: null,
  };
  const globalIndex = path.join(root, 'references', 'sites', 'index.md');
  const siteIndex = path.join(root, 'references', 'sites', operation.site, 'index.md');
  const operationSlug = operation.id.split('/')[1];
  const reference = path.join(root, 'references', 'sites', operation.site, 'operations', `${operationSlug}.md`);
  const progressiveRead = [globalIndex, siteIndex, reference].filter((file) => fs.existsSync(file));
  if (!fs.existsSync(reference)) return {
    status: 'exploration_required', reference: null, site_index: fs.existsSync(siteIndex) ? siteIndex : null,
    progressive_read: progressiveRead, checkpoints: [], success: null, knowledge_sha256: null,
  };
  const globalContent = fs.existsSync(globalIndex) ? fs.readFileSync(globalIndex, 'utf8') : '';
  const siteContent = fs.existsSync(siteIndex) ? fs.readFileSync(siteIndex, 'utf8') : '';
  const operationContent = fs.readFileSync(reference, 'utf8');
  const indexedSite = globalContent.includes(`(${operation.site}/index.md)`);
  const indexedOperation = siteContent.includes(`(operations/${operationSlug}.md)`);
  const frontmatterMatches = frontmatterValue(operationContent, 'site') === operation.site
    && frontmatterValue(operationContent, 'operation') === operationSlug;
  const checkpoints = markdownSection(operationContent, '检查点')
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  const success = markdownSection(operationContent, '成功标准').split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
  return {
    status: indexedSite && indexedOperation && frontmatterMatches && checkpoints.length && success
      ? 'verified_operation_available'
      : 'operation_drift',
    reference,
    site_index: fs.existsSync(siteIndex) ? siteIndex : null,
    progressive_read: progressiveRead,
    checkpoints,
    success: success || null,
    knowledge_sha256: crypto.createHash('sha256').update(operationContent).digest('hex'),
  };
}

function run(command, commandArgs, { inputText = null, timeout = 60000 } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8', input: inputText, timeout, maxBuffer: 1024 * 1024 * 16,
  });
  return {
    ok: result.status === 0, status: result.status, signal: result.signal,
    stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim(),
    duration_ms: Date.now() - startedAt, command: [command, ...commandArgs].join(' '),
  };
}

function parseLastJson(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch {}
  }
  return null;
}

function isControlStop(execution) {
  return /user is controlling|inactive|not assigned to an agent/i.test(`${execution.stderr}\n${execution.stdout}`);
}

function parseData(raw) {
  if (operation.id.includes('/arknights-')) return parseArknightsOperation(operation.id, raw, options);
  if (operation.game === 'zenless-zone-zero') return parseZzzOperation(operation.id, raw, options);
  if (['wuthering-waves', 'neverness-to-everness'].includes(operation.game)) return parseGenericGameOperation(operation.id, raw, options);
  if (operation.id === 'generic/semantic-search') return raw;
  throw new Error(`No parser for ${operation.id}`);
}

function requestedListingId() {
  if (operation.mode !== 'detail') return null;
  const source = String(input ?? url ?? '');
  if (operation.site === 'pxb7') return source.match(/\/product\/([^/?#]+)/i)?.[1] ?? (/^[A-Za-z0-9_-]+$/.test(source) ? source : null);
  if (operation.site === 'pzds') return source.match(/\/goodsDetails\/([^/?#]+)/i)?.[1] ?? (/^[A-Za-z0-9_-]+$/.test(source) ? source : null);
  return null;
}

function validateData(data) {
  if (operation.mode === 'list') {
    if (!Array.isArray(data) || data.length === 0) return ['no_rows'];
    const ids = data.map((row) => String(row.listingId ?? '')).filter(Boolean);
    const urls = data.map((row) => String(row.url ?? '')).filter(Boolean);
    const reasons = [];
    if (ids.length !== data.length) reasons.push('listing_id_missing');
    if (new Set(ids).size !== ids.length) reasons.push('listing_id_not_unique');
    if (urls.length !== data.length) reasons.push('source_url_missing');
    if (data.some((row) => !Number.isFinite(Number(row.priceCny)))) reasons.push('price_missing');
    return reasons;
  }
  if (operation.mode === 'detail') {
    const row = Array.isArray(data) ? data[0] : null;
    const expectedId = requestedListingId();
    return [
      ...(!row?.listingId ? ['listing_id_missing'] : []),
      ...(expectedId && row?.listingId && String(row.listingId) !== String(expectedId) ? ['listing_id_mismatch'] : []),
      ...(!Number.isFinite(Number(row?.priceCny)) ? ['price_missing'] : []),
      ...(!row?.url ? ['source_url_missing'] : []),
      ...(row?.status?.sourceStatus !== 'success' ? ['detail_source_partial'] : []),
    ];
  }
  if (!data?.url || !data?.title) return ['page_identity_missing'];
  return [];
}

function completeTaskSpace(target) {
  const script = [
    `const target = ${JSON.stringify(target)}`,
    'const spaces = await listTaskSpaces()',
    'const matched = spaces.find((space) => String(space.id) === String(target) || String(space.taskId) === String(target) || String(space.name) === String(target))',
    "if (!matched) cliLog(JSON.stringify({ done: true, already_closed: true }))",
    "else if (matched.ownership !== 'agent') cliLog(JSON.stringify({ done: false, skipped: 'task-space-not-agent-owned', ownership: matched.ownership, id: matched.id, name: matched.name }))",
    "else { const result = await completeTaskSpace(matched.id, { keep: false }); cliLog(JSON.stringify({ id: matched.id, name: matched.name, ...result })) }",
  ].join('\n');
  const execution = run('ego-browser', ['nodejs'], { inputText: `${script}\n`, timeout: 30000 });
  const result = parseLastJson(`${execution.stdout}\n${execution.stderr}`);
  return { ok: execution.ok && result?.done === true, result, execution: { ok: execution.ok, status: execution.status, duration_ms: execution.duration_ms } };
}

const egoOpsRoot = resolveEgoOpsRoot();
const knowledge = resolveKnowledge(egoOpsRoot);
const genericOperation = operation.availability === 'generic_readonly';
const verifiedOperationReady = operation.availability === 'verified'
  && knowledge.status === 'verified_operation_available';
const explorationAuthorized = allowExploration && !genericOperation;
const knowledgeBlocked = !fixturePath
  && !genericOperation
  && !verifiedOperationReady
  && !explorationAuthorized;
const expectedSignals = [...new Set([...(operation.expected_signals ?? []), ...valuesAfter('--expected')])];
const taskCard = {
  goal: `read ${operation.id} data for the current game-account query`,
  site: operation.site,
  operation: operation.id,
  unique_object: operation.mode === 'detail' || operation.mode === 'search' ? url : `${operation.site}:${operation.id}:${options.minPrice}-${options.maxPrice}:page-${options.page}`,
  allowed_actions: ['navigate', 'observe', 'read', 'extract'],
  forbidden_actions: ['publish', 'purchase', 'message', 'delete', 'change-login', 'change-account'],
  risk: operation.risk,
  manifest_availability: operation.availability,
  exploration_authorized: explorationAuthorized,
  knowledge_checkpoints: knowledge.checkpoints,
  success_criteria: [...new Set([knowledge.success, operation.success, 'page identity matches the requested site', 'result keeps unique ids and source URLs'].filter(Boolean))],
  stop_conditions: ['user takes browser control', 'login or permission is insufficient', 'verification or anti-bot page blocks observation', 'object identity is ambiguous', 'critical fields conflict'],
  task_space_disposition: disposition,
};

let payload = null;
let execution = null;
if (fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8'));
  payload = { task_space_id: null, task_space_name: 'fixture', page: fixture.page ?? { url, title: 'fixture' }, semantic: fixture.semantic ?? '', raw: fixture.raw ?? fixture, error_events: [] };
  execution = { ok: true, status: 0, signal: null, stdout: '', stderr: '', duration_ms: 0, command: 'fixture' };
} else if (knowledgeBlocked) {
  execution = {
    ok: false,
    status: 1,
    signal: null,
    stdout: '',
    stderr: `Operation ${operation.id} is not verified by both the support manifest and ego-ops knowledge.`,
    duration_ms: 0,
    command: 'ego-browser not started',
  };
} else {
  const browserScript = buildBrowserScript(operation.id, options);
  const waitSeconds = Math.max(1, Math.min(Number(valueAfter('--wait', '3')) || 3, 10));
  const script = [
    `const task = await useOrCreateTaskSpace(${JSON.stringify(taskSpace)})`,
    'const tabs = await listTabs()',
    `if (tabs.length) await gotoAndWait(${JSON.stringify(url)}, { timeout: 25, settle: 2 }); else await openOrReuseTab(${JSON.stringify(url)}, { wait: true, timeout: 25 })`,
    `await wait(${waitSeconds})`,
    'const page = await pageInfo()',
    'const semanticValue = await snapshotText()',
    `const raw = await js(${JSON.stringify(browserScript)})`,
    'const events = await drainEvents()',
    "const errorEvents = events.filter((event) => /error|fail|blocked/i.test(JSON.stringify(event))).slice(0, 20)",
    "const semantic = String(typeof semanticValue === 'string' ? semanticValue : JSON.stringify(semanticValue)).slice(0, 4000)",
    "cliLog(JSON.stringify({ task_space_id: task.id, task_space_name: task.name, page, semantic, raw, error_events: errorEvents }))",
  ].join('\n');
  execution = run('ego-browser', ['nodejs'], { inputText: `${script}\n`, timeout: 90000 });
  payload = parseLastJson(`${execution.stdout}\n${execution.stderr}`);
}

const hardStop = !fixturePath && isControlStop(execution);
const reasons = [];
if (knowledgeBlocked) reasons.push('ego_ops_operation_not_verified');
else if (!execution.ok || !payload) reasons.push('browser_operation_failed');
if (hardStop) reasons.push('browser_control_handoff');
if (payload?.page?.url) {
  try {
    const actualHost = new URL(payload.page.url).hostname;
    if (operation.domain !== 'user-supplied' && actualHost !== operation.domain) reasons.push('page_domain_mismatch');
  } catch { reasons.push('page_url_invalid'); }
}
const observedText = `${payload?.page?.title ?? ''}\n${payload?.semantic ?? ''}\n${payload?.raw?.text ?? ''}`;
if (!knowledgeBlocked && expectedSignals.length && !expectedSignals.every((signal) => observedText.includes(signal))) reasons.push('expected_page_signal_missing');
if (!knowledgeBlocked && /(滑块验证|安全验证|人机验证|请完成验证|验证后继续|访问过于频繁|安全校验|captcha|403\s*forbidden|http\s*403|access\s+denied|forbidden\s+error)/i.test(observedText)) reasons.push('verification_or_blocker_detected');
if (!knowledgeBlocked && (payload?.error_events?.length ?? 0) > 0) reasons.push('browser_error_events');

let data = null;
if (payload?.raw != null && !hardStop) {
  try { data = parseData(payload.raw); }
  catch (error) { reasons.push(`parse_failed:${error instanceof Error ? error.message : String(error)}`); }
}
if (data != null) reasons.push(...validateData(data));

const completionTarget = payload?.task_space_id ?? taskSpace;
const completion = fixturePath || hardStop || knowledgeBlocked || disposition === 'keep' ? null : completeTaskSpace(completionTarget);
if (!fixturePath && !hardStop && !knowledgeBlocked && disposition === 'complete' && completion?.ok !== true) reasons.push('task_space_cleanup_failed');
const uniqueReasons = [...new Set(reasons)];
const report = {
  ok: uniqueReasons.length === 0,
  query_governance: 'ego_ops',
  browser_transport: 'ego_browser',
  operation: operation.id,
  task_card: taskCard,
  ego_ops: {
    root: egoOpsRoot,
    local_experience: egoOpsRoot && fs.existsSync(path.join(egoOpsRoot, 'experience.local.md')) ? 'available' : 'missing',
    knowledge_status: knowledge.status,
    site_index: knowledge.site_index,
    operation_reference: knowledge.reference,
    progressive_read: knowledge.progressive_read,
    knowledge_sha256: knowledge.knowledge_sha256,
    checkpoint_count: knowledge.checkpoints.length,
    manifest_availability: operation.availability,
    exploration_authorized: explorationAuthorized,
    writeback_candidate: allowExploration && operation.site !== 'dynamic' && ['exploration_required', 'operation_drift'].includes(knowledge.status) && uniqueReasons.length === 0,
  },
  task_space_id: payload?.task_space_id ?? null,
  task_space_name: payload?.task_space_name ?? String(taskSpace),
  page: payload?.page ?? null,
  evidence: {
    expected_signals: expectedSignals,
    matched_signals: expectedSignals.filter((signal) => observedText.includes(signal)),
    semantic_character_count: String(payload?.semantic ?? '').length,
    semantic_sha256: payload?.semantic ? crypto.createHash('sha256').update(String(payload.semantic)).digest('hex') : null,
    error_events: payload?.error_events ?? [],
    result_count: Array.isArray(data) ? data.length : data ? 1 : 0,
  },
  data,
  reasons: uniqueReasons,
  needs_user_action: hardStop || completion?.result?.skipped === 'task-space-not-agent-owned',
  completion,
  execution: { ok: execution.ok, status: execution.status, signal: execution.signal, duration_ms: execution.duration_ms, command: execution.command },
};

if (wantsJson) console.log(JSON.stringify(report, null, 2));
else {
  console.log('<ego_operation_report>');
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <operation>${report.operation}</operation>`);
  console.log(`  <knowledge_status>${report.ego_ops.knowledge_status}</knowledge_status>`);
  console.log(`  <task_space_id>${report.task_space_id ?? ''}</task_space_id>`);
  console.log(`  <result_count>${report.evidence.result_count}</result_count>`);
  console.log(`  <reasons format="json">${JSON.stringify(report.reasons)}</reasons>`);
  console.log('</ego_operation_report>');
}

// Let Node drain large JSON reports before exit. Calling process.exit() here can
// truncate piped stdout at the OS pipe-buffer boundary (commonly 64 KiB), which
// makes parent runners misclassify a successful ego-browser operation as failed.
process.exitCode = report.ok ? 0 : 1;
