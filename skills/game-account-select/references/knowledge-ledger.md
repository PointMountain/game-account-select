# Knowledge ledger

The selector should leave behind durable learning without silently rewriting business rules. Every real run can produce `knowledge_update_candidates`; applying those candidates requires the normal confirmation, changelog, validation, and evaluator gates.

## Candidate schema

```yaml
knowledge_update_candidate:
  id: string
  type: platform_pattern|community_evidence|valuation_rule|risk_rule|adapter_gap|optimizer_fixture|evaluator_gate|output_format
  confidence: low|medium|high
  evidence:
    - string
  observed_in:
    run_id: string
    listing_ids: string[]
    platform_attempt_ids: string[]
    community_attempt_ids: string[]
  suggested_targets:
    - path
  requires_user_confirmation: boolean
  validation_commands:
    - string
  apply_status: proposed|applied|verified_existing|deferred|rejected
  source_scope: platform_fact|community_evidence|stable_game_fact|selection_profile
  preference_scope: durable|run_only
```

`verified_existing` means the run re-observed and validated a mechanism that was already present before the run. Count it as resolved evidence, but never as a newly applied self-improvement. Only `applied` means this run changed a durable target and passed its validation commands.

## Where knowledge belongs

| Observation | Target | Notes |
| --- | --- | --- |
| Platform URL shape, wrong route, blocked state, useful adapter command | `game-account-toolkit/references/platform-access-policy.md` or adapter notes | Only record verified facts, with dates when useful |
| Repeated missing list/detail adapter | `game-account-skill-optimizer/references/optimization-knowledge.md` and possibly OpenCLI adapter workflow | Do not implement adapter unless explicitly requested and verified |
| Current meta, team consensus, dupe/signature value | Target game `references/community-evidence.md` first | Rule changes need confirmation and fixtures |
| Stable scoring rule or trap | Target game `references/valuation-rules.md` plus domain knowledge and changelog | Add positive and negative validation cases |
| User-visible wording problem | `game-account-select/SKILL.md` or `selection-state-machine.md` | Usually autopatch-safe |
| Missing run artifact field | `shared-listing-schema.md`, `selection-state-machine.md`, optimizer taxonomy | Usually autopatch-safe |
| Optimizer missed a problem | Optimizer fixture plus `analyze-run.mjs` logic | Must prove the finding id appears |
| Evaluator let bad output pass | Evaluator rubric/script plus fixture | Treat as a gate bug |

## What not to sediment

Do not write these as durable rules:

- A single seller title with no detail confirmation.
- A single community title, card, or short comment.
- A blocked platform path that might be local browser state unless reproduced or health-checked.
- A user preference that applies only to the current purchase unless the user asks to make it a general rule.
- Any current-run budget, normalized weight, server preference, risk tolerance, platform choice, or user hard condition. These remain forbidden even when the user asks to improve the skill; only the general parsing behavior may be improved.
- Any source that required bypassing login, verification, WAF, or paid access.

Candidates with `source_scope: selection_profile` or `preference_scope: run_only` may be kept only as run diagnostics. Their `suggested_targets` must not point to durable skill/reference files and `apply_status` must never be `applied`. Violations are a blocking `selector-session-preference-leak`.

## Rule update path

1. Convert observations into `knowledge_update_candidates`.
2. Let `game-account-skill-optimizer` classify the issue and target files.
3. Ask for confirmation unless the user has already explicitly asked to apply this optimization.
4. Patch the smallest responsible layer.
5. Add or update fixtures that would fail under the old behavior.
6. Run target validation scripts and `game-account-skill-evaluator`.
7. Record the change in the target changelog.

## Run artifact linkage

The raw run artifact should keep:

- `coverage_plan`
- `coverage_gaps`
- `knowledge_update_candidates`
- `optimizer_report_path` when persisted
- `evaluator_report`
- `applied_updates` or `deferred_updates`

If a run is not persisted, keep the artifact under `/tmp/game-account-select-runs/` and include enough final-summary detail for the user to understand remaining gaps.
