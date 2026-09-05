#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectFindings, readStore, updateStore, orderedCandidates, verifyCandidate, transition, digest } from './lib/learning-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [command, ...args] = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; }
try {
  let result;
  if (command === 'collect') {
    const input = option('--input');
    if (!input) throw new Error('collect requires --input <raw-run.json>');
    const body = fs.readFileSync(path.resolve(input), 'utf8');
    const artifact = JSON.parse(body);
    if (Array.isArray(artifact.findings) || !artifact.target_skill) throw new Error('Expected a raw run artifact with target_skill, not an optimizer report');
    const analysis = spawnSync(process.execPath, [path.join(root, 'skills/game-account-skill-optimizer/scripts/analyze-run.mjs'), '--input', path.resolve(input), '--json'], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    if (analysis.status !== 0) throw new Error(`Optimizer failed: ${analysis.stderr}`);
    const report = JSON.parse(analysis.stdout);
    result = updateStore(root, (store) => ({ candidates: collectFindings(store, { root, artifact, artifactHash: digest(body), report }) }));
  } else if (command === 'status') {
    result = { candidates: orderedCandidates(readStore(root)) };
  } else if (command === 'verify') {
    result = updateStore(root, (store) => verifyCandidate(root, store, option('--id')));
    if (!result.passed) process.exitCode = 1;
  } else if (['apply', 'defer', 'reject', 'resume'].includes(command)) {
    const status = { apply: 'applied', defer: 'deferred', reject: 'rejected', resume: 'proposed' }[command];
    result = updateStore(root, (store) => transition(root, store, option('--id'), status, option('--reason')));
    if (status === 'applied') result = { candidate: result, artifact_reference: {
      learning_candidate_id: result.id, learning_receipt_digest: digest(JSON.stringify(result.receipt)), apply_status: 'applied',
    } };
  } else if (command === '--help' || !command) {
    result = { usage: 'learning-loop.mjs collect --input run.json | status | verify --id ID | apply|defer|reject|resume --id ID --reason TEXT',
      note: 'collect before editing; verify executes the fixed offline suite; apply records an already implemented and verified patch.' };
  } else throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
