---
title: README And Install Polish
status: completed
created: 2026-05-16
origin: user request
---

# README And Install Polish Plan

## Problem Frame

The repository now has a useful skill framework, but the README still reads like an internal file inventory. It also tells users to run preflight manually, even though preflight should be an automatic part of skill execution. The repo should present itself like a polished public GitHub skill pack: visual header, concise purpose, ordered install/use sections, skill catalog, and `npx skills add` installation guidance with optional per-skill installation.

## Scope Boundaries

In scope:

- Redesign `README.md` into a more standard public GitHub layout.
- Add a generated banner image under `assets/` and reference it at the top of the README.
- Remove manual "使用前检查" as a user-facing action; document that skills run preflight automatically.
- Add `npx skills add` installation examples for all skills and individual skills.
- Add package metadata so agent-skill CLIs can discover the `skills/` directory.
- Add a lightweight local script that lists installable skill names from frontmatter.
- Update docs/product if needed to keep installation and preflight behavior consistent.

Out of scope:

- Publishing to npm in this PR.
- Changing skill runtime behavior beyond documentation/install metadata.
- Adding a web app or hosted documentation site.

## Requirements Traceability

- User said README should not tell users to run preflight manually; preflight should run when the skill executes.
- User asked for a more polished README with an image at the top and ordered install/introduction sections.
- User asked to add an installation style like `Leonxlnx/taste-skill`, using `npx skills` and optional skill selection.

## Design Decisions

1. Use a static SVG banner committed to `assets/readme-banner.svg`.
   Rationale: it is small, deterministic, reviewable in git, and renders on GitHub without needing binary image generation.

2. Use `package.json` metadata without adding dependencies.
   Rationale: `npx skills add <repo>` expects a repo shape with `skills/`; package metadata improves repository ergonomics without requiring an npm publish step.

3. Add `scripts/list-skills.mjs`.
   Rationale: local validation can prove the install names in README match `SKILL.md` frontmatter.

4. Keep preflight automatic in skill docs and README.
   Rationale: users should install and invoke skills; dependency checks are part of the skill execution path.

## Implementation Units

### U1: README Visual And Structure

Files:

- Modify: `README.md`
- Create: `assets/readme-banner.svg`

Content:

- Top banner and concise description.
- Badges/links.
- Ordered sections: install, available skills, workflow, generated skills, validation, safety.
- Skill table with exact install names.
- Remove manual preflight commands from primary usage.

Tests:

- Markdown references existing asset paths.
- README contains `npx skills add`.

### U2: Install Metadata And Skill Listing

Files:

- Create: `package.json`
- Create: `scripts/list-skills.mjs`
- Optionally create: `skills/llms.txt`

Behavior:

- `npm run list:skills` prints install names and paths.
- Script parses `name:` from every `skills/*/SKILL.md`.
- README install names match script output.

Tests:

- `node scripts/list-skills.mjs`
- `npm run list:skills`

### U3: Preflight Documentation Consistency

Files:

- Modify: `README.md`
- Modify: `docs/product/game-account-selection-assistant.md`
- Check existing `SKILL.md` entries already mention `game-account-preflight`.

Behavior:

- README says preflight runs automatically during skill execution.
- Manual preflight commands remain in validation/developer section only, not as user install/use steps.

Tests:

- `rg "使用前检查|node skills/game-account-preflight" README.md` confirms no primary manual preflight section remains.

## Verification

- `node scripts/list-skills.mjs`
- `npm run list:skills`
- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- Existing four game validation scripts.
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- `git diff --check`

## Risks

- `npx skills` behavior may vary by agent-skill CLI version. Mitigation: document the common `npx skills add <repo> --skill "<name>"` pattern and make repo structure match the expected `skills/` layout.
- README can become too marketing-heavy. Mitigation: keep it practical and focused on install, available skills, workflow, validation, and safety.
