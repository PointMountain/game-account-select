---
title: Game Account Skill Framework
status: completed
created: 2026-05-16
origin: user request
---

# Game Account Skill Framework Plan

## Problem Frame

The repository has several game-specific account valuation skills, but adding or maintaining new games is still manual and inconsistent. The next improvement is to turn the project into a small skill framework: prepare the environment before execution, generate a new game skill from a game name and community evidence, evaluate generated skills against a quality gate, refresh community evidence so rules do not drift, and standardize input/output across existing skills.

## Scope Boundaries

In scope:

- Add a skill that prepares the local environment before other game-account skills run.
- Add a skill that generates a game-specific account-purchase skill from user-provided game input and validates the generated files.
- Add a skill that evaluates game-account skills against a repository standard.
- Add a skill that refreshes community evidence for an existing game skill.
- Add shared references/templates/scripts so the generated and existing skills follow one framework.
- Update existing selector/game skills to use standard tag-based input/output contracts.
- Add deterministic local validation scripts.

Out of scope:

- Building a hosted web service or UI.
- Fully automating Bilibili/Douyin/Xiaohongshu scraping beyond safe, documented lookup commands.
- Silently changing user-installed Codex skills outside this repository.
- Guaranteeing live game tier accuracy without a current evidence refresh.
- Automatic buying, seller contact, payment, login bypass, captcha bypass, or high-frequency platform access.

## Requirements Traceability

- User asked for a skill that creates game evaluation/buying skills from a game name and self-validates.
- User asked for an evaluation skill that judges generated skills against usage standards.
- User asked for automatic or execution-time community updates to avoid stale local rules.
- User asked to improve skill structure, inputs, outputs, tags, and data-processing documentation while taking inspiration from mainstream skill frameworks such as `gsd-build/get-shit-done`.
- User asked for a pre-execution preparation skill that checks dependencies such as `opencli` and `web-access`, auto-installs when safe, and guides manual installation otherwise.

## Design Decisions

1. Use shared framework documents instead of duplicating all standards in every skill.
   Rationale: a single contract keeps generated and hand-written skills aligned and makes quality checks deterministic.

2. Add generator/evaluator/updater/preflight as repository skills, not external tools.
   Rationale: users can invoke them with the same skill workflow as the game skills, and the project remains portable.

3. Keep scripts deterministic and offline-friendly.
   Rationale: validation should work in CI or local shells even when community sites are unavailable.

4. Treat community refresh as evidence collection plus confidence gating.
   Rationale: search platforms can fail or return partial results; the skill should record coverage and lower confidence rather than inventing rules.

5. Use XML-style tags for standard skill I/O.
   Rationale: tags are easy for agents to parse, easy for users to scan, and align with the user's request for structured input/output.

## Existing Patterns To Follow

- `skills/game-account-wuthering-waves/`
- `skills/game-account-arknights/`
- `skills/game-account-toolkit/references/community-research-protocol.md`
- `skills/game-account-toolkit/scripts/check-deps.mjs`
- `skills/game-account-select/references/selection-state-machine.md`

## Implementation Units

### U1: Shared Skill Framework

Files:

- Create: `skills/game-account-toolkit/references/skill-io-contract.md`
- Create: `skills/game-account-toolkit/references/game-skill-standard.md`
- Create: `skills/game-account-toolkit/templates/game-skill/`
- Modify: `README.md`
- Modify: `docs/product/game-account-selection-assistant.md`

Behavior:

- Define standard input tags such as `<game_account_request>`, `<user_preferences>`, `<account_listing>`, and `<community_refresh_request>`.
- Define standard output tags such as `<game_account_evaluation>`, `<recommendations>`, `<risk_register>`, `<missing_fields>`, `<community_evidence>`, `<skill_quality_report>`, and `<rule_update_suggestion>`.
- Define the minimum file layout for a valid game skill.

Tests:

- Framework documents exist and contain all required tags.
- Template files contain no unresolved placeholders after generator execution.

### U2: Preflight Skill

Files:

- Create: `skills/game-account-preflight/SKILL.md`
- Create: `skills/game-account-preflight/references/preflight-checklist.md`
- Create: `skills/game-account-preflight/scripts/preflight.mjs`
- Modify: `skills/game-account-toolkit/scripts/check-deps.mjs`
- Modify: `skills/game-account-select/SKILL.md`
- Modify: existing game `SKILL.md` files to call preflight first.

