import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createSelectionCheckpoint({ file, identity, resume = false, budgetMs = 25 * 60000, now = () => Date.now() }) {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0 || budgetMs > 30 * 60000) throw new Error('Selection budget must be within 30 minutes');
  if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Checkpoint must not be a symlink');
  const identityHash = hash(identity);
  let state = { schema_version: 1, identity_hash: identityHash, started_at: now(), budget_ms: budgetMs, operations: {}, task_space_id: null, status: 'running' };
  if (resume) {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.schema_version !== 1 || state.identity_hash !== identityHash) throw new Error('Checkpoint profile or query settings differ');
    if (state.status === 'completed') throw new Error('Completed runs must start a new query');
    if (state.status === 'user_control') throw new Error('Browser control requires explicit user resume before querying');
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  }
  const remaining = () => Math.max(0, state.started_at + state.budget_ms - now());
  return {
    state, remaining, save,
    stop(status) { state.status = status; save(); },
    execute(key, execute, { fresh = false } = {}) {
      const id = hash(key);
      const prior = state.operations[id];
      if (!fresh && prior?.result?.ok && now() - prior.observed_at < 15 * 60000) return { ...prior.result, cache_hit: true, observed_at: new Date(prior.observed_at).toISOString(), duration_ms: 0 };
      if (!remaining()) return { ok: false, stdout: '', stderr: 'selection_time_budget_exhausted', error_text: 'selection_time_budget_exhausted', duration_ms: 0, operation_report: null };
      if ((prior?.attempts ?? 0) >= 2 && !fresh) return { ...prior.result, retry_exhausted: true, duration_ms: 0 };
      // Write intent before I/O so interruption leaves a resumable, bounded attempt.
      state.operations[id] = { ...prior, key, attempts: (prior?.attempts ?? 0) + 1, status: 'running' };
      save();
      const result = execute(remaining());
      const observedAt = now();
      state.operations[id] = { ...state.operations[id], status: result.ok ? 'success' : 'failed', observed_at: observedAt, result };
      const taskId = result.operation_report?.task_space_id;
      if (taskId != null) state.task_space_id = taskId;
      save();
      return { ...result, observed_at: new Date(observedAt).toISOString() };
    },
  };
}
