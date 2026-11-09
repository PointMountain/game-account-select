#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(repoRoot, 'skills');
const source = 'https://github.com/PointMountain/game-account-select';

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const data = {};
  for (const line of match?.[1].split('\n') ?? []) {
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (field) data[field[1]] = field[2].replace(/^"|"$/g, '');
  }
  return data;
}

const rows = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
  .map((entry) => {
    const frontmatter = parseFrontmatter(fs.readFileSync(path.join(skillsRoot, entry.name, 'SKILL.md'), 'utf8'));
    const games = fs.readdirSync(path.join(skillsRoot, entry.name, 'references/games'), { withFileTypes: true })
      .filter((item) => item.isDirectory()).map((item) => item.name);
    const sites = fs.readdirSync(path.join(skillsRoot, entry.name, 'references/sites'), { withFileTypes: true })
      .filter((item) => item.isDirectory()).map((item) => item.name);
    return { name: frontmatter.name ?? entry.name, description: frontmatter.description ?? '', games, sites,
      install: `npx skills add ${source} --skill "${frontmatter.name ?? entry.name}"` };
  });

if (process.argv.includes('--json')) console.log(JSON.stringify({ skills: rows }, null, 2));
else for (const row of rows) {
  console.log(`${row.name}\n  ${row.description}\n  games: ${row.games.join(', ')}\n  sites: ${row.sites.join(', ')}\n  ${row.install}`);
}
