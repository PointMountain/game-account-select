#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repoRoot, 'skills');

function walk(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);

  const data = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!field) throw new Error(`${file}: unsupported frontmatter line: ${rawLine}`);

    const [, key, rawValue] = field;
    if (!rawValue || rawValue.includes('{{') || rawValue.includes('}}')) {
      throw new Error(`${file}: ${key} must be a concrete string`);
    }
    data[key] = rawValue.replace(/^"|"$/g, '');
  }

  for (const key of ['name', 'description']) {
    if (!data[key]) throw new Error(`${file}: missing ${key}`);
  }
}

const skillFiles = walk(skillsRoot)
  .filter((file) => path.basename(file) === 'SKILL.md')
  .sort();

const nestedSkillFiles = skillFiles
  .map((file) => path.relative(skillsRoot, file))
  .filter((relative) => relative.split(path.sep).length > 2);

if (nestedSkillFiles.length > 0) {
  throw new Error(`Nested SKILL.md files are loadable by Codex and must be renamed: ${nestedSkillFiles.join(', ')}`);
}

for (const file of skillFiles) {
  parseFrontmatter(fs.readFileSync(file, 'utf8'), path.relative(repoRoot, file));
}

console.log(`Verified ${skillFiles.length} SKILL.md files`);
