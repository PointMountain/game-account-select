#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
const chromeUseSessions = valuesAfter('--chrome-use-session');
const targets = valuesAfter('--target');
const captureBaselinePath = valueAfter('--capture-baseline');
const baselinePath = valueAfter('--baseline');
const targetsFixturePath = valueAfter('--targets-fixture');
const windowsFixturePath = valueAfter('--windows-fixture');
const closeMatchingUrls = args.has('--close-matching-urls');
const closeNewQueryTargets = args.has('--close-new-query-targets');
const processPattern = valueAfter('--process-pattern', 'opencli\\s+browser\\s+gas-|run-with-timeout|pxb7|pzds|zzz-detail|selectPageList|goodsList/275');
const kill = args.has('--kill');
const includeOpencliDaemon = args.has('--include-opencli-daemon');

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/cleanup-query-session.mjs [options]',
    '',
    'Closes exact chrome-use/OpenCLI browser sessions, browser targets owned by the current query, and audits leftover',
    'query processes. It never kills processes unless --kill is passed.',
    '',
    'Options:',
    '  --session <name>          OpenCLI browser session to close. Repeatable.',
    '  --chrome-use-session <n>  Exact chrome-use session to stop. Repeatable.',
    '  --session-prefix <prefix> Prefix for query sessions. Default: gas-',
    '  --target <id>             CDP target id to close. Repeatable.',
    '  --capture-baseline <file> Capture current browser targets and exit without closing anything.',
    '  --baseline <file>         Browser-target baseline captured before this query.',
    '  --close-new-query-targets Close only post-baseline platform pages and about:blank placeholders.',
    '  --close-matching-urls     Also close every current tab matching --close-url-pattern.',
    '                            Off by default because a matching tab may belong to the user.',
    '  --close-url-pattern <re>  Platform URL/title regex used by the two opt-in close modes.',
    '  --targets-fixture <file>  Read CDP targets from a fixture instead of the live relay (tests only).',
    '  --windows-fixture <file>  Read Chrome windows from a fixture instead of macOS Chrome (tests only).',
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

function closeChromeUseSession(session) {
  const stop = dryRun
    ? { ok: true, command: `chrome-use session stop ${session}`, stdout: 'dry-run', stderr: '' }
    : run('chrome-use', ['session', 'stop', session], 10000);
  return { session, stop };
}

function listCdpTargets() {
  if (targetsFixturePath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.resolve(targetsFixturePath), 'utf8'));
      const fixtureTargets = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.targets) ? parsed.targets : [];
      return {
        result: { ok: true, status: 0, signal: null, stdout: '', stderr: '', command: `fixture:${path.resolve(targetsFixturePath)}` },
        supported: true,
        targets: fixtureTargets,
      };
    } catch (error) {
      return {
        result: { ok: false, status: 1, signal: null, stdout: '', stderr: error instanceof Error ? error.message : String(error), command: `fixture:${path.resolve(targetsFixturePath)}` },
        supported: true,
        targets: [],
      };
    }
  }
  const result = run('curl', ['-s', '--max-time', '3', 'http://localhost:3456/targets'], 5000);
  const parsed = parseJson(result.stdout, null);
  if (!Array.isArray(parsed)) {
    return {
      result: {
        ...result,
        ok: false,
        stderr: result.stderr || 'CDP target relay did not return a JSON array',
      },
      supported: false,
      targets: [],
    };
  }
  return {
    result,
    supported: true,
    targets: parsed,
  };
}

function compactTarget(target) {
  return {
    targetId: target?.targetId ?? target?.id ?? null,
    type: target?.type ?? null,
    url: target?.url ?? null,
    title: target?.title ?? null,
  };
}

function compactBaselineTarget(target) {
  return {
    targetId: target?.targetId ?? target?.id ?? null,
    type: target?.type ?? null,
  };
}

function compactBaselineWindow(window) {
  return { windowId: String(window?.windowId ?? window?.id ?? '') || null };
}

function targetIdOf(target) {
  return target?.targetId ?? target?.id ?? null;
}

function isBlankTarget(target) {
  const url = String(target?.url ?? '').trim();
  const title = String(target?.title ?? '').trim();
  return url === 'about:blank' && (title === '' || title === 'about:blank');
}

