#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const templateRoot = path.join(repoRoot, 'skills/game-account-toolkit/templates/game-skill');

function parseArgs(argv) {
  const options = { aliases: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--game') options.game = argv[++i];
    else if (arg === '--slug') options.slug = argv[++i];
    else if (arg === '--alias') options.aliases.push(argv[++i]);
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--force') options.force = true;
    else if (!arg.startsWith('--') && !options.game) options.game = arg;
  }
  return options;
}

function slugify(input) {
  const asciiSlug = input
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (asciiSlug) return asciiSlug;

  let hash = 0;
  for (const char of input) {
    hash = ((hash << 5) - hash + char.codePointAt(0)) >>> 0;
  }
  return `game-${hash.toString(36)}`;
}

function titleName(input) {
  return input.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

function render(text, vars) {
  return text
    .replaceAll('{{game_name}}', vars.gameName)
    .replaceAll('{{title_name}}', vars.titleName)
    .replaceAll('{{slug}}', vars.slug)
    .replaceAll('{{date}}', vars.date);
}

const options = parseArgs(process.argv.slice(2));
if (!options.game) {
  console.error('Usage: generate-game-skill.mjs --game "Game Name" [--slug game-slug] [--out root] [--force]');
  process.exit(2);
}

const date = new Date().toISOString().slice(0, 10);
const slug = slugify(options.slug || options.game);
const outRoot = path.resolve(options.out || repoRoot);
const target = path.join(outRoot, 'skills', `game-account-${slug}`);
const skillsRoot = path.join(outRoot, 'skills');
const relativeTarget = path.relative(skillsRoot, target);
if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget) || !path.basename(target).startsWith('game-account-')) {
  console.error(`Refusing to write outside skills/game-account-* target: ${target}`);
  process.exit(1);
}
if (fs.existsSync(target) && !options.force) {
  console.error(`Target already exists: ${target}. Use --force to overwrite.`);
  process.exit(1);
}
if (!fs.existsSync(templateRoot)) {
  console.error(`Template root not found: ${templateRoot}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
const vars = { gameName: options.game, titleName: titleName(options.game), slug, date };
const written = [];

for (const source of walkFiles(templateRoot)) {
  const relative = path.relative(templateRoot, source);
  let targetRelative = relative;
  if (relative === 'SKILL.md.template') {
    targetRelative = 'SKILL.md';
  }
  if (relative === 'test-fixtures/validation-sample.json') {
    targetRelative = `test-fixtures/${slug}-validation-sample.json`;
  }
  const destination = path.join(target, targetRelative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const content = render(fs.readFileSync(source, 'utf8'), vars);
  fs.writeFileSync(destination, content);
  written.push(path.relative(outRoot, destination));
}

const validationScript = path.join(target, 'scripts/validate-sample.mjs');
const validation = spawnSync('node', [validationScript], { encoding: 'utf8' });
const report = {
  game: options.game,
  slug,
  target: path.relative(outRoot, target),
  files: written,
  validation: {
    ok: validation.status === 0,
    stdout: validation.stdout.trim(),
    stderr: validation.stderr.trim()
  },
  next_steps: [
    'Run game-account-community-updater with real evidence.',
    'Run game-account-skill-evaluator before using the skill for real purchases.'
  ]
};

console.log('<skill_generation_report>');
console.log(`  <game>${report.game}</game>`);
console.log(`  <skill_path>${report.target}</skill_path>`);
console.log(`  <validation_ok>${report.validation.ok}</validation_ok>`);
console.log(`  <files format="json">${JSON.stringify(report.files)}</files>`);
console.log(`  <next_steps format="json">${JSON.stringify(report.next_steps)}</next_steps>`);
console.log('</skill_generation_report>');

if (!report.validation.ok) {
  console.error(report.validation.stderr || report.validation.stdout);
  process.exit(1);
}
