#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './runtime.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function verifySkill(root = skillRoot) {
  const errors = [];
  const documents = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.md')) documents.push(file);
    }
  };
  walk(root);
  const readJson = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { errors.push(`${path.relative(root, file)}: cannot read JSON (${error.message})`); return null; }
  };

  for (const file of documents) {
    const relative = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');
    if (relative === 'SKILL.md' && text.trimEnd().split('\n').length > 100) errors.push('SKILL.md: exceeds 100-line entry budget');
    const body = text.replace(/```[\s\S]*?```/g, '');
    for (const match of body.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) errors.push(`${relative}: broken link ${target}`);
    }
    if (relative.split(path.sep).includes('operations')) {
      const status = text.match(/^status:\s*(\S+)/m)?.[1] ?? 'verified';
      const verified = text.match(/^last_verified:\s*(\S+)/m)?.[1];
      if (!['documented', 'partial', 'verified'].includes(status)) errors.push(`${relative}: unknown status ${status}`);
      if (status === 'verified' && !/^\d{4}-\d{2}-\d{2}$/.test(verified ?? '')) errors.push(`${relative}: verified operation needs a real last_verified date`);
      if (status !== 'verified' && verified && verified !== 'null') errors.push(`${relative}: ${status} operation must not carry a success date`);
    }
  }

  const entry = path.join(root, 'SKILL.md');
  const entryText = fs.existsSync(entry) ? fs.readFileSync(entry, 'utf8') : '';
  const frontmatter = entryText.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';
  if (!/^name:\s*game-account-select\s*$/m.test(frontmatter) || !/^description:\s*\S/m.test(frontmatter)) errors.push('SKILL.md: missing name or description frontmatter');
  const manifest = readJson(path.join(root, 'references/operations.json'));
  const operations = Array.isArray(manifest?.operations) ? manifest.operations : [];
  if (!Array.isArray(manifest?.operations)) errors.push('operations.json: operations must be an array');
  for (const operation of operations) {
    if (!operation || typeof operation.id !== 'string' || typeof operation.site !== 'string') {
      errors.push('operations.json: each operation needs an id and site');
      continue;
    }
    if (['dynamic', 'generic'].includes(operation.site)) continue;
    const slug = operation.id.split('/')[1];
    if (!slug) { errors.push(`operations.json: invalid operation id ${operation.id}`); continue; }
    const site = path.join(root, 'references/sites', operation.site);
    const file = path.join(site, 'operations', `${slug}.md`);
    const index = path.join(site, 'index.md');
    if (!fs.existsSync(file)) { errors.push(`operations.json: ${operation.id} has no site operation file`); continue; }
    if (!fs.existsSync(index) || !fs.readFileSync(index, 'utf8').includes(`(operations/${slug}.md)`)) errors.push(`sites/${operation.site}/index.md: missing link to ${slug}`);
    const status = fs.readFileSync(file, 'utf8').match(/^status:\s*(\S+)/m)?.[1] ?? 'verified';
    if (operation.availability === 'verified' && status !== 'verified') errors.push(`${operation.id}: manifest says verified but knowledge is ${status}`);
  }
  const games = path.join(root, 'references/games');
  if (!fs.existsSync(games)) errors.push('references/games: missing directory');
  else for (const game of fs.readdirSync(games, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    for (const required of ['index.md', 'game.json', 'operations/refresh-evidence.md']) {
      const file = path.join(games, game.name, required);
      if (!fs.existsSync(file)) errors.push(`games/${game.name}: missing ${required}`);
      else if (required === 'game.json') {
        const config = readJson(file);
        if (config && !Array.isArray(config.signals)) errors.push(`games/${game.name}/game.json: signals must be an array`);
      }
    }
  }
  return { errors, documentCount: documents.length, operationCount: operations.length };
}

if (isEntrypoint(import.meta.url)) {
  const result = verifySkill();
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`Skill verified: ${result.operationCount} operations, ${result.documentCount} linked documents`);
}
