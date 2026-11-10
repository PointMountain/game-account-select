#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBrowserRoute } from './browser-routing.mjs';
import { findExecutable, findSkill } from './dependencies.mjs';

const args = new Set(process.argv.slice(2));
const wantsJson = args.has('--json');
const strict = args.has('--strict');
const unattended = args.has('--unattended');
const needsBrowser = args.has('--browser') || unattended;
const __dirname = path.dirname(fileURLToPath(import.meta.url));


function checkGameAccountSkill(skillName) {
  const invokedRoot = process.argv[1] ? path.resolve(path.dirname(process.argv[1]), '..') : path.resolve(__dirname, '..');
  return findSkill(skillName, { skillRoot: invokedRoot });
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
  const result = findExecutable(command);
  checks.push({
    name: command,
    required: false,
    ok: result.ok,
    found: result.found,
    required_for: command === 'git' ? 'repository workflow' : 'pull requests and CI checks',
    action: result.ok ? 'none' : `Install ${command} and authenticate if needed.`
  });
}

const browser = resolveBrowserRoute({
  needsBrowser,
  unattended,
  egoBrowser: needsBrowser ? findExecutable('ego-browser') : null,
});

if (needsBrowser) {
  const egoOpsSkill = checkGameAccountSkill('ego-ops');
  checks.push({
    name: 'ego-ops skill',
    required: true,
    ok: egoOpsSkill.ok,
    found: egoOpsSkill.found,
    required_for: 'query task cards, progressive site-operation knowledge, authorization boundaries, verification, and success-only knowledge writeback',
    action: egoOpsSkill.ok ? 'none' : 'Install ego-ops in a project or user skill directory; see references/installation.md.'
  });
  const egoBrowserSkill = checkGameAccountSkill('ego-browser');
  checks.push({
    name: 'ego-browser skill',
    required: true,
    ok: egoBrowserSkill.ok,
    found: egoBrowserSkill.found,
    required_for: 'browser usage and task-space instructions',
    action: egoBrowserSkill.ok ? 'none' : 'Install the ego-browser skill; see references/installation.md.'
  });
  checks.push({
    name: 'ego-browser route',
    required: true,
    ok: browser.browserAccessOk,
    found: browser.egoBrowser.found,
    detail: {
      query_governance: 'ego_ops',
      runtime_validation: browser.route.runtime_validation,
      task_space_required: browser.route.task_space_required,
      cleanup_policy: browser.route.cleanup_policy,
    },
    required_for: 'isolated, login-aware platform and community browser access',
    action: browser.browserAccessOk ? 'none; validate the runtime on the first browser operation.'
      : 'Install ego lite, complete onboarding, and make ego-browser available on PATH; see references/installation.md.'
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
  query_governance: 'ego_ops',
  ego_ops_knowledge_policy: {
    local_experience: 'read_if_present',
    site_operation: 'progressive_read_one_site_one_operation',
    live_revalidation: 'required',
    writeback: 'success_only',
  },
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
