import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findSkill } from '../scripts/dependencies.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-account-portable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function addSkill(root, name) {
  const directory = path.join(root, '.agents/skills', name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), `# ${name}\n`);
  return path.join(directory, 'SKILL.md');
}

test('finds project, ancestor, sibling, user and custom Codex skill locations', (t) => {
  const root = fixture(t);
  const project = path.join(root, 'project');
  const nested = path.join(project, 'src/nested');
  const home = path.join(root, 'user');
  fs.mkdirSync(nested, { recursive: true });
  const projectSkill = addSkill(project, 'ego-ops');
  assert.equal(findSkill('ego-ops', { cwd: nested, home, codexHome: null, extraRoots: [] }).found, projectSkill);
  fs.rmSync(path.join(project, '.agents'), { recursive: true });
  const sibling = path.join(root, 'installed', 'ego-ops');
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, 'SKILL.md'), '# ego-ops\n');
  assert.equal(findSkill('ego-ops', { cwd: nested, home, skillRoot: path.join(root, 'installed/game-account-select'), codexHome: null, extraRoots: [] }).found, path.join(sibling, 'SKILL.md'));
  const userSkill = addSkill(home, 'ego-ops');
  assert.equal(findSkill('ego-ops', { cwd: nested, home, codexHome: null, extraRoots: [] }).found, userSkill);
  const elsewhere = path.join(home, 'other-project'); fs.mkdirSync(elsewhere, { recursive: true });
  assert.equal(findSkill('ego-ops', { cwd: elsewhere, home, skillRoot: path.join(root, 'installed/game-account-select'), codexHome: null, extraRoots: [] }).found, path.join(sibling, 'SKILL.md'));
  const custom = path.join(root, 'custom-codex', 'skills', 'ego-ops');
  fs.mkdirSync(custom, { recursive: true }); fs.writeFileSync(path.join(custom, 'SKILL.md'), '# ego-ops\n');
  assert.equal(findSkill('ego-ops', { cwd: nested, home, codexHome: path.join(root, 'custom-codex'), extraRoots: [] }).found, path.join(custom, 'SKILL.md'));
  assert.equal(findSkill('ego-ops', { cwd: nested, home: null, codexHome: null, extraRoots: [path.join(root, 'custom-codex/skills')] }).found, path.join(custom, 'SKILL.md'));
  assert.equal(findSkill('ego-browser', { cwd: nested, home, codexHome: null, extraRoots: [] }).ok, false);
});

