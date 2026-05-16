---
title: README Install Profiles And Dependency Guidance
status: completed
created: 2026-05-16
origin: user request
---

# README Install Profiles And Dependency Guidance Plan

## Problem Frame

Users can install one skill from this repository with `npx skills add --skill`, but game-specific skills rely on shared local peers such as the toolkit, preflight, and sometimes the community updater. The README currently shows single-skill install examples without making that dependency shape obvious, which can leave users with a game skill that references helpers they did not install.

The user also asked whether this repository can make `npx skills` default-select companion skills. Current upstream `skills` CLI behavior supports explicit repeated `--skill`, `--skill '*'`, `-y` full installs, and `--all`; it does not expose a repository-controlled dependency/default-selection field for GitHub skill packs. This repo should therefore document the limitation clearly and provide the closest practical workaround: maintained install profiles and generated commands.

## Scope Boundaries

In scope:

- Add a machine-readable install profile manifest for full install, core helpers, game bundles, and authoring bundles.
- Update the local skill listing script to print install profiles and copyable `npx skills add` commands.
- Update Chinese and English READMEs with user-facing install profile guidance.
- Explain the current default-selection limitation in terms of what users can do, not internal implementation notes.
- Keep existing README visuals, language switch, skill catalog, philosophy, safety, and maintenance sections intact.

Out of scope:

- Modifying the upstream `skills` CLI.
- Adding runtime remote dependency fetching.
- Silently installing Codex skills or global tools during skill execution.
- Changing game valuation logic.
- Publishing an npm wrapper package.

## Requirements Traceability

- User asked to optimize the README around the previously discussed dependency issue.
- User asked whether `npx skills` can default-select related skills during installation.
- Prior discussion established the risk that installing only one game skill can miss companion skills.
- Existing skill framework docs already keep global/Codex skill installation explicit rather than silent.

## Design Decisions

1. Use explicit install profiles instead of pretending dependency auto-install exists.
   Rationale: the upstream CLI's documented and source-confirmed path is explicit selection. Repeated `--skill` commands are reliable and portable.

2. Make full install the default recommendation for most users.
   Rationale: this repository is a coordinated skill pack; full install avoids missing shared helpers and keeps future game routing available.

3. Keep targeted installs available through bundle commands.
   Rationale: advanced users may only want one game, but game bundles should include `game-account-toolkit` and `game-account-preflight` in the same command.

4. Store profile data in JSON and render it from the existing listing script.
   Rationale: README copy, local checks, and future automation can share one source of truth instead of duplicating dependency lists manually.

## Existing Patterns To Follow

- `scripts/list-skills.mjs` already discovers skill names from `skills/*/SKILL.md`.
- `README.md` and `README.en.md` are parallel public-facing docs with the same section order.
- `skills/game-account-toolkit/references/dependency-state-machine.md` documents explicit dependency handling boundaries.

## Implementation Units

### U1: Install Profile Manifest

Files:

- Create: `skills/install-profiles.json`

Behavior:

- Define full, core, authoring, and per-game profile names.
- Include the exact installable skill names for each profile.
- Separate required core helpers from optional community refresh helpers where useful.

Tests:

- Every skill named in the manifest exists in `skills/*/SKILL.md`.
- Profile commands render without duplicate or missing skill names.

### U2: Profile Command Rendering

Files:

- Modify: `scripts/list-skills.mjs`
- Modify: `package.json`

Behavior:

- Preserve existing `npm run list:skills` output.
- Add profile listing output with copyable `npx skills add` commands.
- Add single-profile command output for a named profile.
- Add profile data to JSON output so automation can inspect dependencies.

Tests:

- `npm run list:skills`
- `npm run list:profiles`
- `node scripts/list-skills.mjs --profile zenless-zone-zero`
- `node scripts/list-skills.mjs --json`

### U3: README Install Guidance

Files:

- Modify: `README.md`
- Modify: `README.en.md`

Behavior:

- Recommend full install first.
- Replace single game install examples with bundled commands that include core dependencies.
- Add a concise section explaining that repo-controlled default selection is not currently available in `npx skills`; use full install, repeated `--skill`, or `--skill '*'` instead.
- Point maintainers to local profile commands without making end users run checks before use.

Tests:

- Both READMEs mention full install, targeted bundle install, and the default-selection limitation.
- Both READMEs reference `npm run list:profiles`.
- Both READMEs keep the existing language switch, skill catalog, and MIT license references.

## Verification

- `npm run list:skills`
- `npm run list:profiles`
- `node scripts/list-skills.mjs --profile zenless-zone-zero`
- `node scripts/list-skills.mjs --profile wuthering-waves-with-refresh`
- `node scripts/list-skills.mjs --json`
- `npm run verify:skills`
- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- README/profile consistency check
- `git diff --check`

## Risks

- Users may confuse `--all` with project-scoped all skills. Mitigation: prefer `--skill '*'` in README examples and describe `--all` only as a CLI-wide shortcut.
- Profile JSON can drift from actual skills. Mitigation: validation checks every referenced skill against discovered frontmatter names.
- The README can sound like an implementation postmortem. Mitigation: phrase the limitation as install guidance and supported options.
