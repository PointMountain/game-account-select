#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repoRoot, 'skills');
const targetRoot = path.join(os.homedir(), '.agents', 'skills');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (field) data[field[1]] = field[2].replace(/^"|"$/g, '');
  }
  return data;
}

function discoverSkills() {
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const source = path.join(skillsRoot, entry.name);
      const skillPath = path.join(source, 'SKILL.md');
      if (!fs.existsSync(skillPath)) return null;
      const frontmatter = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
      return {
        name: frontmatter.name ?? entry.name,
        source
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sameRealPath(left, right) {
  try {
    return fs.realpathSync(left) === fs.realpathSync(right);
  } catch {
    return false;
  }
}

function lstatIfPresent(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

fs.mkdirSync(targetRoot, { recursive: true });

const linked = [];
const alreadyLinked = [];
const conflicts = [];

for (const skill of discoverSkills()) {
  const target = path.join(targetRoot, skill.name);
  const targetStat = lstatIfPresent(target);

  if (targetStat) {
    if (targetStat.isSymbolicLink() && sameRealPath(target, skill.source)) {
      alreadyLinked.push(skill.name);
      continue;
    }

    conflicts.push({ name: skill.name, target });
    continue;
  }

  fs.symlinkSync(skill.source, target, 'dir');
  linked.push(skill.name);
}

const result = { target_root: targetRoot, linked, already_linked: alreadyLinked, conflicts };
console.log(JSON.stringify(result, null, 2));

if (conflicts.length > 0) {
  process.exitCode = 1;
}
