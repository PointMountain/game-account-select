#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repoRoot, 'skills');

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

const rows = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const skillPath = path.join(skillsRoot, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;
    const frontmatter = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    return {
      folder: entry.name,
      name: frontmatter.name ?? entry.name,
      description: frontmatter.description ?? ''
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const nameWidth = Math.max(...rows.map((row) => row.name.length), 'Install name'.length);
  const folderWidth = Math.max(...rows.map((row) => row.folder.length), 'Folder'.length);
  console.log(`${'Install name'.padEnd(nameWidth)}  ${'Folder'.padEnd(folderWidth)}  Description`);
  console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(folderWidth)}  ${'-'.repeat(60)}`);
  for (const row of rows) {
    console.log(`${row.name.padEnd(nameWidth)}  ${row.folder.padEnd(folderWidth)}  ${row.description}`);
  }
}
