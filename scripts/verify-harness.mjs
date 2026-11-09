#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills, SKILL } from './lib/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = discoverSkills(root);
const errors = [];
if (skills.length !== 1 || skills[0] !== SKILL) errors.push(`expected exactly one skill (${SKILL}), found: ${skills.join(', ')}`);

const skillRoot = path.join(root, 'skills', SKILL);
const documents = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'README.md', 'README.en.md'].filter((file) => fs.existsSync(path.join(root, file)));
function walk(directory) {
  if (!fs.existsSync(path.join(root, directory))) return;
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(relative);
    else if (entry.name.endsWith('.md')) documents.push(relative);
  }
}
walk('docs/development');
walk('docs/adr');
walk(`skills/${SKILL}`);

const operationStatus = (text) => text.match(/^status:\s*(\S+)/m)?.[1] ?? 'verified';
for (const file of documents) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const limit = file.endsWith('/SKILL.md') ? 100 : ['AGENTS.md', 'CLAUDE.md'].includes(file) ? 80 : null;
  if (limit && text.trimEnd().split('\n').length > limit) errors.push(`${file}: exceeds ${limit}-line entry budget`);
  const body = text.replace(/```[\s\S]*?```/g, '');
  for (const match of body.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) errors.push(`${file}: broken link ${target}`);
  }
  if (/\/operations\/[^/]+\.md$/.test(file)) {
    const status = operationStatus(text);
    const verified = text.match(/^last_verified:\s*(\S+)/m)?.[1];
    if (!['documented', 'partial', 'verified'].includes(status)) errors.push(`${file}: unknown status ${status}`);
    if (status === 'verified' && !/^\d{4}-\d{2}-\d{2}$/.test(verified ?? '')) errors.push(`${file}: verified operation needs a real last_verified date`);
    if (status !== 'verified' && verified && verified !== 'null') errors.push(`${file}: ${status} operation must not carry a success date`);
  }
}

// Every site index lists its operation files; every manifest operation for a known site has knowledge.
const manifest = JSON.parse(fs.readFileSync(path.join(skillRoot, 'references/operations.json'), 'utf8'));
for (const operation of manifest.operations.filter((item) => !['dynamic', 'generic'].includes(item.site))) {
  const slug = operation.id.split('/')[1];
  const file = path.join(skillRoot, 'references/sites', operation.site, 'operations', `${slug}.md`);
  if (!fs.existsSync(file)) { errors.push(`operations.json: ${operation.id} has no site operation file`); continue; }
  const index = fs.readFileSync(path.join(skillRoot, 'references/sites', operation.site, 'index.md'), 'utf8');
  if (!index.includes(`(operations/${slug}.md)`)) errors.push(`sites/${operation.site}/index.md: missing link to ${slug}`);
  const status = operationStatus(fs.readFileSync(file, 'utf8'));
  if (operation.availability === 'verified' && status !== 'verified') errors.push(`${operation.id}: manifest says verified but knowledge is ${status}`);
}
for (const game of fs.readdirSync(path.join(skillRoot, 'references/games'), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  for (const required of ['index.md', 'game.json', 'operations/refresh-evidence.md']) {
    if (!fs.existsSync(path.join(skillRoot, 'references/games', game.name, required))) errors.push(`games/${game.name}: missing ${required}`);
  }
}

const index = fs.readFileSync(path.join(root, 'skills/llms.txt'), 'utf8').split('\n').filter(Boolean).map((line) => line.split(':')[0]);
if (index.join() !== SKILL) errors.push(`llms.txt: expected a single ${SKILL} entry`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Harness verified: 1 skill, ${manifest.operations.length} operations, ${documents.length} linked documents`);