Behavior:

- Check Node, `gh`, `git`, `opencli`, and local `web-access` skill availability.
- Auto-install only safe local/project dependencies if introduced later; for global tools or Codex skills, output manual install guidance instead of silently mutating the machine.
- Emit machine-readable JSON and a human-readable summary.

Tests:

- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-toolkit/scripts/check-deps.mjs`

### U3: Game Skill Generator

Files:

- Create: `skills/game-account-skill-generator/SKILL.md`
- Create: `skills/game-account-skill-generator/references/generation-workflow.md`
- Create: `skills/game-account-skill-generator/scripts/generate-game-skill.mjs`
- Create: generator validation fixture under `skills/game-account-skill-generator/test-fixtures/`

Behavior:

- Accept a game name, aliases, optional known assets, and community evidence notes.
- Create a slugged `skills/game-account-<slug>/` folder with required files, references, validation script, and sample fixture.
- Produce conservative baseline rules that require named assets, resources, risk fields, and community evidence before high confidence.
- Run validation after generation and emit a generation report.

Tests:

- Generate a sample game skill in a temporary directory.
- Verify required files and no unresolved placeholders.
- Run the generated sample validation script.

### U4: Skill Evaluator

Files:

- Create: `skills/game-account-skill-evaluator/SKILL.md`
- Create: `skills/game-account-skill-evaluator/references/evaluation-rubric.md`
- Create: `skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs`
- Create: evaluator fixtures for passing/failing sample skills.

Behavior:

- Evaluate a game skill for required structure, input/output contract, evidence coverage, scoring rules, risk logic, changelog, and validation script.
- Emit `<skill_quality_report>` with score, pass/fail, blocking issues, warnings, and suggested fixes.
- Fail generated or existing skills below the standard threshold.

Tests:

- Evaluator passes current core game skills.
- Evaluator catches missing evidence, missing validation script, and missing risk rules in a fixture.

### U5: Community Evidence Updater

Files:

- Create: `skills/game-account-community-updater/SKILL.md`
- Create: `skills/game-account-community-updater/references/update-workflow.md`
- Create: `skills/game-account-community-updater/scripts/update-community-evidence.mjs`
- Create: `skills/game-account-community-updater/test-fixtures/`

Behavior:

- Provide a documented workflow for execution-time refresh using `opencli`, web search, and `web-access` when available.
- Provide a deterministic script that updates evidence metadata and creates a refresh report from supplied evidence JSON.
- Never fabricate source coverage; failed sources must be recorded as failed/limited and cap confidence.

Tests:

- Apply fixture evidence to a temporary copy of a skill.
- Verify updated `community-evidence.md` and refresh report.

### U6: Existing Skill Standardization

Files:

- Modify: `skills/game-account-select/SKILL.md`
- Modify: `skills/game-account-select/references/selection-state-machine.md`
- Modify: all existing game `SKILL.md` files.
- Modify: relevant valuation rules and README docs.

Behavior:

- Existing skills reference preflight, the shared I/O contract, evaluator, and community updater.
- Each skill emits standardized tag blocks while retaining the current human-readable summary.
- Selector can route unsupported games to the generator instead of stopping at a dead end.

Tests:

- Existing validation scripts still pass.
- Evaluator passes every supported game skill.
- Selector references the generator for unsupported games.

## Verification

- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-toolkit/scripts/check-deps.mjs`
- `node skills/game-account-skill-generator/scripts/generate-game-skill.mjs --game "Test Frontier" --out /tmp/game-account-generator-test`
- `node /tmp/game-account-generator-test/skills/game-account-test-frontier/scripts/validate-sample.mjs`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-zenless-zone-zero --json`
- `node skills/game-account-community-updater/scripts/update-community-evidence.mjs --skill skills/game-account-zenless-zone-zero --evidence skills/game-account-community-updater/test-fixtures/evidence-sample.json --out /tmp/community-refresh-test`
- Existing four game validation scripts.
- `git diff --check`

## Risks

- Live community sources can fail or rate-limit. Mitigation: deterministic scripts accept supplied evidence and skill docs require failed-source reporting.
- Generator-created skills may look complete but lack real game knowledge. Mitigation: generated skills start conservative and must pass evaluator gates before use.
- Auto-install behavior can surprise users. Mitigation: preflight only gives guidance for global tools and external skills unless a future repo-local dependency exists.
