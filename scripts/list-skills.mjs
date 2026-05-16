#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skillsRoot = path.join(repoRoot, 'skills');
const profilesPath = path.join(skillsRoot, 'install-profiles.json');

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

function readInstallProfiles() {
  if (!fs.existsSync(profilesPath)) {
    return { source: 'https://github.com/PointMountain/game-account-select', profiles: [] };
  }

  return JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
}

function buildInstallCommand(source, skills) {
  return [
    'npx skills add',
    source,
    ...skills.map((skill) => `--skill "${skill}"`)
  ].join(' ');
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

const profileData = readInstallProfiles();
const installSource = profileData.source ?? 'https://github.com/PointMountain/game-account-select';
const profiles = profileData.profiles ?? [];
const skillNames = new Set(rows.map((row) => row.name));

function validateProfile(profile) {
  const missing = profile.skills.filter((skill) => !skillNames.has(skill));
  if (missing.length > 0) {
    throw new Error(`Profile "${profile.name}" references missing skills: ${missing.join(', ')}`);
  }
}

for (const profile of profiles) validateProfile(profile);

const profileFlagIndex = process.argv.indexOf('--profile');
const requestedProfile = profileFlagIndex === -1 ? null : process.argv[profileFlagIndex + 1];
const showProfiles = process.argv.includes('--profiles');
const asJson = process.argv.includes('--json');

const profileRows = profiles.map((profile) => ({
  ...profile,
  command: profile.mode === 'all'
    ? `npx skills add ${installSource} --skill '*'`
    : buildInstallCommand(installSource, profile.skills)
}));

if (profileFlagIndex !== -1 && (!requestedProfile || requestedProfile.startsWith('--'))) {
  console.error('Missing profile name after --profile.');
  const available = profileRows.flatMap((item) => [item.name, ...(item.aliases ?? [])]);
  console.error(`Available profiles: ${available.join(', ')}`);
  process.exit(1);
}

if (requestedProfile) {
  const profile = profileRows.find((item) => {
    return item.name === requestedProfile || (item.aliases ?? []).includes(requestedProfile);
  });
  if (!profile) {
    console.error(`Unknown profile: ${requestedProfile}`);
    const available = profileRows.flatMap((item) => [item.name, ...(item.aliases ?? [])]);
    console.error(`Available profiles: ${available.join(', ')}`);
    process.exit(1);
  }

  console.log(profile.command);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({ skills: rows, profiles: profileRows }, null, 2));
  process.exit(0);
}

if (showProfiles) {
  const nameWidth = Math.max(...profileRows.map((profile) => profile.name.length), 'Profile'.length);
  const skillWidth = Math.max(...profileRows.map((profile) => String(profile.skills.length).length), 'Skills'.length);
  console.log(`${'Profile'.padEnd(nameWidth)}  ${'Skills'.padEnd(skillWidth)}  Description`);
  console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(skillWidth)}  ${'-'.repeat(60)}`);
  for (const profile of profileRows) {
    console.log(`${profile.name.padEnd(nameWidth)}  ${String(profile.skills.length).padEnd(skillWidth)}  ${profile.description}`);
    if (profile.aliases?.length > 0) {
      console.log(`  aliases: ${profile.aliases.join(', ')}`);
    }
    console.log(`  ${profile.command}`);
  }
  process.exit(0);
}

const nameWidth = Math.max(...rows.map((row) => row.name.length), 'Install name'.length);
const folderWidth = Math.max(...rows.map((row) => row.folder.length), 'Folder'.length);
console.log(`${'Install name'.padEnd(nameWidth)}  ${'Folder'.padEnd(folderWidth)}  Description`);
console.log(`${'-'.repeat(nameWidth)}  ${'-'.repeat(folderWidth)}  ${'-'.repeat(60)}`);
for (const row of rows) {
  console.log(`${row.name.padEnd(nameWidth)}  ${row.folder.padEnd(folderWidth)}  ${row.description}`);
}
