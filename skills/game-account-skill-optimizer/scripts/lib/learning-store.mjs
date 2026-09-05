import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const verificationCommand = ['npm', 'run', 'verify:skills'];
const rank = { blocking: 5, high: 4, medium: 3, low: 2, info: 1 };
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// Paths and commands from run artifacts are data, never executable instructions.
export function safePath(root, relative) {
  if (typeof relative !== 'string' || !/^(skills|scripts|docs|changelogs)\//.test(relative)
    || relative.split('/').some((part) => !part || part === '..' || part === '.')
    || relative.includes('\\')) throw new Error(`Invalid learning target: ${relative}`);
  const absolute = path.resolve(root, relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Symlink target: ${relative}`);
  }
  return absolute;
}

export function snapshot(root) {
  const result = {};
  function visit(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) { result[relative] = `symlink:${fs.readlinkSync(absolute)}`; return; }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(`${relative}/${name}`);
    } else result[relative] = digest(fs.readFileSync(absolute));
  }
  for (const name of ['skills', 'scripts', 'docs', 'changelogs', '.github', 'package.json', 'AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'README.md', 'README.en.md', '.gitignore']) visit(name);
  return result;
}

export function readStore(root) {
  const file = path.join(root, '.harness/learning.json');
  if (!fs.existsSync(file)) return { schema_version: 1, candidates: [], baselines: {} };
  const store = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (store.schema_version !== 1 || !Array.isArray(store.candidates) || !store.baselines) throw new Error('Unsupported learning store');
  return store;
}

export function updateStore(root, callback) {
  const directory = path.join(root, '.harness');
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Learning directory must not be a symlink');
  const lock = path.join(directory, 'learning.lock');
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Learning store is locked; inspect the active writer before retrying');
    throw error;
  }
  const temporary = path.join(directory, `learning.${process.pid}.tmp`);
  try {
    const store = readStore(root);
    const result = callback(store);
    fs.writeFileSync(temporary, json(store), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, path.join(directory, 'learning.json'));
    return result;
  } finally {
    fs.rmSync(temporary, { force: true });
    fs.rmdirSync(lock);
  }
}

export function collectFindings(store, { root, artifact, artifactHash, report, now = new Date().toISOString() }) {
  const before = snapshot(root);
  const baselineId = digest(JSON.stringify(before));
  const runKey = digest(String(artifact.run_id ?? artifact.query_session_id ?? artifactHash));
  const collected = [];
  const targetSkill = String(report.target_skill).replace(/^\.\//, '').replace(/^skills\//, '');
  for (const finding of report.findings ?? []) {
    if (finding.severity === 'info') continue;
    const targets = [...new Set(finding.suggested_targets ?? [])].sort();
    for (const target of targets) safePath(root, target);
    const id = digest(`${targetSkill}:${finding.id}`).slice(0, 20);
    let candidate = store.candidates.find((item) => item.id === id);
    if (!candidate) {
      candidate = { id, finding_id: finding.id, target_skill: targetSkill, severity: finding.severity,
        category: finding.category, targets, status: 'proposed', baseline_id: baselineId,
        observations: [], history: [{ at: now, status: 'proposed', reason: 'observed' }] };
      store.candidates.push(candidate);
    }
    candidate.targets = [...new Set([...candidate.targets, ...targets])].sort();
    if (candidate.observations.some((item) => item.run_key === runKey)) { collected.push(candidate.id); continue; }
    if (['applied', 'validated'].includes(candidate.status)) {
      candidate.status = 'proposed';
      candidate.baseline_id = baselineId;
      delete candidate.receipt;
      candidate.history.push({ at: now, status: 'proposed', reason: 'finding_recurred' });
    }
    if (rank[finding.severity] > rank[candidate.severity]) candidate.severity = finding.severity;
    // Hashes identify the local source without copying requests, seller data, URLs, or secrets.
    candidate.observations.push({ run_key: runKey, artifact_sha256: artifactHash, at: now });
    store.baselines[candidate.baseline_id] ??= before;
    collected.push(candidate.id);
  }
  return collected;
}

export function orderedCandidates(store) {
  return [...store.candidates].sort((a, b) => (rank[b.severity] - rank[a.severity])
    || b.observations.length - a.observations.length || a.id.localeCompare(b.id));
}

export function getCandidate(store, id) {
  const item = store.candidates.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown learning candidate: ${id}`);
  return item;
}

function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .filter((file) => before[file] !== after[file]);
}

