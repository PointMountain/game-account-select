#!/usr/bin/env node
const checks = [];

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
checks.push({
  name: 'node',
  ok: nodeMajor >= 22,
  found: process.version,
  required: '>=22 recommended',
  action: nodeMajor >= 22 ? 'none' : 'Install Node.js 22+ or use degraded mode for non-CDP tasks.'
});

const result = {
  ok: checks.every((check) => check.ok),
  checks,
  optional: [
    {
      name: 'web-access skill',
      required_for: 'browser/CDP access to dynamic or logged-in pages',
      action: 'Load the web-access skill and run its check-deps script when browser access is needed.'
    },
    {
      name: 'OCR',
      required_for: 'screenshots where account assets are only visible in images',
      action: 'If unavailable, ask the user for copied text or manual transcription.'
    }
  ]
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