test('preflight discovers project skills and rejects a missing browser executable', { skip: process.platform === 'win32' }, (t) => {
  const root = fixture(t);
  const project = path.join(root, 'project');
  const installed = path.join(project, '.agents/skills/game-account-select');
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.cpSync(source, installed, { recursive: true });
  const ops = addSkill(project, 'ego-ops');
  const browserSkill = addSkill(project, 'ego-browser');
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const run = (cwd = project, browser = true) => {
    const result = spawnSync(process.execPath, [path.join(installed, 'scripts/preflight.mjs'), ...(browser ? ['--browser'] : []), '--json'], {
      cwd, env: { ...process.env, PATH: bin }, encoding: 'utf8',
    });
    return { status: result.status, report: JSON.parse(result.stdout) };
  };
  let result = run();
  assert.equal(result.status, 1);
  assert.ok(result.report.missing_required.includes('ego-browser route'));
  assert.equal(fs.realpathSync(result.report.checks.find((item) => item.name === 'ego-ops skill').found), fs.realpathSync(ops));
  assert.equal(fs.realpathSync(result.report.checks.find((item) => item.name === 'ego-browser skill').found), fs.realpathSync(browserSkill));
  assert.equal(fs.realpathSync(run(root).report.checks.find((item) => item.name === 'ego-ops skill').found), fs.realpathSync(ops));
  assert.equal(run(project, false).status, 0, 'offline use does not require browser, git or gh');
  fs.writeFileSync(path.join(bin, 'ego-browser'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  result = run();
  assert.equal(result.status, 0);
  assert.equal(result.report.ok, true);
  assert.deepEqual(result.report.missing_required, []);
  assert.equal(result.report.browser_route.status, 'runtime_unverified');
  assert.equal(result.report.browser_route.unattended_safe, null);
  assert.equal(result.report.browser_route.requires_user_presence_now, null);
  assert.equal(result.report.browser_route.authorization_may_recur, true);
  assert.ok(result.report.missing_optional.includes('git'));
  assert.ok(result.report.missing_optional.includes('gh'));
});

test('a copied skill validates itself from another working directory and detects broken data', (t) => {
  const root = fixture(t);
  const installed = path.join(root, 'installed/game-account-select');
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.cpSync(source, installed, { recursive: true });
  const verify = () => spawnSync(process.execPath, [path.join(installed, 'scripts/verify.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(verify().status, 0);
  const index = path.join(installed, 'references/sites/pxb7/index.md');
  const original = fs.readFileSync(index, 'utf8');
  fs.writeFileSync(index, original.replace('(operations/arknights-list.md)', '(operations/missing.md)'));
  const brokenLink = verify();
  assert.equal(brokenLink.status, 1);
  assert.match(brokenLink.stderr, /broken link/);
  fs.writeFileSync(index, original);
  fs.writeFileSync(path.join(installed, 'references/operations.json'), '{invalid');
  const broken = verify();
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /operations\.json: cannot read JSON/);
});

test('preflight finds sibling dependencies through a symlink outside the project', { skip: process.platform === 'win32' }, (t) => {
  const root = fixture(t);
  const project = path.join(root, 'project');
  const skills = path.join(project, '.agents/skills');
  fs.mkdirSync(skills, { recursive: true });
  fs.symlinkSync(source, path.join(skills, 'game-account-select'), 'dir');
  const ops = addSkill(project, 'ego-ops');
  addSkill(project, 'ego-browser');
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'ego-browser'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const preflight = spawnSync(process.execPath, [path.join(skills, 'game-account-select/scripts/preflight.mjs'), '--browser', '--json'], {
    cwd: root, env: { ...process.env, PATH: bin, GAME_ACCOUNT_EXTRA_SKILL_DIRS: '' }, encoding: 'utf8',
  });
  const report = JSON.parse(preflight.stdout);
  assert.equal(preflight.status, 0);
  assert.equal(fs.realpathSync(report.checks.find((item) => item.name === 'ego-ops skill').found), fs.realpathSync(ops));
});

test('profile, freshness and shortlist run through a symlinked installation', { skip: process.platform === 'win32' }, (t) => {
  const root = fixture(t);
  const alias = path.join(root, 'skill-link');
  fs.symlinkSync(source, alias, 'dir');
  const run = (script, args) => spawnSync(process.execPath, [path.join(alias, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(run('verify.mjs', []).status, 0);
  const profile = run('profile.mjs', ['--request', '明日方舟预算800元，优先限定干员']);
  assert.equal(profile.status, 0);
  assert.ok(JSON.parse(profile.stdout).budget);
  const freshness = run('freshness.mjs', ['--game', 'arknights']);
  assert.ok([0, 3].includes(freshness.status));
  assert.ok(JSON.parse(freshness.stdout).status);
  const profileFile = path.join(root, 'profile.json');
  const listingFile = path.join(root, 'listing.json');
  fs.writeFileSync(profileFile, profile.stdout);
  fs.writeFileSync(listingFile, JSON.stringify([{ listingId: 'fixture', url: 'https://www.pxb7.com/product/fixture/1', priceCny: 700, operatorNames: ['维什戴尔'] }]));
  const shortlist = run('shortlist.mjs', ['--game', 'arknights', '--profile', profileFile, '--listings', listingFile]);
  assert.equal(shortlist.status, 0);
  assert.equal(JSON.parse(shortlist.stdout).counts.unique, 1);
});
