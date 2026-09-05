import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function discoverSkills(root) {
  return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, 'skills', entry.name, 'SKILL.md')))
    .map((entry) => entry.name).sort();
}

export function dependencyClosure(names, config) {
  const closure = new Set();
  function visit(name) {
    if (closure.has(name)) return;
    closure.add(name);
    for (const dependency of config.required[name] ?? config.game_required) visit(dependency);
  }
  names.forEach(visit);
  return [...closure].sort();
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

export function contextFor(root, files) {
  const skills = new Set(discoverSkills(root));
  const contexts = new Set(['AGENTS.md', 'CONTEXT.md', 'docs/development/workflow.md']);
  const gates = new Set(['verify:harness']);
  const owners = new Set();
  let liveRequired = false;
  for (const file of files) {
    if (file.startsWith('/') || file.split('/').includes('..')) throw new Error(`Expected a repository-relative path: ${file}`);
    const skill = file.match(/^skills\/([^/]+)\//)?.[1];
    if (skill && skills.has(skill)) {
      owners.add(skill);
      contexts.add(`skills/${skill}/SKILL.md`);
      contexts.add('docs/development/architecture.md');
      if (fs.existsSync(path.join(root, 'skills', skill, 'references/valuation-rules.md'))) {
        contexts.add(`skills/${skill}/references/valuation-rules.md`);
        gates.add(`skill:${skill}`);
      } else gates.add('verify:skills');
    } else if (!/^(docs\/|changelogs\/|README|AGENTS\.md$|CLAUDE\.md$|CONTEXT\.md$|assets\/)/.test(file)) {
      gates.add('verify:skills');
    }
    if (/^skills\/game-account-toolkit\/(ego-operations\/|references\/operation-support-matrix\.json|scripts\/run-ego-operation\.mjs)/.test(file)
      || /scripts\/(?:run-.*selection|browser-routing)\.mjs$/.test(file)) liveRequired = true;
  }
  if (gates.has('verify:skills')) for (const gate of gates) if (gate.startsWith('skill:')) gates.delete(gate);
  return { files, owners: [...owners], read: [...contexts], gates: [...gates], live_required: liveRequired,
    live_command: liveRequired ? 'npm run verify:live-game-skills' : null };
}

export function gateCommands(gate) {
  if (['verify:harness', 'verify:skills'].includes(gate)) return [['npm', ['run', gate]]];
  if (!/^skill:game-account-[a-z0-9-]+$/.test(gate)) throw new Error(`Unknown gate: ${gate}`);
  const skill = gate.slice(6);
  const base = `skills/${skill}/scripts`;
  return [
    [process.execPath, [`${base}/validate-sample.mjs`]],
    [process.execPath, [`${base}/${skill === 'game-account-arknights' ? 'validate-selection-output' : 'validate-finalizer'}.mjs`]],
    [process.execPath, ['skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs', `skills/${skill}`, '--json']],
  ];
}