export function verifyCandidate(root, store, id, run = () => spawnSync(verificationCommand[0], verificationCommand.slice(1), {
  cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, shell: false,
})) {
  const candidate = getCandidate(store, id);
  if (['rejected', 'deferred'].includes(candidate.status)) throw new Error('Resume the candidate before verification');
  const before = store.baselines[candidate.baseline_id];
  if (!before) throw new Error('Missing pre-change baseline');
  const after = snapshot(root);
  const changed = changedFiles(before, after);
  const targetChanges = candidate.targets.filter((target) => changed.includes(target));
  const regressions = changed.filter((file) => /(?:test-fixtures|\/tests\/|\/evals\/|\/validate[^/]*\.[cm]?js$)/.test(file) && after[file]);
  if (!targetChanges.length || !regressions.length) throw new Error('Verification requires a changed suggested target and a changed regression fixture/test');
  const result = run();
  const passed = result.status === 0 && !result.error && JSON.stringify(after) === JSON.stringify(snapshot(root));
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`;
  const directory = path.join(root, '.harness');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Learning directory must not be a symlink');
  const log = `.harness/${digest(id).slice(0, 20)}.verification.log`;
  if (fs.lstatSync(path.join(root, log), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Verification log must not be a symlink');
  fs.writeFileSync(path.join(root, log), output, { mode: 0o600 });
  candidate.status = passed ? 'validated' : 'proposed';
  candidate.receipt = { schema_version: 1, candidate_id: id, passed, command: verificationCommand,
    source_digest: digest(JSON.stringify(after)), baseline_id: candidate.baseline_id,
    changed_targets: targetChanges, regressions, exit_code: result.status,
    output_sha256: digest(output), log_path: log, verified_at: new Date().toISOString() };
  candidate.history.push({ at: candidate.receipt.verified_at, status: candidate.status, reason: passed ? 'regressions_passed' : 'verification_failed_or_sources_changed' });
  return candidate.receipt;
}

export function receiptIsCurrent(root, store, candidate) {
  const receipt = candidate?.receipt;
  return Boolean(receipt?.passed && receipt.candidate_id === candidate.id
    && receipt.baseline_id === candidate.baseline_id && store.baselines[candidate.baseline_id]
    && receipt.changed_targets?.length && receipt.regressions?.length && receipt.exit_code === 0
    && JSON.stringify(receipt.command) === JSON.stringify(verificationCommand)
    && receipt.source_digest === digest(JSON.stringify(snapshot(root))));
}

export function transition(root, store, id, status, reason) {
  const candidate = getCandidate(store, id);
  if (!reason?.trim()) throw new Error('A transition needs a reason');
  if (!['applied', 'deferred', 'rejected', 'proposed'].includes(status)) throw new Error(`Invalid transition: ${status}`);
  if (status === 'applied' && (candidate.status !== 'validated' || !receiptIsCurrent(root, store, candidate))) {
    throw new Error('Apply requires a validated, current verification receipt');
  }
  if (status === 'proposed') delete candidate.receipt;
  candidate.status = status;
  candidate.history.push({ at: new Date().toISOString(), status, reason });
  return candidate;
}

export function appliedEvidence(root, candidate, store = null) {
  if (!['applied', 'accepted', 'merged'].includes(candidate?.apply_status ?? candidate?.status)) return { claimed: false, valid: false };
  if (candidate.source_scope === 'selection_profile' || candidate.preference_scope === 'run_only') {
    return { claimed: true, valid: false, reason: 'run-only preferences cannot become durable improvements' };
  }
  try {
    const ledger = store ?? readStore(root);
    const entry = getCandidate(ledger, candidate.learning_candidate_id);
    const valid = entry.status === 'applied' && receiptIsCurrent(root, ledger, entry)
      && candidate.learning_receipt_digest === digest(JSON.stringify(entry.receipt));
    return { claimed: true, valid, reason: valid ? null : 'missing, stale, or mismatched applied receipt' };
  } catch { return { claimed: true, valid: false, reason: 'no verified local learning record' }; }
}

export function knowledgeState(candidates, root) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const applied = rows.filter((item) => appliedEvidence(root, item).valid).length;
  const verifiedExisting = rows.filter((item) => ['verified_existing', 'already_implemented', 'observed_existing'].includes(item?.apply_status ?? item?.status)).length;
  return { total: rows.length, applied, verified_existing: verifiedExisting, pending: rows.length - applied - verifiedExisting };
}
