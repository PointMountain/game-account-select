#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills, dependencyClosure } from './lib/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = discoverSkills(root);
const config = JSON.parse(fs.readFileSync(path.join(root, 'skills/dependencies.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(root, 'skills/install-profiles.json'), 'utf8')).profiles;
const errors = [];
for (const skill of skills) {
  for (const dependency of dependencyClosure([skill], config)) {
    if (!skills.includes(dependency)) errors.push(`${skill}: missing dependency ${dependency}`);
  }
}
for (const profile of profiles) {
  const missing = dependencyClosure(profile.skills, config).filter((name) => !profile.skills.includes(name));
  if (missing.length) errors.push(`${profile.name}: incomplete dependency closure: ${missing.join(', ')}`);
}
const documents = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md'];
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(relative);
    else if (entry.name.endsWith('.md')) documents.push(relative);
  }
}
walk('docs/development');
walk('docs/adr');
for (const skill of skills) {
  documents.push(`skills/${skill}/SKILL.md`);
  walk(`skills/${skill}/references`);
}
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
const index = fs.readFileSync(path.join(root, 'skills/llms.txt'), 'utf8').split('\n').filter(Boolean).map((line) => line.split(':')[0]);
for (const skill of skills) if (index.filter((name) => name === skill).length !== 1) errors.push(`llms.txt: expected one entry for ${skill}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Harness verified: ${skills.length} skill entries, ${profiles.length} dependency-closed profiles, ${documents.length} linked documents`);
