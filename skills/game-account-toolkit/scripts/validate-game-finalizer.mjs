#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex');

function runFinalizer(finalizerPath, inputPath, reportPath) {
  return spawnSync(process.execPath, [finalizerPath, '--input', inputPath, '--report-out', reportPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 1024 * 1024 * 32,
  });
}

function assertRejected({ temporaryRoot, finalizerPath, name, artifact }) {
  const artifactPath = path.join(temporaryRoot, `${name}.json`);
  const reportPath = path.join(temporaryRoot, `${name}.md`);
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const result = runFinalizer(finalizerPath, artifactPath, reportPath);
  assert.equal(result.status, 1, `${name} must fail closed\n${result.stderr || result.stdout}`);
  assert.equal(fs.existsSync(reportPath), false, `${name} must not render a delivery report`);
}

export function validateGameFinalizer({ finalizerPath, fixturePath, expectedTargetSkill }) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-finalizer-validation-'));
  try {
    const source = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const firstArtifactPath = path.join(temporaryRoot, 'first.json');
    const firstReportPath = path.join(temporaryRoot, 'first.md');
    fs.writeFileSync(firstArtifactPath, `${JSON.stringify(source, null, 2)}\n`);
    const first = runFinalizer(finalizerPath, firstArtifactPath, firstReportPath);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstArtifact = JSON.parse(fs.readFileSync(firstArtifactPath, 'utf8'));
    assert.equal(firstArtifact.target_skill, expectedTargetSkill);
    assert.equal(firstArtifact.quality_gate.redo_required, false);
    assert.equal(firstArtifact.self_improve.status, 'complete');
    assert.equal(firstArtifact.delivery_contract.mode, 'verbatim_required');
    assert.equal(firstArtifact.delivery_contract.final_response_sha256, sha256(firstArtifact.final_response));
    assert.equal(firstArtifact.request_provenance.raw_user_request, source.user_request);
    assert.equal(firstArtifact.request_provenance.raw_user_request_sha256, sha256(source.user_request));
    assert.equal(firstArtifact.request_provenance.profile_input, source.request_provenance.profile_input);
    assert.equal(firstArtifact.request_provenance.profile_input_sha256, sha256(source.request_provenance.profile_input));
    assert.equal(fs.readFileSync(firstReportPath, 'utf8'), firstArtifact.final_response);
    assert.ok(fs.existsSync(firstArtifact.self_improve.optimizer.report_path));
    assert.ok(fs.existsSync(firstArtifact.self_improve.evaluator.report_path));

    const secondArtifactPath = path.join(temporaryRoot, 'second.json');
    const secondReportPath = path.join(temporaryRoot, 'second.md');
    fs.writeFileSync(secondArtifactPath, `${JSON.stringify(source, null, 2)}\n`);
    const second = runFinalizer(finalizerPath, secondArtifactPath, secondReportPath);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(fs.readFileSync(firstReportPath, 'utf8'), fs.readFileSync(secondReportPath, 'utf8'), 'report body must be deterministic');

    const blockedArtifactPath = path.join(temporaryRoot, 'blocked.json');
    const blockedReportPath = path.join(temporaryRoot, 'blocked.md');
    fs.writeFileSync(blockedArtifactPath, `${JSON.stringify({ ...source, errors: ['fixture execution failure'] }, null, 2)}\n`);
    const blocked = runFinalizer(finalizerPath, blockedArtifactPath, blockedReportPath);
    assert.equal(blocked.status, 1, 'blocking optimizer findings must fail the finalizer');
    const blockedArtifact = JSON.parse(fs.readFileSync(blockedArtifactPath, 'utf8'));
    assert.equal(blockedArtifact.quality_gate.redo_required, true);
    assert.equal(blockedArtifact.self_improve.status, 'needs_revision');
    assert.ok(blockedArtifact.quality_gate.actionable_optimizer_findings.length > 0);

    assertRejected({
      temporaryRoot,
      finalizerPath,
      name: 'wrong-target-skill',
      artifact: { ...source, target_skill: 'skills/game-account-arknights' },
    });
    const mismatchedRaw = 'different historical request';
    assertRejected({
      temporaryRoot,
      finalizerPath,
      name: 'mismatched-provenance',
      artifact: {
        ...source,
        request_provenance: {
          ...source.request_provenance,
          raw_user_request: mismatchedRaw,
          raw_user_request_sha256: sha256(mismatchedRaw),
        },
      },
    });
    assertRejected({
      temporaryRoot,
      finalizerPath,
      name: 'missing-provenance',
      artifact: { ...source, request_provenance: undefined },
    });
    assertRejected({
      temporaryRoot,
      finalizerPath,
      name: 'empty-request',
      artifact: {
        ...source,
        user_request: '',
        request_provenance: {
          ...source.request_provenance,
          raw_user_request: '',
          raw_user_request_sha256: sha256(''),
        },
      },
    });

    const conflictPath = path.join(temporaryRoot, 'path-conflict.json');
    const conflictBody = `${JSON.stringify(source, null, 2)}\n`;
    fs.writeFileSync(conflictPath, conflictBody);
    const conflict = runFinalizer(finalizerPath, conflictPath, conflictPath);
    assert.equal(conflict.status, 1, 'artifact and sidecar paths must be distinct');
    assert.equal(fs.readFileSync(conflictPath, 'utf8'), conflictBody, 'path conflict rejection must occur before mutating the artifact');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
