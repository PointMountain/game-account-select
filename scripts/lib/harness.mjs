import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SKILL = 'game-account-select';

export function discoverSkills(root) {
  return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, 'skills', entry.name, 'SKILL.md')))
    .map((entry) => entry.name).sort();
}

export function changedPaths(root, base) {
  const commands = base
    ? [['diff', '--name-only', '--no-renames', `${base}...HEAD`, '--']]
    : [['diff', '--name-only', '--no-renames', 'HEAD', '--'], ['ls-files', '--others', '--exclude-standard']];
  return [...new Set(commands.flatMap((args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim().split('\n').filter(Boolean);
  }))].sort();
}

const base = `skills/${SKILL}`;

export function contextFor(root, files) {
  const contexts = new Set(['AGENTS.md', 'CONTEXT.md', 'docs/development/workflow.md']);
  const gates = new Set(['verify:harness']);
  let liveRequired = false;
  for (const file of files) {
    if (file.startsWith('/') || file.split('/').includes('..')) throw new Error(`Expected a repository-relative path: ${file}`);
    if (file.startsWith(`${base}/`)) {
      contexts.add(`${base}/SKILL.md`);
      contexts.add(`${base}/references/ops-model.md`);
      const site = file.match(/^skills\/[^/]+\/references\/sites\/([^/]+)\//)?.[1];
      const game = file.match(/^skills\/[^/]+\/references\/games\/([^/]+)\//)?.[1];
      if (site) contexts.add(`${base}/references/sites/${site}/index.md`);
      if (game) contexts.add(`${base}/references/games/${game}/index.md`);
      if (/references\/(knowledge-schema|ops-model)\.md$|references\/(sites|games)\//.test(file)) contexts.add(`${base}/references/knowledge-schema.md`);
    }
    if (!/^(docs\/|changelogs\/|README|AGENTS\.md$|CLAUDE\.md$|CONTEXT\.md$|assets\/)/.test(file)) gates.add('verify:skills');
    if (new RegExp(`^${base}/(scripts/(query|cleanup|browser-routing)\\.mjs|scripts/parsers/|references/operations\\.json|references/sites/[^/]+/operations/)`).test(file)) liveRequired = true;
  }
  return { files, owners: files.some((file) => file.startsWith(`${base}/`)) ? [SKILL] : [], read: [...contexts], gates: [...gates],
    live_required: liveRequired, live_command: liveRequired ? 'node skills/game-account-select/scripts/query.mjs --operation <site/game-mode> ... (real ego-browser run)' : null };
}

export function gateCommands(gate) {
  if (['verify:harness', 'verify:skills'].includes(gate)) return [['npm', ['run', gate]]];
  throw new Error(`Unknown gate: ${gate}`);
}
