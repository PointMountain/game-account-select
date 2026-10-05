import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const protectedRegression = (file) => /(?:\/test-fixtures\/|scripts\/tests\/|\/evals\/|\/validate[^/]*\.[cm]?js$)/.test(file);

export function captureBaseline(root, baseline, sourceRoot = root) {
  const directory = path.join(root, '.harness', 'learning-objects');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Learning objects must not be a symlink');
  for (const [file, digest] of Object.entries(baseline)) {
    if (digest.startsWith('symlink:')) continue;
    const target = path.join(directory, digest);
    if (fs.existsSync(target)) { if (hash(fs.readFileSync(target)) !== digest) throw new Error('Corrupt baseline object'); continue; }
    const bytes = fs.readFileSync(path.join(sourceRoot, file));
    if (hash(bytes) !== digest) throw new Error(`Pre-change baseline unavailable: ${file}`);
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  }
  return { captured: true, protected_regressions: Object.keys(baseline).filter(protectedRegression) };
}

export function checkProtectedRegressions(before, after) {
  const changed = Object.keys(before).filter((file) => protectedRegression(file) && before[file] !== after[file]);
  return { passed: changed.length === 0, changed };
}

export function rollbackTargets(root, baseline, receipt) {
  const files = receipt.changed_targets ?? [];
  const restorations = files.map((file) => {
    if (!/^(skills|scripts|docs|changelogs)\//.test(file) || file.split('/').includes('..')) throw new Error('Invalid rollback target');
    const expected = receipt.after_files?.[file];
    const target = path.join(root, file);
    for (let parent = target; parent !== root; parent = path.dirname(parent)) if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Rollback refuses symlinks');
    if (!expected || !fs.existsSync(target) || hash(fs.readFileSync(target)) !== expected) throw new Error(`File changed since verification: ${file}`);
    const digest = baseline[file];
    const bytes = digest ? fs.readFileSync(path.join(root, '.harness/learning-objects', digest)) : null;
    if (bytes && hash(bytes) !== digest) throw new Error('Corrupt rollback object');
    return { file, target, bytes };
  });
  // Validate every target before the first write. Restore only this candidate's named responsibility files.
  for (const { target, bytes } of restorations) {
    if (bytes) fs.writeFileSync(target, bytes); else fs.unlinkSync(target);
  }
  return { restored: restorations.map(({ file }) => file), scope: 'candidate_responsibility_files' };
}
