#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-skill-generator-contract-'));

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    timeout: options.timeout ?? 180000,
    maxBuffer: 1024 * 1024 * 32,
  });
}

try {
  const temporarySkills = path.join(temporaryRoot, 'skills');
  fs.mkdirSync(temporarySkills, { recursive: true });
  for (const skill of ['game-account-toolkit', 'game-account-skill-optimizer', 'game-account-skill-evaluator']) {
    fs.cpSync(path.join(repoRoot, 'skills', skill), path.join(temporarySkills, skill), { recursive: true });
  }

  const specialGameName = 'NieR: Automata # "YoRHa"\nDragon\'s Awakening';
  const generation = run(process.execPath, [
    path.join(__dirname, 'generate-game-skill.mjs'),
    '--game', specialGameName,
    '--slug', 'test-frontier',
    '--out', temporaryRoot,
  ]);
  assert.equal(generation.status, 0, generation.stderr || generation.stdout || 'generator failed');
  assert.match(generation.stdout, /<validation_ok>true<\/validation_ok>/);
  assert.match(generation.stdout, /<quality_gate_ok>true<\/quality_gate_ok>/);
  assert.match(generation.stdout, /<finalizer_validation_ok>true<\/finalizer_validation_ok>/);

  const generatedRoot = path.join(temporarySkills, 'game-account-test-frontier');
  const requiredFiles = [
    'SKILL.md',
    'scripts/evaluate-listing.mjs',
    'scripts/finalize-evaluation-run.mjs',
    'scripts/validate-finalizer.mjs',
    'scripts/validate-sample.mjs',
    'test-fixtures/test-frontier-validation-sample.json',
    'test-fixtures/test-frontier-run-artifact.json',
  ];
  for (const relative of requiredFiles) assert.ok(fs.existsSync(path.join(generatedRoot, relative)), `missing generated ${relative}`);
  for (const file of requiredFiles) assert.doesNotMatch(fs.readFileSync(path.join(generatedRoot, file), 'utf8'), /\{\{[^}]+\}\}/, `${file} retained a template token`);
  const generatedArtifactFixture = JSON.parse(fs.readFileSync(path.join(generatedRoot, 'test-fixtures', 'test-frontier-run-artifact.json'), 'utf8'));
  assert.equal(generatedArtifactFixture.game, specialGameName, 'JSON rendering must preserve quotes, apostrophes, and newlines in the game name');
  const skillText = fs.readFileSync(path.join(generatedRoot, 'SKILL.md'), 'utf8');
  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const descriptionScalar = frontmatter.match(/^description:\s*(.+)$/m)?.[1];
  assert.ok(descriptionScalar?.startsWith('"'), 'generated description must use a quoted YAML scalar');
  assert.equal(
    JSON.parse(descriptionScalar),
    `${specialGameName} 账号估值和筛选规则，关注命名核心资产、资源、进度和账号安全风险。`,
    'the JSON-compatible YAML scalar must preserve colon, hash, quotes, apostrophe, and newline characters',
  );
  assert.doesNotThrow(
    () => new Function(fs.readFileSync(path.join(generatedRoot, 'scripts', 'finalize-evaluation-run.mjs'), 'utf8').replace(/^#!.*\n/, '').replace(/^import .*\n/m, '')),
    'generated JavaScript must escape the game name for its string literal context',
  );

  const sample = JSON.parse(fs.readFileSync(path.join(generatedRoot, 'test-fixtures', 'test-frontier-validation-sample.json'), 'utf8'));
  const batchInput = sample.listings.map((listing, index) => ({
    ...listing,
    platform: 'user_provided',
    url: `https://example.invalid/test-frontier-${index + 1}`,
    price: 500 + index * 100,
  }));
  const batchInputPath = path.join(temporaryRoot, 'batch-input.json');
  fs.writeFileSync(batchInputPath, `${JSON.stringify(batchInput, null, 2)}\n`);
  const evaluator = path.join(generatedRoot, 'scripts', 'evaluate-listing.mjs');
  const batchRun = run(process.execPath, [evaluator, '--input', batchInputPath], { cwd: temporaryRoot });
  assert.equal(batchRun.status, 0, batchRun.stderr || batchRun.stdout || 'generated batch evaluator failed');
  const batch = JSON.parse(batchRun.stdout);
  assert.equal(batch.evaluations.length, 2);
  for (const evaluation of batch.evaluations) {
    const score = evaluation.test_frontier_score;
    assert.equal(evaluation.schema_version, '3.0');
    assert.ok(score.asset_quality_score > 0 || score.missing_data_penalty > 0);
    assert.ok(Number.isFinite(score.resource_score));
    assert.ok(Number.isFinite(score.risk_penalty));
    assert.ok(Array.isArray(score.missing_fields));
  }

  const singleInputPath = path.join(temporaryRoot, 'single-input.json');
  fs.writeFileSync(singleInputPath, `${JSON.stringify(batchInput[1], null, 2)}\n`);
  const singleRun = run(process.execPath, [evaluator, '--input', singleInputPath], { cwd: temporaryRoot });
  assert.equal(singleRun.status, 0, singleRun.stderr || singleRun.stdout || 'generated single evaluator failed');
  const single = JSON.parse(singleRun.stdout);
  assert.equal(single.listing.id, 'named-core-clean');
  assert.equal(single.schema_version, '3.0');

  const artifactSource = JSON.parse(fs.readFileSync(path.join(generatedRoot, 'test-fixtures', 'test-frontier-run-artifact.json'), 'utf8'));
  artifactSource.evaluations = batch.evaluations;
  const roundTripArtifact = path.join(temporaryRoot, 'round-trip.json');
  const roundTripReport = path.join(temporaryRoot, 'round-trip.md');
  fs.writeFileSync(roundTripArtifact, `${JSON.stringify(artifactSource, null, 2)}\n`);
  const finalizerRun = run(process.execPath, [
    path.join(generatedRoot, 'scripts', 'finalize-evaluation-run.mjs'),
    '--input', roundTripArtifact,
    '--report-out', roundTripReport,
  ], { cwd: temporaryRoot });
  assert.equal(finalizerRun.status, 0, finalizerRun.stderr || finalizerRun.stdout || 'generated evaluator-to-finalizer round trip failed');
  const finalized = JSON.parse(fs.readFileSync(roundTripArtifact, 'utf8'));
  assert.equal(finalized.schema_version, '3.0');
  assert.equal(finalized.quality_gate.redo_required, false);
  assert.equal(finalized.delivery_contract.mode, 'verbatim_required');
  assert.equal(fs.readFileSync(roundTripReport, 'utf8'), finalized.final_response);

  const forcedTarget = path.join(temporarySkills, 'game-account-forced-preserved');
  fs.mkdirSync(forcedTarget, { recursive: true });
  const forcedSentinel = path.join(forcedTarget, 'sentinel.txt');
  fs.writeFileSync(forcedSentinel, 'restore after failed validation');
  const copiedEvaluator = path.join(temporarySkills, 'game-account-skill-evaluator', 'scripts', 'evaluate-skill.mjs');
  const copiedEvaluatorBody = fs.readFileSync(copiedEvaluator, 'utf8');
  fs.writeFileSync(copiedEvaluator, '#!/usr/bin/env node\nconsole.log(JSON.stringify({ passed: false }));\nprocess.exit(1);\n');
  const failedForceRun = run(process.execPath, [
    path.join(__dirname, 'generate-game-skill.mjs'),
    '--game', 'Forced Validation Failure',
    '--slug', 'forced-preserved',
    '--out', temporaryRoot,
    '--force',
  ]);
  fs.writeFileSync(copiedEvaluator, copiedEvaluatorBody);
  assert.equal(failedForceRun.status, 1, 'failed validation must reject a forced replacement');
  assert.equal(fs.readFileSync(forcedSentinel, 'utf8'), 'restore after failed validation', '--force must restore the previous skill after validation fails');

  const missingDependencyRoot = path.join(temporaryRoot, 'missing-dependencies');
  const preservedTarget = path.join(missingDependencyRoot, 'skills', 'game-account-preserved');
  fs.mkdirSync(preservedTarget, { recursive: true });
  const sentinelPath = path.join(preservedTarget, 'sentinel.txt');
  fs.writeFileSync(sentinelPath, 'keep me');
  const missingDependencyRun = run(process.execPath, [
    path.join(__dirname, 'generate-game-skill.mjs'),
    '--game', "Broken's Game",
    '--slug', 'preserved',
    '--out', missingDependencyRoot,
    '--force',
  ]);
  assert.equal(missingDependencyRun.status, 1, 'generator must fail when the output root lacks its runtime skill dependencies');
  assert.match(missingDependencyRun.stderr, /missing required generated-skill dependencies/);
  assert.equal(fs.readFileSync(sentinelPath, 'utf8'), 'keep me', '--force must not delete an existing skill before preflight and validation pass');

  console.log('Generated game skill end-to-end contract validation passed');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
