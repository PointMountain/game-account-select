#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
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

function escapedTemplateValue(value, extension) {
  const stringValue = String(value);
  if (extension === '.json') return JSON.stringify(stringValue).slice(1, -1);
  if (extension === '.js' || extension === '.mjs') {
    return stringValue
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }
  return stringValue.replace(/[\r\n]+/g, ' ');
}

function render(text, vars, destination) {
  const extension = path.extname(destination);
  return text
    .replaceAll('{{description_yaml}}', JSON.stringify(vars.skillDescription))
    .replaceAll('{{game_name}}', escapedTemplateValue(vars.gameName, extension))
    .replaceAll('{{title_name}}', escapedTemplateValue(vars.titleName, extension))
    .replaceAll('{{slug}}', escapedTemplateValue(vars.slug, extension))
    .replaceAll('{{user_request_sha256}}', escapedTemplateValue(vars.userRequestSha256, extension))
    .replaceAll('{{date}}', escapedTemplateValue(vars.date, extension));
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
const requiredDependencies = ['game-account-toolkit', 'game-account-skill-optimizer', 'game-account-skill-evaluator'];
const missingDependencies = requiredDependencies.filter((skill) => !fs.existsSync(path.join(skillsRoot, skill, 'SKILL.md')));
if (missingDependencies.length) {
  console.error(`Output root is missing required generated-skill dependencies: ${missingDependencies.join(', ')}`);
  process.exit(1);
}

const generatedUserRequest = `评估用户提供的 ${options.game} 账号材料`;
const vars = {
  gameName: options.game,
  titleName: titleName(options.game),
  skillDescription: `${options.game} 账号估值和筛选规则，关注命名核心资产、资源、进度和账号安全风险。`,
  slug,
  date,
  userRequestSha256: crypto.createHash('sha256').update(generatedUserRequest).digest('hex'),
};
const written = [];
const stagingTarget = target;
const backupTarget = `${target}.backup-${process.pid}-${Date.now()}`;
let previousMoved = false;
if (fs.existsSync(target)) {
  fs.renameSync(target, backupTarget);
  previousMoved = true;
}

function restorePreviousTarget() {
  fs.rmSync(stagingTarget, { recursive: true, force: true });
  if (previousMoved && fs.existsSync(backupTarget)) fs.renameSync(backupTarget, target);
}

try {
  for (const source of walkFiles(templateRoot)) {
    const relative = path.relative(templateRoot, source);
    let targetRelative = relative;
    if (relative === 'SKILL.md.template') {
      targetRelative = 'SKILL.md';
    }
    if (relative === 'test-fixtures/validation-sample.json') {
      targetRelative = `test-fixtures/${slug}-validation-sample.json`;
    }
    if (relative === 'test-fixtures/run-artifact.json') {
      targetRelative = `test-fixtures/${slug}-run-artifact.json`;
    }
    const destination = path.join(stagingTarget, targetRelative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const content = render(fs.readFileSync(source, 'utf8'), vars, destination);
    fs.writeFileSync(destination, content);
    written.push(path.relative(outRoot, path.join(target, targetRelative)));
  }
} catch (error) {
  restorePreviousTarget();
  throw error;
}

const validationScript = path.join(stagingTarget, 'scripts/validate-sample.mjs');
const validation = spawnSync('node', [validationScript], { encoding: 'utf8' });
const evaluatorScript = path.join(outRoot, 'skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs');
const quality = spawnSync('node', [evaluatorScript, stagingTarget, '--json'], { cwd: outRoot, encoding: 'utf8' });
let qualityReport = null;
try { qualityReport = JSON.parse(quality.stdout); } catch {}
const finalizerValidationScript = path.join(stagingTarget, 'scripts/validate-finalizer.mjs');
const finalizerValidation = spawnSync('node', [finalizerValidationScript], { cwd: outRoot, encoding: 'utf8' });
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
  quality: {
    ok: quality.status === 0 && qualityReport?.passed === true,
    report: qualityReport,
    stderr: quality.stderr.trim()
  },
  finalizer_validation: { ok: finalizerValidation.status === 0, stdout: finalizerValidation.stdout.trim(), stderr: finalizerValidation.stderr.trim() },
  next_steps: [
    'Run game-account-community-updater with real evidence.',
    'Run game-account-skill-evaluator before using the skill for real purchases.'
  ]
};

console.log('<skill_generation_report>');
console.log(`  <game>${report.game}</game>`);
console.log(`  <skill_path>${report.target}</skill_path>`);
console.log(`  <validation_ok>${report.validation.ok}</validation_ok>`);
console.log(`  <quality_gate_ok>${report.quality.ok}</quality_gate_ok>`);
console.log(`  <finalizer_validation_ok>${report.finalizer_validation.ok ?? 'not_run'}</finalizer_validation_ok>`);
console.log(`  <files format="json">${JSON.stringify(report.files)}</files>`);
console.log(`  <next_steps format="json">${JSON.stringify(report.next_steps)}</next_steps>`);
console.log('</skill_generation_report>');

if (!report.validation.ok || !report.quality.ok || !report.finalizer_validation.ok) {
  restorePreviousTarget();
  console.error(report.validation.stderr || report.quality.stderr || report.finalizer_validation.stderr || report.validation.stdout);
  process.exit(1);
}

if (previousMoved) fs.rmSync(backupTarget, { recursive: true, force: true });
