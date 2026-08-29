function skipped(reason) {
  return {
    ok: false,
    skipped: true,
    reason,
    found: null,
  };
}

export function resolveBrowserRoute({
  needsBrowser,
  unattended,
  checkChromeUse,
  checkWebAccessSkill,
  checkChromePort,
}) {
  if (!needsBrowser) {
    return {
      browserAccessOk: true,
      chromeUse: skipped('browser_not_requested'),
      webAccess: skipped('browser_not_requested'),
      chromePort: skipped('browser_not_requested'),
      route: {
        requested: false,
        mode: unattended ? 'unattended' : 'interactive',
        status: 'not_required',
        selected_transport: null,
        fallback_probe: 'skipped_browser_not_requested',
        unattended_safe: true,
        requires_user_presence_now: false,
        authorization_may_recur: false,
      },
    };
  }

  const chromeUse = checkChromeUse();
  if (chromeUse.ok) {
    return {
      browserAccessOk: true,
      chromeUse,
      webAccess: skipped('chrome_use_primary_ready'),
      chromePort: skipped('chrome_use_primary_ready'),
      route: {
        requested: true,
        mode: unattended ? 'unattended' : 'interactive',
        status: 'ready',
        selected_transport: 'chrome_use_extension',
        fallback_probe: 'skipped_primary_ready',
        unattended_safe: true,
        requires_user_presence_now: false,
        authorization_may_recur: false,
      },
    };
  }

  if (unattended) {
    return {
      browserAccessOk: false,
      chromeUse,
      webAccess: skipped('interactive_cdp_disabled_in_unattended_mode'),
      chromePort: skipped('interactive_cdp_disabled_in_unattended_mode'),
      route: {
        requested: true,
        mode: 'unattended',
        status: 'needs_user_action',
        selected_transport: null,
        fallback_probe: 'skipped_unattended',
        unattended_safe: false,
        requires_user_presence_now: true,
        authorization_may_recur: false,
      },
    };
  }

  const webAccess = checkWebAccessSkill();
  const chromePort = checkChromePort();
  const fallbackReady = webAccess.ok && chromePort.ok;

  return {
    browserAccessOk: fallbackReady,
    chromeUse,
    webAccess,
    chromePort,
    route: {
      requested: true,
      mode: 'interactive',
      status: fallbackReady ? 'ready' : 'needs_user_action',
      selected_transport: fallbackReady ? 'web_access_cdp' : null,
      fallback_probe: 'completed_after_primary_unavailable',
      unattended_safe: false,
      requires_user_presence_now: !fallbackReady,
      authorization_may_recur: true,
    },
  };
}
