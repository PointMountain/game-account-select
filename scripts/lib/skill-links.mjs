import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const skillsRoot = path.join(repoRoot, 'skills');

// Agent skill directories that load from symlinks. Override with SKILL_LINK_TARGETS (path-delimited).
export function targetRoots() {
  if (process.env.SKILL_LINK_TARGETS) return process.env.SKILL_LINK_TARGETS.split(path.delimiter).filter(Boolean);
  return [path.join(os.homedir(), '.agents', 'skills'), path.join(os.homedir(), '.claude', 'skills')];
}

export function discoverSkills() {
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => {
      const content = fs.readFileSync(path.join(skillsRoot, entry.name, 'SKILL.md'), 'utf8');
      const name = content.match(/^---\n[\s\S]*?^name:\s*(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, '') ?? entry.name;
      return { name, source: path.join(skillsRoot, entry.name) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function lstatIfPresent(target) {
  try { return fs.lstatSync(target); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

export function sameRealPath(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); } catch { return false; }
}

// Symlinks in a target root that point into this repo's skills/ but at a directory that no longer exists.
export function staleRepoLinks(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).map((name) => path.join(root, name)).filter((target) => {
    if (!lstatIfPresent(target)?.isSymbolicLink()) return false;
    const destination = path.resolve(root, fs.readlinkSync(target));
    return destination.startsWith(`${skillsRoot}${path.sep}`) && !fs.existsSync(destination);
  });
}
