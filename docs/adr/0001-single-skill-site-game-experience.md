# ADR-0001: One skill, experience keyed by site and game

Status: accepted (2026-11-09). Replaces the earlier eleven-skill layout; its ADRs, plans and product docs were removed and remain in git history before this change.

## Context

The repo had eleven skills: a selector, a toolkit, preflight, one skill per game (with its own weighting engine, finalizer and hash-bound delivery contract), plus generator, evaluator, optimizer and community-updater meta skills. Every new game needed a new skill, and the meta loop (analyze-run, learning receipts) cost more than the screening it protected.

## Decision

- Ship a single skill, `game-account-select`, focused on screening accounts.
- Durable experience lives under `references/sites/<site>/` (site facts and per-game list/detail operations) and `references/games/<game>/` (assets, traps, risk, `game.json`, evidence). Adding a game or site adds data, not code or a skill.
- Replace per-game scoring engines and finalizers with one data-driven `scripts/shortlist.mjs`. Drop the report hash delivery contract.
- Fold preflight into a script; turn community-updater into `games/<game>/operations/refresh-evidence.md`; replace analyze-run and learning receipts with the OPS writeback protocol (`references/ops-model.md`). Delete generator and evaluator.
- Check data freshness before screening (`scripts/freshness.mjs`). Stale evidence triggers `refresh-evidence` first; if the refresh fails, the attempt is logged and recommendation confidence is capped at medium.
- Keep the ego-ops / ego-browser query runner, parsers, cleanup and the documented-status fail-closed gate.

## Consequences

- Rankings are a screening aid; the agent still reads details before recommending.
- Game-specific nuance (e.g. Arknights limited rosters, ZZZ signature engines) is data in `games/<game>/data/`, used by the shortlist and by the agent.
- Screening never silently runs on stale strength data: the report states the snapshot date and the confidence cap.
