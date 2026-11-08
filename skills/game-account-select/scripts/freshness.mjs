#!/usr/bin/env node
// Pre-screening data freshness check for one game's durable knowledge.
// Decides whether references/games/<game>/ must be refreshed before listings are screened.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_AGE_DAYS = 7;
const DAY = 86400000;

const dateOf = (value) => {
  const match = String(value ?? '').match(/\d{4}-\d{2}-\d{2}/);
  return match ? new Date(`${match[0]}T00:00:00Z`) : null;
};
const ageDays = (date, today) => (date ? Math.floor((today - date) / DAY) : null);

export function checkFreshness(game, { today = new Date(), root = skillRoot } = {}) {
  const dir = path.join(root, 'references', 'games', game);
  if (!fs.existsSync(path.join(dir, 'game.json'))) {
    return { game, status: 'missing', refresh_required: true, max_confidence: 'low', reasons: ['game directory not found; add it first (workflow: 新增游戏或站点)'], targets: [] };
  }
  // Use the local calendar day so "attempted today" matches the user's day, not UTC.
  const now = dateOf(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
  const evidencePath = path.join(dir, 'data', 'community-evidence.json');
  const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : {};
  const snapshotText = fs.existsSync(path.join(dir, 'evidence.md')) ? fs.readFileSync(path.join(dir, 'evidence.md'), 'utf8') : '';
  const snapshotDate = dateOf(evidence.updated_at) ?? dateOf(snapshotText.match(/^updated_at:\s*(\S+)/m)?.[1]);

  const reasons = [];
  const targets = [];
  const snapshotAge = ageDays(snapshotDate, now);
  if (snapshotAge === null) { reasons.push('community evidence has no date'); targets.push('evidence'); }
  else if (snapshotAge > MAX_AGE_DAYS) { reasons.push(`community evidence is ${snapshotAge} days old (> ${MAX_AGE_DAYS})`); targets.push('evidence'); }

  const currentClaims = (evidence.claims ?? []).filter((claim) => {
    const age = ageDays(dateOf(claim.as_of), now);
    return claim.status === 'supported' && age !== null && age <= MAX_AGE_DAYS;
  });
  if (!currentClaims.length) reasons.push('no supported claim within the freshness window');
  if (!evidence.version_context || /unverified|unconfirmed/.test(evidence.version_context)) {
    reasons.push(`game version not confirmed (${evidence.version_context ?? 'missing'})`);
    targets.push('version');
  }

  const signals = config.signals.filter((signal) => signal.names).map((signal) => {
    const age = ageDays(dateOf(signal.as_of), now);
    return { id: signal.id, label: signal.label, as_of: signal.as_of ?? null, age_days: age, stale: age === null || age > MAX_AGE_DAYS };
  });
  for (const signal of signals.filter((item) => item.stale)) {
    reasons.push(`${signal.label} list is ${signal.age_days ?? 'undated'}${signal.age_days === null ? '' : ' days old'}`);
    targets.push(`signal:${signal.id}`);
  }

  const attempt = evidence.last_refresh_attempt ?? null;
  const attemptAge = ageDays(dateOf(attempt?.date), now);
  const recentlyAttempted = attemptAge !== null && attemptAge < 1;
  const stale = targets.length > 0;
  return {
    game,
    checked_on: now.toISOString().slice(0, 10),
    status: !stale ? 'fresh' : recentlyAttempted ? 'stale_refresh_attempted_today' : 'stale',
    refresh_required: stale && !recentlyAttempted,
    max_confidence: !stale && currentClaims.length ? 'high' : 'medium',
    snapshot_date: snapshotDate ? snapshotDate.toISOString().slice(0, 10) : null,
    current_claims: currentClaims.length,
    signals,
    last_refresh_attempt: attempt,
    reasons,
    targets: [...new Set(targets)],
    operation: `references/games/${game}/operations/refresh-evidence.md`,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const game = value('--game');
  if (!game || args.includes('--help')) {
    console.log('Usage: freshness.mjs --game <slug> [--today YYYY-MM-DD]\nExit 0 = fresh or already attempted today; exit 3 = refresh required before screening.');
    process.exit(game ? 0 : 2);
  }
  const result = checkFreshness(game, { today: value('--today') ? new Date(`${value('--today')}T12:00:00`) : new Date() });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.refresh_required ? 3 : 0;
}
