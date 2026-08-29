# Game account selection domain

This repository implements a verifiable workflow for finding, evaluating, comparing, and presenting game-account listings. It contains game-specific valuation skills and a shared execution stack.

## Canonical terms

### Game skill

A `game-account-<game>` skill owns durable valuation knowledge for one game: independent base dimensions, risk and missing-data penalties, community evidence, sample regressions, and a reusable listing evaluator. It must not persist a user's budget or preferences.

### Shared selection stack

The selector, toolkit, preflight, generator, evaluator, optimizer, and community updater form the shared selection stack. They own orchestration, browser routing, evidence capture, quality gates, and future-skill generation. They do not own game-specific rankings.

### Selection profile

The normalized, run-only interpretation of the current user's budget, priorities, hard conditions, server preferences, and risk tolerance. It may alter dynamic ranking, but it is never durable game knowledge.

### Verified operation

An `ego-ops` operation whose site scope, parameters, extraction boundary, and output schema have been observed and validated through `ego-browser`. A platform/game route is supported only while such an operation exists and passes the query-stack checks.

### Operation support matrix

The explicit list of game/platform/list-or-detail combinations backed by verified operations. Missing matrix entries are unsupported, not implicitly available and not permission to use another browser tool.

### Run artifact

The raw, auditable JSON record of one selection or evaluation run. It contains the selection profile, platform attempts, normalized evidence, provenance, coverage gaps, recommendations, knowledge candidates, and quality-gate state.

### Deterministic finalizer

A script that converts a run artifact into the user-facing report, optimizer/evaluator sidecars, self-improve closeout, quality gate, and delivery contract. Given equivalent business data, it must produce a stable report body and report hash; runtime timestamps remain metadata.

### Delivery contract

The machine-readable instruction that binds the generated report body, SHA-256 hash, rendered listing identifiers, and required sections. The final response must preserve this generated output instead of replacing it with an unverified handwritten shortlist.

### Quality gate

The combined optimizer and evaluator decision. Blocking provenance, coverage, scoring, or delivery failures set `redo_required`; only a passing gate is releasable.

## Invariants

- All live page access and data acquisition route through `ego-ops` operations executed by `ego-browser`.
- Legacy query stacks and unverified browser fallbacks are outside the active query path.
- A game may share the full evaluation and delivery contract without claiming unsupported platform operations.
- Unknown progression or equipment fields receive zero positive credit and remain visible as missing evidence.
- Stable game facts may be proposed for durable knowledge; run-only preferences and unverified valuation changes may not be persisted.
- Offline evaluator regressions, raw-artifact finalization, and operation/query-stack validation are separate public test seams.
