#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const wantsJson = args.has('--json');
const repair = args.has('--repair');
const forceRepair = args.has('--force-repair');
const keepOpen = args.has('--keep-open');

function valueAfter(flag, fallback) {
  const index = rawArgs.indexOf(flag);
  if (index === -1 || index + 1 >= rawArgs.length) return fallback;
  return rawArgs[index + 1];
}

const url = valueAfter('--url', 'https://www.pzds.com/gameList');
const session = valueAfter('--session', `pzds-health-${Date.now()}`);
const waitSeconds = Math.max(1, Math.min(Number(valueAfter('--wait', '5')) || 5, 15));
const consoleSince = valueAfter('--console-since', '2m');

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/pzds-browser-health.mjs [--json] [--repair] [--force-repair] [--keep-open]',
    '',
    'Checks the PZDS browser page through OpenCLI, reads recent console errors, and optionally repairs',
    'site-scoped PZDS browser state when the page is unhealthy.',
    '',
    'Options:',
    '  --url <url>              Page to verify. Default: https://www.pzds.com/gameList',
    '  --session <name>         OpenCLI browser session name. Default: pzds-health-<timestamp>',
    '  --wait <seconds>         Wait after navigation. Default: 5, max: 15',
    '  --console-since <span>   Console window passed to opencli browser console. Default: 2m',
    '  --repair                Repair only when the health check fails.',
    '  --force-repair          Repair even when the first health check passes.',
    '  --keep-open             Leave the OpenCLI browser session open for inspection.',
    '  --json                  Emit JSON instead of XML-ish text.',
  ].join('\n');
}

if (args.has('--help') || args.has('-h')) {
  console.log(usage());
  process.exit(0);
}

function runOpencli(commandArgs, timeoutMs = 45000) {
  const run = spawnSync('opencli', commandArgs, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 8,
  });
  return {
    ok: run.status === 0,
    status: run.status,
    signal: run.signal,
    stdout: (run.stdout || '').trim(),
    stderr: (run.stderr || '').trim(),
    command: ['opencli', ...commandArgs].join(' '),
  };
}

function parseJson(stdout) {
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    const start = stdout.search(/[\[{]/);
    const end = Math.max(stdout.lastIndexOf('}'), stdout.lastIndexOf(']'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stdout.slice(start, end + 1));
      } catch {}
    }
  }
  return null;
}

function normalizeConsoleMessage(message) {
  if (!message || typeof message !== 'object') return String(message ?? '');
  return [
    message.level,
    message.type,
    message.text,
    message.message,
    message.url,
    message.location?.url,
  ].filter(Boolean).join(' ');
}

const healthJs = `(() => {
  const text = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
  const cookieNames = document.cookie.split(';').map((item) => item.trim().split('=')[0]).filter(Boolean);
  const localStorageKeys = Object.keys(localStorage);
  const sessionStorageKeys = Object.keys(sessionStorage);
  const expected = [
    '欢迎来到盼之代售',
    '请选择要购买的游戏'
  ];
  const gameSignals = ['绝区零', '鸣潮', '明日方舟', '异环', '英雄联盟'];
  const blockerPattern = /(验证|滑块|访问过于频繁|安全校验|人机|captcha|forbidden|403|页面不存在|无法访问)/i;
  const expectedPresent = expected.every((item) => text.includes(item));
  const gameSignalPresent = gameSignals.some((item) => text.includes(item));
  const loadingOnly = text.includes('数据加载中') && !expectedPresent;
  return {
    url: location.href,
    title: document.title || '',
    readyState: document.readyState,
    expectedPresent,
    gameSignalPresent,
    blockerDetected: blockerPattern.test(text),
    loadingOnly,
    textSample: text.slice(0, 700),
    cookieNames,
    localStorageKeys,
    sessionStorageKeys,
    pzdsStorageKeys: [...localStorageKeys, ...sessionStorageKeys].filter((key) => /pzds|waf|ssx|track|hm_|vuex|dySig|pkfc/i.test(key)),
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
  };
})()`;