function listChromeWindows() {
  if (windowsFixturePath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.resolve(windowsFixturePath), 'utf8'));
      return {
        result: { ok: true, status: 0, signal: null, stdout: '', stderr: '', command: `fixture:${path.resolve(windowsFixturePath)}` },
        supported: true,
        windows: Array.isArray(parsed) ? parsed : Array.isArray(parsed?.windows) ? parsed.windows : [],
      };
    } catch (error) {
      return {
        result: { ok: false, status: 1, signal: null, stdout: '', stderr: error instanceof Error ? error.message : String(error), command: `fixture:${path.resolve(windowsFixturePath)}` },
        supported: true,
        windows: [],
      };
    }
  }
  if (process.platform !== 'darwin') {
    return {
      result: { ok: true, status: 0, signal: null, stdout: '', stderr: '', command: 'unsupported-non-macos' },
      supported: false,
      windows: [],
    };
  }
  const source = [
    'const chrome = Application("Google Chrome");',
    'if (!chrome.running()) JSON.stringify([]);',
    'else JSON.stringify(chrome.windows().map((win) => ({',
    '  windowId: String(win.id()),',
    '  tabs: win.tabs().map((tab) => ({ tabId: String(tab.id()), url: String(tab.url() || ""), title: String(tab.title() || "") }))',
    '})));',
  ].join('\n');
  const result = run('osascript', ['-l', 'JavaScript', '-e', source], 10000);
  const windows = parseJson(result.stdout, null);
  return {
    result: Array.isArray(windows) ? result : { ...result, ok: false, stderr: result.stderr || 'Chrome window audit did not return a JSON array' },
    supported: true,
    windows: Array.isArray(windows) ? windows : [],
  };
}

function windowIdOf(window) {
  const id = window?.windowId ?? window?.id;
  return id == null ? null : String(id);
}

function closeChromeWindow(windowId) {
  if (dryRun) {
    return { ok: true, command: `close Google Chrome window ${windowId}`, stdout: 'dry-run', stderr: '' };
  }
  const source = [
    'const chrome = Application("Google Chrome");',
    `const target = chrome.windows().find((win) => String(win.id()) === ${JSON.stringify(String(windowId))});`,
    'if (!target) JSON.stringify({success:true, alreadyClosed:true});',
    'else { target.close(); JSON.stringify({success:true, alreadyClosed:false}); }',
  ].join('\n');
  return run('osascript', ['-l', 'JavaScript', '-e', source], 10000);
}

function isOwnedWindow(window, closeRegex) {
  const tabs = Array.isArray(window?.tabs) ? window.tabs : [];
  if (!tabs.length) return true;
  return tabs.every((tab) => isBlankTarget(tab) || closeRegex.test(`${tab?.url ?? ''}\n${tab?.title ?? ''}`));
}

