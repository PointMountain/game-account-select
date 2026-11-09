#!/usr/bin/env node
// Link this checkout's skill into each agent skill directory, pruning broken links left by removed skills.
import fs from 'node:fs';
import path from 'node:path';
import { discoverSkills, lstatIfPresent, sameRealPath, staleRepoLinks, targetRoots } from './lib/skill-links.mjs';

const results = [];
let conflicted = false;
for (const root of targetRoots()) {
  fs.mkdirSync(root, { recursive: true });
  const pruned = staleRepoLinks(root).map((target) => { fs.unlinkSync(target); return path.basename(target); });
  const linked = [];
  const alreadyLinked = [];
  const conflicts = [];
  for (const skill of discoverSkills()) {
    const target = path.join(root, skill.name);
    const stat = lstatIfPresent(target);
    if (!stat) { fs.symlinkSync(skill.source, target, 'dir'); linked.push(skill.name); continue; }
    if (stat.isSymbolicLink() && sameRealPath(target, skill.source)) { alreadyLinked.push(skill.name); continue; }
    conflicts.push({ name: skill.name, target });
  }
  conflicted ||= conflicts.length > 0;
  results.push({ target_root: root, pruned_stale: pruned, linked, already_linked: alreadyLinked, conflicts });
}
console.log(JSON.stringify(results, null, 2));
if (conflicted) process.exitCode = 1;
