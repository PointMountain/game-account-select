#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(process.env.QUERY_STACK_ROOT || path.join(__dirname, '..', '..', '..'));
const bannedTokens = [
  ['open', 'cli'].join(''),
  ['web', 'access'].join('-'),
  ['web', 'access'].join('_'),
  ['chrome', 'use'].join('-'),
  ['chrome', 'use'].join('_'),
  ['web', 'fetch'].join(''),
  ['web', 'search'].join(''),
  ['agent', 'browser'].join('-'),
  ['smart', 'search'].join('-'),
  ['ji', 'na'].join(''),
  ['cu', 'rl'].join(''),
];
const searchableExtensions = new Set(['.md', '.mjs', '.js', '.json', '.txt']);
const allowedEgoBrowserExecutors = new Set([
  'skills/game-account-select/scripts/query.mjs',
  'skills/game-account-select/scripts/cleanup.mjs',
]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    if (directory === repoRoot && entry.name === '.harness') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function relative(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}

const files = walk(repoRoot);
const violations = [];
for (const file of files) {
  const name = relative(file).toLowerCase();
  for (const token of bannedTokens) {
    if (name.includes(token)) violations.push(`${name}: banned path token ${token}`);
  }
  if (!searchableExtensions.has(path.extname(file))) continue;
  const content = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const token of bannedTokens) {
    if (content.includes(token)) violations.push(`${name}: banned content token ${token}`);
  }
  if (['.mjs', '.js'].includes(path.extname(file))
    && /(?:spawnsync|spawn|run)\s*\(\s*['"]ego-browser['"]/i.test(content)
    && !allowedEgoBrowserExecutors.has(name)) {
    violations.push(`${name}: direct ego-browser execution must route through the ego-ops operation runner`);
  }
}

const requiredFiles = [
  'skills/game-account-select/scripts/query.mjs',
  'skills/game-account-select/scripts/cleanup.mjs',
  'skills/game-account-select/references/operations.json',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, file))) violations.push(`${file}: required ego query component missing`);
}

const preflight = fs.readFileSync(path.join(repoRoot, 'skills/game-account-select/scripts/preflight.mjs'), 'utf8');
if (!preflight.includes("checkGameAccountSkill('ego-ops')")) violations.push('preflight: ego-ops skill check missing');
if (!preflight.includes("query_governance: 'ego_ops'")) violations.push('preflight: ego_ops governance contract missing');

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('game-account-select ego-ops-only query stack validation passed');
