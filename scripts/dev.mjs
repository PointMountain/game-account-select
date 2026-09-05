#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { changedPaths, contextFor, gateCommands } from './lib/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command = 'context', ...args] = process.argv.slice(2);
const value = (flag) => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1]; };
try {
  if (command === '--help') {
    console.log('dev.mjs context|plan|check [--files path ...] [--base git-ref] [--full]\nplan requires --task slug --goal text --acceptance text. check runs offline gates; live_required remains a separate delivery requirement.');
  } else {
    if (!['context', 'plan', 'check'].includes(command)) throw new Error(`Unknown command: ${command}`);
    const index = args.indexOf('--files');
    const files = index < 0 ? changedPaths(root, value('--base')) : args.slice(index + 1).filter((file, i, all) => !all.slice(0, i + 1).some((part) => part.startsWith('--')));
    const context = contextFor(root, files);
    if (args.includes('--full')) context.gates = ['verify:skills'];
    if (command === 'plan') {
      const task = value('--task');
      if (!/^[a-z0-9][a-z0-9-]{0,70}$/.test(task ?? '') || !value('--goal') || !value('--acceptance')) throw new Error('plan needs --task <slug>, --goal <outcome>, --acceptance <checkable result>');
      const directory = path.join(root, '.harness/tasks');
      fs.mkdirSync(directory, { recursive: true });
      const output = path.join(directory, `${task}.json`);
      const card = { schema_version: 1, task, goal: value('--goal'), acceptance: value('--acceptance'),
        status: 'planned', created_at: new Date().toISOString(), ...context,
        steps: ['Reproduce or establish a baseline', 'Implement within listed ownership', 'Run selected gates and required live checks', 'Record verified learning and changelog'],
        evidence: [], issue: null };
      fs.writeFileSync(output, `${JSON.stringify(card, null, 2)}\n`, { flag: 'wx' });
      console.log(JSON.stringify({ task_card: output, ...card }, null, 2));
    } else if (command === 'context') console.log(JSON.stringify(context, null, 2));
    else {
      const results = [];
      for (const gate of context.gates) {
        for (const [binary, parameters] of gateCommands(gate)) {
          console.error(`Checking ${gate}: ${[binary, ...parameters].join(' ')}`);
          const run = spawnSync(binary, parameters, { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, shell: false });
          results.push({ gate, passed: run.status === 0 && !run.error });
          if (run.status !== 0 || run.error) { console.error(run.stderr || run.stdout || run.error?.message); break; }
        }
        if (results.some((result) => !result.passed)) break;
      }
      const passed = results.every((result) => result.passed);
      console.log(JSON.stringify({ ...context, offline_passed: passed, delivery_ready: passed && !context.live_required, results }, null, 2));
      if (!passed) process.exitCode = 1;
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
