#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const wantsJson = args.has('--json');
const install = args.has('--install');
const check = args.has('--check') || !install;
const force = args.has('--force');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolkitRoot = path.resolve(__dirname, '..');
const adapterRoot = path.join(toolkitRoot, 'opencli-adapters');
const manifestPath = path.join(adapterRoot, 'manifest.json');
const opencliHome = path.resolve(process.env.GAME_ACCOUNT_OPENCLI_HOME || path.join(os.homedir(), '.opencli'));

function usage() {
  return [
    'Usage: node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs [--check|--install] [--force] [--json]',
    '',
    'Default is --check. --install writes repo-managed adapter files into ~/.opencli.',
    'Set GAME_ACCOUNT_OPENCLI_HOME=/tmp/some-opencli-home for isolated tests.'
  ].join('\n');
}

if (args.has('--help') || args.has('-h')) {
  console.log(usage());
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing adapter manifest: ${manifestPath}`);
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fileStatus(entry) {
  const sourcePath = path.join(adapterRoot, entry.source);
  const targetPath = path.join(opencliHome, entry.target);
  if (!fs.existsSync(sourcePath)) {
    return {
      ...entry,
      ok: false,
      status: 'missing_source',
      sourcePath,
      targetPath,
      action: 'fix repository adapter package'
    };
  }

  const sourceHash = sha256(sourcePath);
  if (!fs.existsSync(targetPath)) {
    return {
      ...entry,
      ok: false,
      status: 'missing_target',
      sourcePath,
      targetPath,
      sourceHash,
      action: install ? 'copy' : 'run with --install'
    };
  }

  const targetHash = sha256(targetPath);
  const same = sourceHash === targetHash;
  const exactMatchRequired = entry.kind !== 'site-memory';
  return {
    ...entry,
    ok: same || !exactMatchRequired,
    status: same ? 'up_to_date' : 'different',
    exactMatchRequired,
    sourcePath,
    targetPath,
    sourceHash,
    targetHash,
    action: same ? 'none' : exactMatchRequired
      ? force ? 'overwrite' : 'run with --install --force to overwrite'
      : 'none; local site memory differs but is acceptable'
  };
}

function copyEntry(entryStatus) {
  if (entryStatus.status === 'missing_source') return entryStatus;
  if (entryStatus.status === 'up_to_date') return { ...entryStatus, installed: false };
  if (entryStatus.status === 'different' && !entryStatus.exactMatchRequired && !force) {
    return { ...entryStatus, installed: false };
  }
  if (entryStatus.status === 'different' && !force) return { ...entryStatus, installed: false, blocked: true };

  fs.mkdirSync(path.dirname(entryStatus.targetPath), { recursive: true });
  fs.copyFileSync(entryStatus.sourcePath, entryStatus.targetPath);
  return {
    ...entryStatus,
    installed: true,
    ok: true,
    status: entryStatus.status === 'different' ? 'overwritten' : 'installed'
  };
}

const before = (manifest.files ?? []).map(fileStatus);
const results = install ? before.map(copyEntry) : before;
const missing = results.filter((entry) => entry.status === 'missing_target');
const different = results.filter((entry) => entry.status === 'different' && entry.exactMatchRequired !== false);
const blocked = results.filter((entry) => entry.blocked);
const missingSource = results.filter((entry) => entry.status === 'missing_source');
const warnings = results
  .filter((entry) => entry.status === 'different' && entry.exactMatchRequired === false)
  .map((entry) => `Local ${entry.target} differs from repo memory; keeping local notes/endpoints.`);
const ok = missingSource.length === 0
  && missing.length === 0
  && different.length === 0
  && blocked.length === 0
  && results.every((entry) => entry.ok || entry.status === 'installed' || entry.status === 'overwritten');

const report = {
  ok,
  mode: install ? 'install' : check ? 'check' : 'unknown',
  opencli_home: opencliHome,
  manifest: {
    schema_version: manifest.schema_version,
    name: manifest.name,
    updated_at: manifest.updated_at
  },
  adapters: manifest.adapters ?? [],
  files: results.map((entry) => ({
    source: entry.source,
    target: entry.target,
    kind: entry.kind,
    status: entry.status,
    ok: entry.ok,
    action: entry.action,
    exactMatchRequired: entry.exactMatchRequired,
    sourceHash: entry.sourceHash,
    targetHash: entry.targetHash
  })),
  warnings,
  manual_actions: [
    ...missing.map((entry) => `Install ${entry.target} with --install.`),
    ...different.map((entry) => `Local ${entry.target} differs; inspect it or run --install --force.`),
    ...missingSource.map((entry) => `Repository source missing: ${entry.source}.`)
  ],
  verify_commands: [
    ...((manifest.adapters ?? [])
      .filter((adapter) => adapter.site && adapter.command)
      .map((adapter) => `opencli validate ${adapter.site}/${adapter.command}`)),
    ...((manifest.adapters ?? []).map((adapter) => adapter.verify_command).filter(Boolean))
  ]
};

if (wantsJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`<opencli_adapter_report>`);
  console.log(`  <ok>${report.ok}</ok>`);
  console.log(`  <mode>${report.mode}</mode>`);
  console.log(`  <opencli_home>${report.opencli_home}</opencli_home>`);
  console.log(`  <files format="json">${JSON.stringify(report.files)}</files>`);
  console.log(`  <warnings format="json">${JSON.stringify(report.warnings)}</warnings>`);
  console.log(`  <manual_actions format="json">${JSON.stringify(report.manual_actions)}</manual_actions>`);
  console.log(`  <verify_commands format="json">${JSON.stringify(report.verify_commands)}</verify_commands>`);
  console.log(`</opencli_adapter_report>`);
}

process.exit(report.ok ? 0 : 1);
