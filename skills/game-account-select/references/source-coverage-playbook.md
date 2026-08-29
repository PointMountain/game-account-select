# Source coverage playbook

This playbook turns a user request into an explicit coverage plan before platform access starts. The point is to avoid the old failure mode where the selector finds one plausible account, then relies on the user to notice missing sources or stale game knowledge.

## Build the coverage plan first

Create `coverage_plan` during `BUILD_QUERY`:

```yaml
coverage_plan:
  intent_summary: string
  source_tasks:
    - id: platform-pxb7-list
      type: platform_listing|platform_detail|community_evidence|user_input
      source: pxb7
      priority: required|preferred|supplemental
      start_path: ego_ops_verified_operation|user_material|maintainer_exploration
      success_signal: string
      fallback_order: string[]
      wait_budget_ms: number
      required_fields: string[]
      confidence_cap_if_missing: high|medium|low
  completeness_gates:
    platforms_required: string[]
    detail_required_for_top_n: number
    community_sources_required: string[]
    url_required_for_all_tiers: true
  stop_rules:
    - string
```

The plan is not a promise that every source will work. It is a checklist that makes failures visible and reviewable.

## Platform coverage defaults

When the user does not specify platforms:

- Required default coverage comes from `game-account-toolkit/references/platform-priority.json`.
- `pxb7` and `pzds` must be attempted, read successfully, or explicitly downgraded with evidence.
- Mentioning one platform as a starting point does not remove the other required default platform. Only an explicit diagnostic/audit override may narrow `--platforms`, and that run must not be presented as a completed cross-platform selection.
- `jiaoyimao` and `taoshouyou` are preferred expansion sources when the required platforms are thin or blocked.
- `xianyu` is supplemental. Login walls, recommendation feeds, empty cards, or verification should trigger quick downgrade.

Do not count a platform as covered when:

- Only a wrong-game route was opened.
- A list page loaded but no listing fields were read.
- A detail operation exists but list discovery was never attempted and the user expected active discovery.
- A detail page was inferred from title text without URL or source identifier.

For proactive Arknights discovery, the user-visible result must contain separate `platform_shortlists.pxb7` and `platform_shortlists.pzds` sections. A cross-platform `best_value_listing` may come from either platform. If one platform has no detail-verified qualifying account, preserve that platform section with clearly labeled near matches/list-only candidates plus a coverage gap; never omit the section or fabricate a qualifying row.

## Listing discovery path

Use this order unless user input gives a better starting point:

1. User links, screenshots, or pasted listings.
2. Ego-ops verified operation for known list/detail pages.
3. Shortlist detail confirmation only when the matching detail capability is also verified.
4. Visual verification for one failed semantic/DOM path inside that same verified operation.
5. User material fallback when the capability is unsupported, stale, blocked, or fields are hidden.

`maintainer_exploration` is not a selector fallback. It requires an explicit `--allow-exploration` maintenance run and cannot supply a real recommendation until the operation knowledge, manifest, support matrix, offline regressions, and live smoke are all promoted together.

For PXB/PZDS, prefer one list session plus detail operations for a shortlist over opening many detail pages.

## Community coverage defaults

When ranking depends on current meta, teams, dupes, signature equipment, skins, or purchase-risk consensus:

- Use the local game `community-evidence.md` only if it is fresh enough and covers the observed assets.
- Real purchase filtering defaults to a 7-day evidence window.
- For global-synchronized games, include YouTube as an independent long-form source or record it as failed/not checked.
- If only titles, cards, metadata, or a single short post are available, cap `community_confidence` at `medium`; if no reviewable links exist, cap it at `low`.

Minimum source shape for rule-level confidence:

```yaml
community_minimums:
  high:
    - official or version-fact source
    - two independent long-form/community sources with compatible conclusions
  medium:
    - one long-form source plus one partial source
    - or several partial sources with explicit limitations
  low:
    - title/card/metadata only
    - user-provided claim without independent confirmation
```

## Coverage gap handling

Each incomplete source task becomes a `coverage_gap`:

```yaml
coverage_gap:
  source: string
  task_id: string
  reason: timeout|empty_result|blocked|login_required|verification|wrong_game|operation_missing|operation_drift|field_missing|not_checked
  evidence: string
  fallback_used: string | null
  confidence_effect: string
  user_visible_note: string
```

Use gaps to decide whether to:

- Loop back to `COLLECT_LISTINGS`.
- Loop back to `COLLECT_COMMUNITY_EVIDENCE`.
- Lower confidence and continue.
- Ask the user for links, screenshots, or pasted text.
- Propose success-only ego-ops operation writeback or rule updates after the run.

## Ranking safeguards

Do not promote a candidate to the primary tier when:

- It lacks a source URL or traceable source id.
- Its hard conditions were not verified at detail level.
- It satisfies budget but fails hard conditions.
- It relies on unverified title-only signature weapon, dupe, or team claims.
- Platform or community coverage gaps would likely change the ranking.

Budget-flex candidates belong in a separate tier even if they are higher quality.
