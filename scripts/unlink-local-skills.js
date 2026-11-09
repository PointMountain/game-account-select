#!/usr/bin/env node
// Remove this checkout's skill links (and broken links to removed repo skills) from each agent skill directory.
import fs from 'node:fs';
import path from 'node:path';
import { discoverSkills, lstatIfPresent, sameRealPath, staleRepoLinks, targetRoots } from './lib/skill-links.mjs';

const results = [];
for (const root of targetRoots()) {
  const removed = staleRepoLinks(root).map((target) => { fs.unlinkSync(target); return path.basename(target); });
  const skipped = [];
  for (const skill of discoverSkills()) {
    const target = path.join(root, skill.name);
    const stat = lstatIfPresent(target);
    if (!stat) { skipped.push({ name: skill.name, reason: 'missing' }); continue; }
    if (!stat.isSymbolicLink() || !sameRealPath(target, skill.source)) { skipped.push({ name: skill.name, reason: 'not this checkout' }); continue; }
    fs.unlinkSync(target);
    removed.push(skill.name);
  }
  results.push({ target_root: root, removed, skipped });
}
console.log(JSON.stringify(results, null, 2));
