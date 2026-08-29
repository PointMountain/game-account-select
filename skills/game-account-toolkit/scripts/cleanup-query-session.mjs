#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const wantsJson = args.has('--json');
const dryRun = args.has('--dry-run');

function valueAfter(flag, fallback = null) {
  const index = rawArgs.indexOf(flag);
  if (index === -1 || index + 1 >= rawArgs.length) return fallback;
  return rawArgs[index + 1];
}

function valuesAfter(flag) {
  const values = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (rawArgs[index] === flag && index + 1 < rawArgs.length) values.push(rawArgs[index + 1]);
  }
  return values;
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/cleanup-query-session.mjs [options]',
    '',
    'Completes exact ego-browser task spaces owned by the current query and audits leftover query processes.',
    'It never discovers or closes unrelated task spaces, and never kills processes unless --kill is passed.',
    '',
    'Options:',
    '  --task-space <id|name>       Exact ego-browser task space to complete. Repeatable.',
    '  --process-pattern <re>       Process audit regex.',
    '  --kill                       Stop matched leftover query processes.',
    '  --task-spaces-fixture <file> Read task spaces from a fixture instead of ego-browser (tests only).',
    '  --dry-run                    Report exact completion actions without executing them.',
    '  --json                       Emit JSON.',
  ].join('\n');
}

if (args.has('--help') || args.has('-h')) {
  console.log(usage());
  process.exit(0);
}

const requestedTaskSpaces = unique(valuesAfter('--task-space'));
const fixturePath = valueAfter('--task-spaces-fixture');
const processPattern = valueAfter(
  '--process-pattern',
  'ego-browser\\s+nodejs|run-with-timeout|opencli\\s+(?:pxb7|pzds)|zzz-detail|arknights-(?:list|detail)|selectPageList|goodsList/275',
);
const kill = args.has('--kill');

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    timeout: options.timeout ?? 15000,
    maxBuffer: 1024 * 1024 * 8,
    input: options.input,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    command: [command, ...commandArgs].join(' '),
  };
}

function parseLastJson(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

function readFixture(file) {
  if (!file) return null;
  const absolute = path.resolve(file);
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const taskSpaces = Array.isArray(parsed) ? parsed : parsed.task_spaces;
  if (!Array.isArray(taskSpaces)) throw new Error('--task-spaces-fixture must contain an array or {"task_spaces": []}');
  return { absolute, taskSpaces };
}

function fixtureMatch(taskSpaces, target) {
  return taskSpaces.find((space) => (
    String(space?.id ?? '') === target
    || String(space?.taskId ?? '') === target
    || String(space?.name ?? '') === target
  )) ?? null;
}

function completeOwnedTaskSpace(target, fixture) {
  if (dryRun) {
    const match = fixture ? fixtureMatch(fixture.taskSpaces, target) : null;
    return {
      target,
      ok: true,
      dry_run: true,
      matched: match ? { id: match.id ?? null, taskId: match.taskId ?? null, name: match.name ?? null, ownership: match.ownership ?? null } : null,
      result: { done: false, skipped: 'dry-run' },
      command: `completeTaskSpace(${JSON.stringify(target)}, { keep: false })`,
    };
  }

  const script = [
    `const target = ${JSON.stringify(target)}`,
    'const spaces = await listTaskSpaces()',
    'const matched = spaces.find((space) => String(space.id) === String(target) || String(space.taskId) === String(target) || String(space.name) === String(target))',
    "if (!matched) cliLog(JSON.stringify({ target, done: true, already_closed: true }))",
    "else if (matched.ownership !== 'agent') cliLog(JSON.stringify({ target, done: false, skipped: 'task-space-not-agent-owned', ownership: matched.ownership, id: matched.id, name: matched.name }))",
    'else { const result = await completeTaskSpace(matched.id, { keep: false }); cliLog(JSON.stringify({ target, id: matched.id, name: matched.name, ...result })) }',
  ].join('\n');
  const execution = run('ego-browser', ['nodejs'], { input: `${script}\n`, timeout: 30000 });
  const result = parseLastJson(`${execution.stdout}\n${execution.stderr}`);
  return {
    target,
    ok: execution.ok && result?.done === true,
    dry_run: false,
    matched: result ? { id: result.id ?? null, taskId: result.taskId ?? null, name: result.name ?? null } : null,
    result,
    execution,
  };
}

function auditProcesses() {
  const result = run('ps', ['-axo', 'pid,ppid,etime,command']);
  const regex = new RegExp(processPattern, 'i');
  const selfPid = String(process.pid);
  const lines = result.stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => regex.test(line))
    .filter((line) => !line.includes('cleanup-query-session.mjs'))
    .filter((line) => !/npm(?:\s+run)?\s+query:cleanup/i.test(line))
    .filter((line) => !new RegExp(`^${selfPid}\\s`).test(line));
  return { result, lines };
}

function pidFromPsLine(line) {
  return line.match(/^(\d+)\s+/)?.[1] ?? null;
}

let fixture = null;
try {
  fixture = readFixture(fixturePath);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const processAuditBefore = auditProcesses();
const taskSpaceClosures = requestedTaskSpaces.map((target) => completeOwnedTaskSpace(target, fixture));
const killed = [];
if (kill) {
  for (const line of processAuditBefore.lines) {
    const pid = pidFromPsLine(line);
    if (!pid) continue;
    if (dryRun) {
      killed.push({ pid, line, ok: true, dry_run: true });
      continue;
    }
    const result = run('kill', ['-TERM', pid], { timeout: 5000 });
    killed.push({ pid, line, ok: result.ok, result });
  }
}
const processAuditAfter = dryRun ? processAuditBefore : auditProcesses();
const taskSpacesRemaining = taskSpaceClosures
  .filter((closure) => !closure.ok && !closure.dry_run)
  .map((closure) => closure.target);

const report = {
  ok: taskSpacesRemaining.length === 0 && (!kill || killed.every((item) => item.ok)),
  dry_run: dryRun,
  transport: 'ego_browser',
  task_spaces_fixture: fixture?.absolute ?? null,
  ego_task_spaces_requested: requestedTaskSpaces,
  ego_task_space_closures: taskSpaceClosures,
  ego_task_spaces_remaining: taskSpacesRemaining,
  process_audit_before: processAuditBefore.lines,
  kill_requested: kill,
  killed,
  process_audit_after: processAuditAfter.lines,
  notes: [
    'Only exact task-space ids or names supplied with --task-space are completed.',
    'Each real completion runs in a dedicated ego-browser nodejs process, resolves the exact task space, and closes it only while ownership is agent.',
    'A user-controlled or delegated task space is reported as remaining; cleanup never claims it or takes control back.',
    'Use --kill only for confirmed leftover query commands, never for the ego-browser application or unrelated processes.',
  ],
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('<query_cleanup_report>');
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <transport>${report.transport}</transport>`);
  console.log(`  <task_spaces_requested format="json">${JSON.stringify(report.ego_task_spaces_requested)}</task_spaces_requested>`);
  console.log(`  <task_spaces_remaining format="json">${JSON.stringify(report.ego_task_spaces_remaining)}</task_spaces_remaining>`);
  console.log(`  <process_audit_after format="json">${JSON.stringify(report.process_audit_after)}</process_audit_after>`);
  console.log('</query_cleanup_report>');
}

process.exit(report.ok ? 0 : 1);
