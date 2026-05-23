#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const wantsJson = args.has('--json');
const strict = args.has('--strict');
const needsBrowser = args.has('--browser');
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

function checkWebAccessSkill() {
  const candidates = [
    path.join(os.homedir(), '.agents/skills/web-access/SKILL.md'),
    path.join(os.homedir(), '.codex/skills/web-access/SKILL.md')
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return { ok: Boolean(found), found };
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

function checkChromePort() {
  const result = spawnSync('sh', ['-lc', 'curl -s --max-time 2 http://localhost:9222/json/version >/dev/null'], { encoding: 'utf8' });
  return { ok: result.status === 0, found: result.status === 0 ? 'localhost:9222' : null };
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

const webAccess = checkWebAccessSkill();
checks.push({
  name: 'web-access skill',
  required: needsBrowser,
  ok: webAccess.ok,
  found: webAccess.found,
  required_for: 'Chrome/CDP access to dynamic or logged-in pages',
  action: webAccess.ok ? 'none' : 'Install or enable the web-access skill before browser-based community refresh.'
});

const chrome = checkChromePort();
checks.push({
  name: 'chrome remote debugging',
  required: needsBrowser,
  ok: chrome.ok,
  found: chrome.found,
  required_for: 'web-access browser mode',
  action: chrome.ok ? 'none' : 'Enable Chrome remote debugging and authorize CDP access.'
});

const requiredFailures = checks.filter((check) => check.required && !check.ok);
const optionalFailures = checks.filter((check) => !check.required && !check.ok);
const result = {
  ok: requiredFailures.length === 0 && (!strict || optionalFailures.length === 0),
  strict,
  needs_browser: needsBrowser,
  checks_opencli_adapters: checkAdapters,
  checks,
  missing_required: requiredFailures.map((check) => check.name),
  missing_optional: optionalFailures.map((check) => check.name),
  safe_auto_actions: [],
  manual_actions: checks.filter((check) => !check.ok).map((check) => ({ name: check.name, action: check.action }))
};

if (wantsJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`<preflight_report>`);
  console.log(`  <ok>${result.ok}</ok>`);
  console.log(`  <checks format="json">${JSON.stringify(result.checks)}</checks>`);
  console.log(`  <missing_optional format="json">${JSON.stringify(result.missing_optional)}</missing_optional>`);
  console.log(`  <missing_required format="json">${JSON.stringify(result.missing_required)}</missing_required>`);
  console.log(`  <manual_actions format="json">${JSON.stringify(result.manual_actions)}</manual_actions>`);
  console.log(`  <safe_auto_actions format="json">[]</safe_auto_actions>`);
  console.log(`</preflight_report>`);
}

process.exit(result.ok ? 0 : 1);
