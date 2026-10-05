import fs from 'node:fs';
import path from 'node:path';
import { assessClaim, validateEvidence } from '../../../game-account-toolkit/scripts/community-evidence.mjs';

// This is a gate for factual valuation updates, not proof that a web source is truthful.
export function verifyValuationEvidence(root, before, changed) {
  const skill = 'skills/game-account-arknights';
  const snapshotFile = `${skill}/references/community-evidence.json`;
  const mapFile = `${skill}/references/operator-value-map.json`;
  if (!changed.includes(snapshotFile) && !changed.includes(mapFile)) return { checked: false };
  const snapshot = fs.existsSync(path.join(root, snapshotFile)) ? JSON.parse(fs.readFileSync(path.join(root, snapshotFile), 'utf8')) : null;
  const supported = (Array.isArray(snapshot?.claims) ? snapshot.claims : []).filter((claim) => claim?.kind === 'operator_valuation' && claim.status === 'supported');
  if (snapshot && !validateEvidence(snapshot).valid) throw new Error('Valuation evidence schema is invalid');
  for (const claim of supported) if (!claim.contexts.every((context) => assessClaim(claim, snapshot, { context }).eligible)) throw new Error(`Current independent valuation evidence missing: ${claim.id}`);
  const changedSubjects = [];
  if (changed.includes(mapFile)) {
    const previous = before[mapFile] ? JSON.parse(fs.readFileSync(path.join(root, '.harness/learning-objects', before[mapFile]), 'utf8')) : { operators: {} };
    const current = JSON.parse(fs.readFileSync(path.join(root, mapFile), 'utf8'));
    const fields = ['combat_value', 'story_value', 'meta_tier', 'roles', 'requirements'];
    for (const [name, value] of Object.entries(current.operators ?? {})) {
      const changes = fields.filter((field) => JSON.stringify(value[field]) !== JSON.stringify(previous.operators?.[name]?.[field]));
      if (!changes.length) continue;
      changedSubjects.push(name);
      if (!supported.some((claim) => claim.subject === name && changes.every((field) => JSON.stringify(claim.values?.[field]) === JSON.stringify(value[field])))) throw new Error(`Valuation change lacks matching current sources: ${name}`);
    }
  }
  return { checked: true, supported_claim_ids: supported.map((claim) => claim.id), changed_subjects: changedSubjects };
}
