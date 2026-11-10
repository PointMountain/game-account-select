#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills, SKILL } from './lib/harness.mjs';
import { verifySkill } from '../skills/game-account-select/scripts/verify.mjs';

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
}

const skillResult = verifySkill(skillRoot);
errors.push(...skillResult.errors.map((error) => `skills/${SKILL}/${error}`));

const index = fs.readFileSync(path.join(root, 'skills/llms.txt'), 'utf8').split('\n').filter(Boolean).map((line) => line.split(':')[0]);
if (index.join() !== SKILL) errors.push(`llms.txt: expected a single ${SKILL} entry`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Harness verified: 1 skill, ${skillResult.operationCount} operations, ${documents.length + skillResult.documentCount} linked documents`);
