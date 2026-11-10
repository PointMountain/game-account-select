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
  egoBrowser,
}) {
  if (!needsBrowser) {
    return {
      browserAccessOk: true,
      egoBrowser: skipped('browser_not_requested'),
      route: {
        requested: false,
        mode: unattended ? 'unattended' : 'interactive',
        status: 'not_required',
        selected_transport: null,
        query_governance: 'not_required',
        runtime_validation: 'not_required',
        task_space_required: false,
        cleanup_policy: 'none',
        control_handoff_policy: 'none',
        unattended_safe: true,
        requires_user_presence_now: false,
        authorization_may_recur: false,
      },
    };
  }

  return {
    browserAccessOk: Boolean(egoBrowser?.ok),
    egoBrowser: egoBrowser ?? { ok: false, found: null },
    route: {
      requested: true,
      mode: unattended ? 'unattended' : 'interactive',
      status: egoBrowser?.ok ? 'runtime_unverified' : 'missing_executable',
      selected_transport: 'ego_browser',
      query_governance: 'ego_ops',
      operation_knowledge: 'progressive_read',
      knowledge_writeback: 'success_only',
      runtime_validation: 'first_browser_operation',
      task_space_required: true,
      cleanup_policy: 'complete_task_space',
      control_handoff_policy: 'pause_until_explicit_user_confirmation',
      unattended_safe: null,
      requires_user_presence_now: null,
      authorization_may_recur: true,
    },
  };
}
