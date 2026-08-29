#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveBrowserRoute } from './browser-routing.mjs';

function failingProbe(name) {
  return () => {
    throw new Error(`${name} must not be probed on this route`);
  };
}

const chromeUseReady = resolveBrowserRoute({
  needsBrowser: true,
  unattended: false,
  checkChromeUse: () => ({ ok: true, found: 'chrome-use 1.5.68' }),
  checkWebAccessSkill: failingProbe('web-access'),
  checkChromePort: failingProbe('Chrome remote debugging'),
});
assert.equal(chromeUseReady.route.selected_transport, 'chrome_use_extension');
assert.equal(chromeUseReady.route.fallback_probe, 'skipped_primary_ready');
assert.equal(chromeUseReady.route.unattended_safe, true);
assert.equal(chromeUseReady.webAccess.skipped, true);
assert.equal(chromeUseReady.chromePort.skipped, true);

const unattendedWithoutRelay = resolveBrowserRoute({
  needsBrowser: true,
  unattended: true,
  checkChromeUse: () => ({ ok: false, found: null }),
  checkWebAccessSkill: failingProbe('web-access'),
  checkChromePort: failingProbe('Chrome remote debugging'),
});
assert.equal(unattendedWithoutRelay.browserAccessOk, false);
assert.equal(unattendedWithoutRelay.route.selected_transport, null);
assert.equal(unattendedWithoutRelay.route.fallback_probe, 'skipped_unattended');
assert.equal(unattendedWithoutRelay.route.requires_user_presence_now, true);

let webAccessProbeCount = 0;
let chromePortProbeCount = 0;
const interactiveFallback = resolveBrowserRoute({
  needsBrowser: true,
  unattended: false,
  checkChromeUse: () => ({ ok: false, found: null }),
  checkWebAccessSkill: () => {
    webAccessProbeCount += 1;
    return { ok: true, found: '/tmp/web-access/SKILL.md' };
  },
  checkChromePort: () => {
    chromePortProbeCount += 1;
    return { ok: true, found: 'localhost:9222' };
  },
});
assert.equal(interactiveFallback.route.selected_transport, 'web_access_cdp');
assert.equal(interactiveFallback.route.unattended_safe, false);
assert.equal(interactiveFallback.route.authorization_may_recur, true);
assert.equal(webAccessProbeCount, 1);
assert.equal(chromePortProbeCount, 1);

const browserNotRequested = resolveBrowserRoute({
  needsBrowser: false,
  unattended: false,
  checkChromeUse: failingProbe('chrome-use'),
  checkWebAccessSkill: failingProbe('web-access'),
  checkChromePort: failingProbe('Chrome remote debugging'),
});
assert.equal(browserNotRequested.route.status, 'not_required');
assert.equal(browserNotRequested.route.fallback_probe, 'skipped_browser_not_requested');

console.log('game-account-preflight browser routing validation passed');
