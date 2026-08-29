#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveBrowserRoute } from './browser-routing.mjs';

const interactive = resolveBrowserRoute({
  needsBrowser: true,
  unattended: false,
});
assert.equal(interactive.browserAccessOk, true);
assert.equal(interactive.route.selected_transport, 'ego_browser');
assert.equal(interactive.route.query_governance, 'ego_ops');
assert.equal(interactive.route.operation_knowledge, 'progressive_read');
assert.equal(interactive.route.knowledge_writeback, 'success_only');
assert.equal(interactive.route.runtime_validation, 'first_browser_operation');
assert.equal(interactive.route.task_space_required, true);
assert.equal(interactive.route.cleanup_policy, 'complete_task_space');
assert.equal(interactive.route.control_handoff_policy, 'pause_until_explicit_user_confirmation');
assert.equal(interactive.route.unattended_safe, true);
assert.equal(interactive.egoBrowser.assumed_ready, true);

const unattended = resolveBrowserRoute({
  needsBrowser: true,
  unattended: true,
});
assert.equal(unattended.browserAccessOk, true);
assert.equal(unattended.route.mode, 'unattended');
assert.equal(unattended.route.selected_transport, 'ego_browser');
assert.equal(unattended.route.requires_user_presence_now, false);
assert.equal(unattended.route.authorization_may_recur, false);

const browserNotRequested = resolveBrowserRoute({
  needsBrowser: false,
  unattended: false,
});
assert.equal(browserNotRequested.route.status, 'not_required');
assert.equal(browserNotRequested.route.runtime_validation, 'not_required');
assert.equal(browserNotRequested.route.task_space_required, false);
assert.equal(browserNotRequested.route.query_governance, 'not_required');

console.log('game-account-preflight browser routing validation passed');
