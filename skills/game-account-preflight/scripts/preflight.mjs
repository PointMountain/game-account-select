#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveBrowserRoute } from './browser-routing.mjs';

const args = new Set(process.argv.slice(2));
const wantsJson = args.has('--json');
const strict = args.has('--strict');
const unattended = args.has('--unattended');
const needsBrowser = args.has('--browser') || unattended;
const checkAdapters = args.has('--opencli-adapters') || args.has('--adapters');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoSkillsRoot = path.resolve(__dirname, '..', '..');

function commandExists(command, versionArgs = ['--version']) {
  const which = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  if (which.status !== 0) return { ok: false, found: null };
  const version = spawnSync(command, versionArgs, { encoding: 'utf8' });
  return {
    ok: true,
    found: (version.stdout || version.stderr || which.stdout).trim().split('\n')[0]
  };
}

function checkGameAccountSkill(skillName) {
  const candidates = [
    path.join(os.homedir(), '.agents/skills', skillName, 'SKILL.md'),
    path.join(os.homedir(), '.codex/skills', skillName, 'SKILL.md'),
    path.join(repoSkillsRoot, skillName, 'SKILL.md')
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return { ok: Boolean(found), found };
}

function checkOpencliAdapters() {
  const script = path.join(repoSkillsRoot, 'game-account-toolkit', 'scripts', 'install-opencli-adapters.mjs');
  if (!fs.existsSync(script)) {
    return {
      ok: false,
      found: null,
      detail: null,
      action: 'Install game-account-toolkit with repo-managed OpenCLI adapter support.'
    };
  }

  const run = spawnSync('node', [script, '--check', '--json'], { encoding: 'utf8' });
  let detail = null;
  try {
    detail = JSON.parse(run.stdout || '{}');
  } catch {
    detail = { parse_error: (run.stderr || run.stdout || '').trim() };
  }

  return {
    ok: run.status === 0 && detail?.ok === true,
    found: detail?.opencli_home ?? null,
    detail,
    action: 'Run node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --install, then verify with opencli validate pxb7/zzz-detail and pzds/zzz-detail.'
  };
}

const checks = [];
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
checks.push({
  name: 'node',
  required: true,
  ok: nodeMajor >= 22,
  found: process.version,
  required_for: 'local validation and framework scripts',
  action: nodeMajor >= 22 ? 'none' : 'Install Node.js 22+.'
});

for (const command of ['git', 'gh']) {
  const result = commandExists(command);
  checks.push({
    name: command,
    required: true,
    ok: result.ok,
    found: result.found,
    required_for: command === 'git' ? 'repository workflow' : 'pull requests and CI checks',
    action: result.ok ? 'none' : `Install ${command} and authenticate if needed.`
  });
}

const opencli = commandExists('opencli', ['--version']);
checks.push({
  name: 'opencli',
  required: false,
  ok: opencli.ok,
  found: opencli.found,
  required_for: 'structured community/platform search',
  action: opencli.ok ? 'none' : 'Install opencli or provide community evidence manually.'
});

if (checkAdapters) {
  const adapters = checkOpencliAdapters();
  checks.push({
    name: 'repo-managed OpenCLI adapters',
    required: false,
    ok: adapters.ok,
    found: adapters.found,
    required_for: 'shared pxb7/zzz-detail and pzds/zzz-detail account detail extraction',
    action: adapters.ok ? 'none' : adapters.action,
    detail: adapters.detail
  });
}

const toolkitSkill = checkGameAccountSkill('game-account-toolkit');
checks.push({
  name: 'game-account-toolkit skill',
  required: true,
  ok: toolkitSkill.ok,
  found: toolkitSkill.found,
  required_for: 'shared account fields, platform access policy, and community research protocol',
  action: toolkitSkill.ok ? 'none' : 'Install game-account-toolkit together with the game skill.'
});

const communityUpdaterSkill = checkGameAccountSkill('game-account-community-updater');
checks.push({
  name: 'game-account-community-updater skill',
  required: false,
  ok: communityUpdaterSkill.ok,
  found: communityUpdaterSkill.found,
  required_for: 'community evidence refresh when local game evidence is stale or incomplete',
  action: communityUpdaterSkill.ok ? 'none' : 'Install game-account-community-updater for evidence refresh support.'
});

const browser = resolveBrowserRoute({
  needsBrowser,
  unattended,
});

if (needsBrowser) {
  checks.push({
    name: 'ego-browser route',
    required: true,
    ok: browser.browserAccessOk,
    found: browser.route.selected_transport,
    detail: {
      runtime_validation: browser.route.runtime_validation,
      task_space_required: browser.route.task_space_required,
      cleanup_policy: browser.route.cleanup_policy,
    },
    required_for: 'isolated, login-aware platform and community browser access',
    action: 'none; validate the runtime on the first ego-browser operation and follow its install guide only if that operation fails.'
  });
}

const requiredFailures = checks.filter((check) => check.required && !check.ok);
const optionalFailures = checks.filter((check) => !check.required && !check.ok && check.strict_relevant !== false);
const result = {
  ok: requiredFailures.length === 0 && (!strict || optionalFailures.length === 0),
  strict,
  needs_browser: needsBrowser,
  unattended,
  browser_route: browser.route,
  checks_opencli_adapters: checkAdapters,
  checks,
  missing_required: requiredFailures.map((check) => check.name),
  missing_optional: optionalFailures.map((check) => check.name),
  safe_auto_actions: [],
  manual_actions: checks.filter((check) => !check.ok && check.strict_relevant !== false).map((check) => ({ name: check.name, action: check.action }))
};

if (wantsJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`<preflight_report>`);
  console.log(`  <ok>${result.ok}</ok>`);
  console.log(`  <browser_route format="json">${JSON.stringify(result.browser_route)}</browser_route>`);
  console.log(`  <checks format="json">${JSON.stringify(result.checks)}</checks>`);
  console.log(`  <missing_optional format="json">${JSON.stringify(result.missing_optional)}</missing_optional>`);
  console.log(`  <missing_required format="json">${JSON.stringify(result.missing_required)}</missing_required>`);
  console.log(`  <manual_actions format="json">${JSON.stringify(result.manual_actions)}</manual_actions>`);
  console.log(`  <safe_auto_actions format="json">[]</safe_auto_actions>`);
  console.log(`</preflight_report>`);
}

process.exit(result.ok ? 0 : 1);
