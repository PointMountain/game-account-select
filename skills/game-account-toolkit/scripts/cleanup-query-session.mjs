#!/usr/bin/env node
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

const sessionPrefix = valueAfter('--session-prefix', 'gas-');
const closeUrlPattern = valueAfter('--close-url-pattern', 'pxb7\\.com|pzds\\.com|goodsList/275|www\\.pxb7\\.com/product|www\\.pzds\\.com/goodsDetails');
const sessions = valuesAfter('--session');
const targets = valuesAfter('--target');
const processPattern = valueAfter('--process-pattern', 'opencli\\s+browser\\s+gas-|run-with-timeout|pxb7|pzds|zzz-detail|selectPageList|goodsList/275');
const kill = args.has('--kill');
const includeOpencliDaemon = args.has('--include-opencli-daemon');

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/cleanup-query-session.mjs [options]',
    '',
    'Closes OpenCLI browser sessions, CDP tabs opened during account queries, and audits leftover',
    'query processes. It never kills processes unless --kill is passed.',
    '',
    'Options:',
    '  --session <name>          OpenCLI browser session to close. Repeatable.',
    '  --session-prefix <prefix> Prefix for query sessions. Default: gas-',
    '  --target <id>             CDP target id to close. Repeatable.',
    '  --close-url-pattern <re>  Close CDP tabs whose URL/title matches this regex.',
    '                            Default is scoped to pxb7.com/pzds.com account-query pages.',
    '  --process-pattern <re>    Process audit regex.',
    '  --kill                   Kill matched leftover query processes, excluding OpenCLI daemon',
    '                            unless --include-opencli-daemon is also passed.',
    '  --include-opencli-daemon  Allow audit/kill to include the OpenCLI daemon.',
    '  --dry-run                Report actions without closing or killing.',
    '  --json                  Emit JSON.',
  ].join('\n');
}

if (args.has('--help') || args.has('-h')) {
  console.log(usage());
  process.exit(0);
}

function run(command, commandArgs, timeout = 10000) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 8,
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

function parseJson(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[\[{]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
  }
  return fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function listOpencliTabs(session) {
  const result = run('opencli', ['browser', session, 'tab', 'list'], 10000);
  return {
    session,
    result,
    tabs: parseJson(result.stdout, []),
  };
}

function closeOpencliSession(session) {
  const before = listOpencliTabs(session);
  const closeSession = dryRun
    ? { ok: true, command: `opencli browser ${session} close`, stdout: 'dry-run', stderr: '' }
    : run('opencli', ['browser', session, 'close'], 10000);

  return {
    session,
    before_tabs: before.tabs,
    close_session: closeSession,
  };
}

function listCdpTargets() {
  const result = run('curl', ['-s', '--max-time', '3', 'http://localhost:3456/targets'], 5000);
  return {
    result,
    targets: parseJson(result.stdout, []),
  };
}

function closeCdpTarget(targetId) {
  if (dryRun) {
    return {
      ok: true,
      command: `curl -s http://localhost:3456/close?target=${targetId}`,
      stdout: 'dry-run',
      stderr: '',
    };
  }
  return run('curl', ['-s', '--max-time', '5', `http://localhost:3456/close?target=${targetId}`], 7000);
}

function auditProcesses() {
  const result = run('ps', ['-axo', 'pid,ppid,etime,command'], 10000);
  const regex = new RegExp(processPattern, 'i');
  const selfPid = String(process.pid);
  const lines = result.stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => regex.test(line))
    .filter((line) => !line.includes('cleanup-query-session.mjs'))
    .filter((line) => includeOpencliDaemon || !/\/opencli\/dist\/src\/daemon\.js|@jackwener\/opencli\/dist\/src\/daemon\.js/i.test(line))
    .filter((line) => !new RegExp(`^${selfPid}\\s`).test(line));

  return { result, lines };
}

function pidFromPsLine(line) {
  const match = line.match(/^(\d+)\s+/);
  return match ? match[1] : null;
}

const discoveredSessions = [];
if (sessionPrefix) {
  const audit = auditProcesses();
  for (const line of audit.lines) {
    const regex = /opencli\s+browser\s+(\S+)/g;
    let match = regex.exec(line);
    while (match) {
      if (match[1].startsWith(sessionPrefix)) discoveredSessions.push(match[1]);
      match = regex.exec(line);
    }
  }
}

const sessionsToClose = unique([...sessions, ...discoveredSessions]);
const opencliSessionClosures = sessionsToClose.map(closeOpencliSession);

const cdpBefore = listCdpTargets();
const closeRegex = new RegExp(closeUrlPattern, 'i');
const cdpTargetsToClose = unique([
  ...targets,
  ...cdpBefore.targets
    .filter((target) => target?.type === 'page')
    .filter((target) => closeRegex.test(`${target.url ?? ''}\n${target.title ?? ''}`))
    .map((target) => target.targetId ?? target.id)
]);
const cdpClosures = cdpTargetsToClose.map((targetId) => ({
  targetId,
  close: closeCdpTarget(targetId),
}));

const processAuditBefore = auditProcesses();
const killed = [];
if (kill) {
  for (const line of processAuditBefore.lines) {
    const pid = pidFromPsLine(line);
    if (!pid) continue;
    if (dryRun) {
      killed.push({ pid, line, ok: true, dry_run: true });
      continue;
    }
    const killResult = run('kill', ['-TERM', pid], 5000);
    killed.push({ pid, line, ok: killResult.ok, result: killResult });
  }
}
const processAuditAfter = auditProcesses();

const report = {
  ok: true,
  dry_run: dryRun,
  session_prefix: sessionPrefix,
  sessions_requested: sessions,
  sessions_discovered: unique(discoveredSessions),
  opencli_session_closures: opencliSessionClosures,
  cdp_targets_before_count: cdpBefore.targets.length,
  cdp_targets_closed: cdpClosures,
  process_audit_before: processAuditBefore.lines,
  kill_requested: kill,
  killed,
  process_audit_after: processAuditAfter.lines,
  notes: [
    'OpenCLI daemon is excluded by default because it is a shared background service.',
    'Use --kill only for leftover query commands, not for normal browser or daemon processes.',
  ],
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('<query_cleanup_report>');
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <dry_run>${report.dry_run}</dry_run>`);
  console.log(`  <sessions_closed format="json">${JSON.stringify(sessionsToClose)}</sessions_closed>`);
  console.log(`  <cdp_targets_closed format="json">${JSON.stringify(cdpTargetsToClose)}</cdp_targets_closed>`);
  console.log(`  <process_audit_after format="json">${JSON.stringify(report.process_audit_after)}</process_audit_after>`);
  console.log('</query_cleanup_report>');
}