const repairJs = `(async () => {
  const before = {
    cookieNames: document.cookie.split(';').map((item) => item.trim().split('=')[0]).filter(Boolean),
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
  };

  const host = location.hostname;
  const rootDomain = host.endsWith('.pzds.com') ? '.pzds.com' : host;
  const cookieNames = [...new Set(before.cookieNames)];
  const domainCandidates = ['', host, '.' + host, rootDomain, 'www.pzds.com', '.www.pzds.com'];
  const pathCandidates = ['/', location.pathname || '/'];
  for (const name of cookieNames) {
    for (const path of pathCandidates) {
      for (const domain of domainCandidates) {
        const domainPart = domain ? '; domain=' + domain : '';
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=' + path + domainPart;
      }
    }
  }

  localStorage.clear();
  sessionStorage.clear();

  const deletedCaches = [];
  if (typeof caches !== 'undefined') {
    for (const cacheName of await caches.keys()) {
      if (await caches.delete(cacheName)) deletedCaches.push(cacheName);
    }
  }

  const deletedDatabases = [];
  if (indexedDB && typeof indexedDB.databases === 'function') {
    for (const database of await indexedDB.databases()) {
      if (!database?.name) continue;
      deletedDatabases.push(database.name);
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(database.name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    }
  }

  let unregisteredServiceWorkers = 0;
  if (navigator.serviceWorker?.getRegistrations) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (await registration.unregister()) unregisteredServiceWorkers += 1;
    }
  }

  return {
    before,
    after: {
      cookieNames: document.cookie.split(';').map((item) => item.trim().split('=')[0]).filter(Boolean),
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    },
    deletedCaches,
    deletedDatabases,
    unregisteredServiceWorkers,
  };
})()`;

function collectConsoleErrors() {
  const run = runOpencli(['browser', session, 'console', '--level', 'error', '--since', consoleSince], 20000);
  const parsed = parseJson(run.stdout);
  const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
  return {
    command: run.command,
    ok: run.ok,
    count: Number(parsed?.count ?? messages.length ?? 0),
    messages: messages.map(normalizeConsoleMessage).filter(Boolean),
    raw: parsed ?? null,
    stderr: run.stderr,
  };
}

function checkPage(stage) {
  const open = runOpencli(['browser', session, 'open', url], 60000);
  if (!open.ok) {
    return {
      stage,
      ok: false,
      open,
      wait: null,
      page: null,
      console: null,
      reasons: ['open_failed'],
    };
  }

  const wait = runOpencli(['browser', session, 'wait', 'time', String(waitSeconds)], (waitSeconds + 10) * 1000);
  const evalRun = runOpencli(['browser', session, 'eval', healthJs], 30000);
  const page = parseJson(evalRun.stdout);
  const consoleErrors = collectConsoleErrors();

  const reasons = [];
  if (!evalRun.ok || !page) reasons.push('health_eval_failed');
  if (page && !page.expectedPresent) reasons.push('missing_expected_pzds_content');
  if (page && !page.gameSignalPresent) reasons.push('missing_game_list_content');
  if (page?.blockerDetected) reasons.push('blocker_or_antibot_text_detected');
  if (page?.loadingOnly) reasons.push('page_stuck_loading');
  if (consoleErrors.count > 0) reasons.push('console_errors');

  return {
    stage,
    ok: reasons.length === 0,
    open: {
      ok: open.ok,
      command: open.command,
      stdout: parseJson(open.stdout) ?? open.stdout,
      stderr: open.stderr,
    },
    wait: {
      ok: wait.ok,
      command: wait.command,
      stdout: wait.stdout,
      stderr: wait.stderr,
    },
    eval: {
      ok: evalRun.ok,
      command: evalRun.command,
      stderr: evalRun.stderr,
    },
    page,
    console: consoleErrors,
    reasons,
  };
}

function repairPage() {
  const run = runOpencli(['browser', session, 'eval', repairJs], 30000);
  return {
    ok: run.ok,
    command: run.command,
    result: parseJson(run.stdout) ?? run.stdout,
    stderr: run.stderr,
  };
}

const startedAt = new Date().toISOString();
const initial = checkPage('initial');
let repairResult = null;
let final = initial;

if (repair && (!initial.ok || forceRepair)) {
  repairResult = repairPage();
  final = checkPage('after_repair');
}

if (!keepOpen) {
  runOpencli(['browser', session, 'close'], 10000);
}

const report = {
  ok: final.ok,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  url,
  session,
  repair_requested: repair,
  force_repair: forceRepair,
  repair_performed: Boolean(repairResult),
  initial,
  repair: repairResult,
  final,
  methodology: [
    'Open PZDS through the normal OpenCLI browser profile.',
    'Verify expected PZDS game-list content and read recent console errors.',
    'If unhealthy, clear only PZDS-scoped cookies, local/session storage, CacheStorage, IndexedDB, and service workers.',
    'Reload and verify the page again before trusting PZDS list or detail results.',
  ],
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('<pzds_browser_health_report>');
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <url>${report.url}</url>`);
  console.log(`  <session>${report.session}</session>`);
  console.log(`  <repair_performed>${report.repair_performed}</repair_performed>`);
  console.log(`  <initial_reasons format="json">${JSON.stringify(report.initial.reasons)}</initial_reasons>`);
  console.log(`  <final_reasons format="json">${JSON.stringify(report.final.reasons)}</final_reasons>`);
  console.log(`  <final_page_title>${report.final.page?.title ?? ''}</final_page_title>`);
  console.log(`  <final_console_error_count>${report.final.console?.count ?? 0}</final_console_error_count>`);
  console.log('</pzds_browser_health_report>');
}

process.exit(report.ok ? 0 : 1);