function loadBaseline(file) {
  if (!file) return { path: null, ok: true, ids: new Set(), windowIds: new Set(), error: null };
  const absolute = path.resolve(file);
  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    const baselineTargets = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.targets) ? parsed.targets : [];
    return {
      path: absolute,
      ok: true,
      ids: new Set(baselineTargets.map(targetIdOf).filter(Boolean)),
      windowIds: new Set((Array.isArray(parsed?.windows) ? parsed.windows : []).map(windowIdOf).filter(Boolean)),
      error: null,
    };
  } catch (error) {
    return {
      path: absolute,
      ok: false,
      ids: new Set(),
      windowIds: new Set(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeBaseline(file, targetState, windowState) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const baseline = {
    schema_version: 2,
    captured_at: new Date().toISOString(),
    source: targetState.result.command,
    // A lifecycle baseline only needs stable target ids. Do not persist the
    // user's pre-existing URLs or titles in a temporary query artifact.
    targets: targetState.targets.filter((target) => target?.type === 'page').map(compactBaselineTarget),
    // Window ids let cleanup remove a new automation popup even when Chrome
    // replaces its last target with a fresh about:blank placeholder.
    windows: windowState.result.ok ? windowState.windows.map(compactBaselineWindow) : [],
  };
  fs.writeFileSync(absolute, `${JSON.stringify(baseline, null, 2)}\n`);
  return { absolute, baseline };
}

if (captureBaselinePath) {
  const targetState = listCdpTargets();
  const windowState = listChromeWindows();
  const windowOnlyFallback = targetState.supported === false && windowState.supported && windowState.result.ok;
  let capture = null;
  let captureError = null;
  if (targetState.result.ok || windowOnlyFallback) {
    try {
      capture = writeBaseline(captureBaselinePath, targetState, windowState);
    } catch (error) {
      captureError = error instanceof Error ? error.message : String(error);
    }
  } else {
    captureError = targetState.result.stderr || 'browser target relay unavailable';
  }
  const captureReport = {
    ok: capture !== null,
    mode: 'capture_baseline',
    dry_run: dryRun,
    baseline_path: capture?.absolute ?? path.resolve(captureBaselinePath),
    target_count: capture?.baseline.targets.length ?? 0,
    window_count: capture?.baseline.windows.length ?? 0,
    cdp_target_audit_supported: targetState.supported !== false,
    window_baseline_supported: windowState.supported,
    fallback_used: windowOnlyFallback ? 'chrome_window_baseline' : null,
    error: captureError,
  };
  if (wantsJson) {
    console.log(JSON.stringify(captureReport, null, 2));
  } else {
    console.log('<query_browser_baseline>');
    console.log(`  <ok>${captureReport.ok}</ok>`);
    console.log(`  <baseline_path>${captureReport.baseline_path}</baseline_path>`);
    console.log(`  <target_count>${captureReport.target_count}</target_count>`);
    console.log(`  <window_count>${captureReport.window_count}</window_count>`);
    console.log('</query_browser_baseline>');
  }
  process.exit(captureReport.ok ? 0 : 1);
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
    .filter((line) => !/npm(?:\s+run)?\s+query:cleanup/i.test(line))
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
const chromeUseSessionClosures = unique(chromeUseSessions).map(closeChromeUseSession);

const cdpBefore = listCdpTargets();
const baseline = loadBaseline(baselinePath);
const closeRegex = new RegExp(closeUrlPattern, 'i');
const pageTargetsBefore = cdpBefore.targets.filter((target) => target?.type === 'page');
const newTargets = baselinePath && baseline.ok
  ? pageTargetsBefore.filter((target) => !baseline.ids.has(targetIdOf(target)))
  : [];
const closeCandidates = new Map();
function addCloseCandidate(targetId, reason) {
  if (!targetId) return;
  const reasons = closeCandidates.get(targetId) ?? [];
  closeCandidates.set(targetId, unique([...reasons, reason]));
}
for (const targetId of targets) addCloseCandidate(targetId, 'explicit_target');
if (closeMatchingUrls) {
  for (const target of pageTargetsBefore) {
    if (closeRegex.test(`${target.url ?? ''}\n${target.title ?? ''}`)) addCloseCandidate(targetIdOf(target), 'matching_url_opt_in');
  }
}
if (closeNewQueryTargets) {
  for (const target of newTargets) {
    if (isBlankTarget(target)) addCloseCandidate(targetIdOf(target), 'new_opencli_blank_placeholder');
    else if (closeRegex.test(`${target.url ?? ''}\n${target.title ?? ''}`)) addCloseCandidate(targetIdOf(target), 'new_query_url');
  }
}
const cdpTargetsToClose = [...closeCandidates.keys()];
const cdpClosures = cdpTargetsToClose.map((targetId) => ({
  targetId,
  reasons: closeCandidates.get(targetId),
  close: closeCdpTarget(targetId),
}));
const chromeWindowsBefore = listChromeWindows();
const newChromeWindows = baselinePath && baseline.ok && chromeWindowsBefore.result.ok
  ? chromeWindowsBefore.windows.filter((window) => !baseline.windowIds.has(windowIdOf(window)))
  : [];
const chromeWindowCandidates = closeNewQueryTargets
  ? newChromeWindows.filter((window) => isOwnedWindow(window, closeRegex))
  : [];
const chromeWindowClosures = chromeWindowCandidates.map((window) => ({
  windowId: windowIdOf(window),
  tab_count: Array.isArray(window?.tabs) ? window.tabs.length : 0,
  reasons: ['post_baseline_window_contains_only_query_or_blank_tabs'],
  close: closeChromeWindow(windowIdOf(window)),
}));
const chromeWindowsAfter = dryRun ? chromeWindowsBefore : listChromeWindows();
const remainingWindowIds = new Set(chromeWindowsAfter.windows.map(windowIdOf).filter(Boolean));
const chromeWindowsRemaining = chromeWindowClosures.map((item) => item.windowId).filter((id) => remainingWindowIds.has(id));
const cdpAfter = dryRun ? cdpBefore : listCdpTargets();
const cdpRemainingTargetIds = new Set(cdpAfter.targets.map(targetIdOf).filter(Boolean));
const cdpTargetsRemaining = cdpTargetsToClose.filter((targetId) => cdpRemainingTargetIds.has(targetId));

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
const cdpAuditPassed = cdpBefore.result.ok
  || (cdpBefore.supported === false && chromeWindowsBefore.supported && chromeWindowsBefore.result.ok);

const report = {
  ok: cdpAuditPassed
    && baseline.ok
    && opencliSessionClosures.every((item) => item.close_session.ok)
    && chromeUseSessionClosures.every((item) => item.stop.ok)
    && chromeWindowClosures.every((item) => item.close.ok)
    && (dryRun || (cdpTargetsRemaining.length === 0 && chromeWindowsRemaining.length === 0)),
  dry_run: dryRun,
  session_prefix: sessionPrefix,
  sessions_requested: sessions,
  sessions_discovered: unique(discoveredSessions),
  opencli_session_closures: opencliSessionClosures,
  chrome_use_sessions_requested: unique(chromeUseSessions),
  chrome_use_session_closures: chromeUseSessionClosures,
  baseline_path: baseline.path,
  baseline_loaded: baseline.ok,
  baseline_error: baseline.error,
  close_matching_urls: closeMatchingUrls,
  close_new_query_targets: closeNewQueryTargets,
  new_targets_detected: newTargets.map(compactTarget),
  cdp_target_audit_supported: cdpBefore.supported !== false,
  cdp_targets_before_count: cdpBefore.targets.length,
  cdp_targets_closed: cdpClosures,
  cdp_targets_after_count: cdpAfter.targets.length,
  cdp_targets_remaining: cdpTargetsRemaining,
  chrome_window_audit_supported: chromeWindowsBefore.supported,
  chrome_window_baseline_count: baseline.windowIds.size,
  new_chrome_windows_detected: newChromeWindows.map((window) => ({
    windowId: windowIdOf(window),
    tab_count: Array.isArray(window?.tabs) ? window.tabs.length : 0,
    owned_query_or_blank_only: isOwnedWindow(window, closeRegex),
  })),
  chrome_windows_closed: chromeWindowClosures,
  chrome_windows_remaining: chromeWindowsRemaining,
  process_audit_before: processAuditBefore.lines,
  kill_requested: kill,
  killed,
  process_audit_after: processAuditAfter.lines,
  notes: [
    'OpenCLI daemon is excluded by default because it is a shared background service.',
    'chrome-use relay is shared; only exact sessions passed with --chrome-use-session are stopped.',
    'URL-wide tab closing is opt-in. Normal runs close explicit target ids and post-baseline query targets only.',
    ...(cdpBefore.supported === false ? ['The legacy CDP target relay was unavailable; cleanup used exact sessions, process audit, and the macOS Chrome window baseline instead.'] : []),
    'A post-baseline about:blank target is treated as an OpenCLI reusable placeholder only when --close-new-query-targets is set.',
    'On macOS, a post-baseline Chrome window is closed only when every tab is a query URL or about:blank; mixed/user windows are preserved.',
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
  console.log(`  <chrome_use_sessions_closed format="json">${JSON.stringify(unique(chromeUseSessions))}</chrome_use_sessions_closed>`);
  console.log(`  <cdp_targets_closed format="json">${JSON.stringify(cdpTargetsToClose)}</cdp_targets_closed>`);
  console.log(`  <cdp_targets_remaining format="json">${JSON.stringify(report.cdp_targets_remaining)}</cdp_targets_remaining>`);
  console.log(`  <chrome_windows_closed format="json">${JSON.stringify(report.chrome_windows_closed.map((item) => item.windowId))}</chrome_windows_closed>`);
  console.log(`  <chrome_windows_remaining format="json">${JSON.stringify(report.chrome_windows_remaining)}</chrome_windows_remaining>`);
  console.log(`  <process_audit_after format="json">${JSON.stringify(report.process_audit_after)}</process_audit_after>`);
  console.log('</query_cleanup_report>');
}
