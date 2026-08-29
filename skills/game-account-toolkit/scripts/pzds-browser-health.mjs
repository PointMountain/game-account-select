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
const taskSpaceName = valueAfter('--task-space', `pzds-health-${Date.now()}`);
const waitSeconds = Math.max(1, Math.min(Number(valueAfter('--wait', '5')) || 5, 15));

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/pzds-browser-health.mjs [--json] [--repair] [--force-repair] [--keep-open]',
    '',
    'Checks PZDS in an isolated ego-browser task space and optionally repairs site-scoped state.',
    '',
    'Options:',
    '  --url <url>             Page to verify. Default: https://www.pzds.com/gameList',
    '  --task-space <id|name>  ego-browser task space. Default: pzds-health-<timestamp>',
    '  --wait <seconds>        Wait after navigation. Default: 5, max: 15',
    '  --repair                Repair only when the health check fails.',
    '  --force-repair          Repair even when the first health check passes.',
    '  --keep-open             Complete the run with keep:true for explicit user inspection.',
    '  --json                  Emit JSON instead of XML-ish text.',
  ].join('\n');
}

if (args.has('--help') || args.has('-h')) {
  console.log(usage());
  process.exit(0);
}

function runEgo(script, timeout = 60000) {
  const run = spawnSync('ego-browser', ['nodejs'], {
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 8,
    input: `${script}\n`,
  });
  return {
    ok: run.status === 0,
    status: run.status,
    signal: run.signal,
    stdout: (run.stdout || '').trim(),
    stderr: (run.stderr || '').trim(),
    command: 'ego-browser nodejs',
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

function isControlStop(result) {
  return /user is controlling|inactive|not assigned to an agent/i.test(`${result.stderr}\n${result.stdout}`);
}

function compactExecution(result) {
  return {
    ok: result.ok,
    status: result.status,
    signal: result.signal,
    command: result.command,
    error: result.ok ? null : `${result.stderr}\n${result.stdout}`.trim().slice(0, 1200),
  };
}

const healthJs = String.raw`(() => {
  const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  const welcomeSignals = ['欢迎来到盼之代售', '欢迎来到盼之账号'];
  const requiredSignal = '请选择要购买的游戏';
  const gameSignals = ['绝区零', '鸣潮', '明日方舟', '异环', '英雄联盟'];
  const blockerPattern = /(验证|滑块|访问过于频繁|安全校验|人机|captcha|forbidden|403|页面不存在|无法访问)/i;
  const welcomeSignal = welcomeSignals.find((item) => text.includes(item)) || null;
  const expectedPresent = Boolean(welcomeSignal) && text.includes(requiredSignal);
  const gameSignalPresent = gameSignals.some((item) => text.includes(item));
  return {
    url: location.href,
    title: document.title || '',
    readyState: document.readyState,
    expectedPresent,
    welcomeSignal,
    gameSignalPresent,
    blockerDetected: blockerPattern.test(text),
    loadingOnly: text.includes('数据加载中') && !expectedPresent,
    textSample: text.slice(0, 700),
    storage: {
      localStorageKeyCount: Object.keys(localStorage).length,
      sessionStorageKeyCount: Object.keys(sessionStorage).length,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    },
  };
})()`;

const repairJs = String.raw`(async () => {
  const before = {
    cookieNames: document.cookie.split(';').map((item) => item.trim().split('=')[0]).filter(Boolean),
    localStorageKeys: Object.keys(localStorage),
    sessionStorageKeys: Object.keys(sessionStorage),
  };
  const host = location.hostname;
  const rootDomain = host.endsWith('.pzds.com') ? '.pzds.com' : host;
  const domains = ['', host, '.' + host, rootDomain, 'www.pzds.com', '.www.pzds.com'];
  for (const name of [...new Set(before.cookieNames)]) {
    for (const path of ['/', location.pathname || '/']) {
      for (const domain of domains) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=' + path + (domain ? '; domain=' + domain : '');
      }
    }
  }
  localStorage.clear();
  sessionStorage.clear();
  const deletedCaches = [];
  if (typeof caches !== 'undefined') {
    for (const cacheName of await caches.keys()) if (await caches.delete(cacheName)) deletedCaches.push(cacheName);
  }
  let unregisteredServiceWorkers = 0;
  if (navigator.serviceWorker?.getRegistrations) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      if (await registration.unregister()) unregisteredServiceWorkers += 1;
    }
  }
  return { before, deletedCaches, unregisteredServiceWorkers };
})()`;

function checkPage(stage, taskSpace) {
  const script = [
    `const task = await useOrCreateTaskSpace(${JSON.stringify(taskSpace)})`,
    `await openOrReuseTab(${JSON.stringify(url)}, { wait: true, timeout: 20 })`,
    `await wait(${waitSeconds})`,
    'const info = await pageInfo()',
    `const page = info.dialog ? { dialog: info.dialog } : await js(${JSON.stringify(healthJs)})`,
    'const events = await drainEvents()',
    "const errorEvents = events.filter((event) => /error|fail|blocked/i.test(JSON.stringify(event))).slice(0, 20)",
    `cliLog(JSON.stringify({ stage: ${JSON.stringify(stage)}, task_space_id: task.id, task_space_name: task.name, info, page, error_events: errorEvents }))`,
  ].join('\n');
  const execution = runEgo(script);
  const payload = parseLastJson(`${execution.stdout}\n${execution.stderr}`);
  const reasons = [];
  if (!execution.ok || !payload) reasons.push('ego_browser_operation_failed');
  if (payload?.info?.dialog) reasons.push('native_dialog_open');
  if (payload?.page && !payload.page.expectedPresent) reasons.push('missing_expected_pzds_content');
  if (payload?.page && !payload.page.gameSignalPresent) reasons.push('missing_game_list_content');
  if (payload?.page?.blockerDetected) reasons.push('blocker_or_antibot_text_detected');
  if (payload?.page?.loadingOnly) reasons.push('page_stuck_loading');
  if ((payload?.error_events?.length ?? 0) > 0) reasons.push('browser_error_events');
  return {
    stage,
    ok: reasons.length === 0,
    hard_stop: isControlStop(execution),
    task_space_id: payload?.task_space_id ?? null,
    task_space_name: payload?.task_space_name ?? String(taskSpace),
    page: payload?.page ?? null,
    page_info: payload?.info ?? null,
    error_events: payload?.error_events ?? [],
    execution: compactExecution(execution),
    reasons,
  };
}

function repairPage(taskSpace) {
  const script = [
    `await useOrCreateTaskSpace(${JSON.stringify(taskSpace)})`,
    `const result = await js(${JSON.stringify(repairJs)})`,
    `await gotoAndWait(${JSON.stringify(url)}, { timeout: 20, settle: 2 })`,
    'cliLog(JSON.stringify({ result }))',
  ].join('\n');
  const execution = runEgo(script);
  return {
    ok: execution.ok,
    hard_stop: isControlStop(execution),
    result: parseLastJson(`${execution.stdout}\n${execution.stderr}`)?.result ?? null,
    execution: compactExecution(execution),
  };
}

function completeHealthTaskSpace(taskSpace, keep) {
  const script = [
    `const target = ${JSON.stringify(taskSpace)}`,
    'const spaces = await listTaskSpaces()',
    'const matched = spaces.find((space) => String(space.id) === String(target) || String(space.taskId) === String(target) || String(space.name) === String(target))',
    "if (!matched) cliLog(JSON.stringify({ done: true, already_closed: true }))",
    "else if (matched.ownership !== 'agent') cliLog(JSON.stringify({ done: false, skipped: 'task-space-not-agent-owned', ownership: matched.ownership, id: matched.id, name: matched.name }))",
    `else { const result = await completeTaskSpace(matched.id, { keep: ${keep ? 'true' : 'false'} }); cliLog(JSON.stringify({ id: matched.id, name: matched.name, ...result })) }`,
  ].join('\n');
  const execution = runEgo(script, 30000);
  const result = parseLastJson(`${execution.stdout}\n${execution.stderr}`);
  return { ok: execution.ok && result?.done === true, keep, result, execution: compactExecution(execution) };
}

const startedAt = new Date().toISOString();
const initial = checkPage('initial', taskSpaceName);
let repairResult = null;
let final = initial;

if (!initial.hard_stop && repair && (!initial.ok || forceRepair) && initial.task_space_id != null) {
  repairResult = repairPage(initial.task_space_id);
  if (!repairResult.hard_stop) final = checkPage('after_repair', initial.task_space_id);
}

const hardStop = initial.hard_stop || repairResult?.hard_stop === true || final.hard_stop;
const completionTarget = final.task_space_id ?? initial.task_space_id ?? taskSpaceName;
const completion = hardStop || completionTarget == null
  ? null
  : completeHealthTaskSpace(completionTarget, keepOpen);
const completionNeedsUserAction = completion?.result?.skipped === 'task-space-not-agent-owned';

const report = {
  ok: final.ok && !hardStop && !completionNeedsUserAction && completion?.ok === true,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  transport: 'ego_browser',
  url,
  task_space_id: completionTarget,
  task_space_name: final.task_space_name ?? initial.task_space_name,
  repair_requested: repair,
  force_repair: forceRepair,
  repair_performed: Boolean(repairResult),
  needs_user_action: hardStop || completionNeedsUserAction,
  initial,
  repair: repairResult,
  final,
  completion,
  methodology: [
    'Open PZDS in one isolated ego-browser task space.',
    'Verify expected visible content, page identity, blocker text, and browser error events.',
    'If explicitly requested and unhealthy, clear only PZDS-scoped state inside that task space.',
    'Reload and read back the page before trusting PZDS list or detail results.',
    'Complete the task space in a dedicated final ego-browser operation unless user control is active.',
  ],
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('<pzds_browser_health_report>');
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <transport>${report.transport}</transport>`);
  console.log(`  <url>${report.url}</url>`);
  console.log(`  <task_space_id>${report.task_space_id ?? ''}</task_space_id>`);
  console.log(`  <repair_performed>${report.repair_performed}</repair_performed>`);
  console.log(`  <needs_user_action>${report.needs_user_action}</needs_user_action>`);
  console.log(`  <final_reasons format="json">${JSON.stringify(report.final.reasons)}</final_reasons>`);
  console.log(`  <final_page_title>${report.final.page?.title ?? ''}</final_page_title>`);
  console.log('</pzds_browser_health_report>');
}

process.exit(report.ok ? 0 : 1);
