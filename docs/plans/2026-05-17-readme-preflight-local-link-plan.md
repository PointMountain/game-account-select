---
title: README Preflight And Local Skill Linking
status: completed
created: 2026-05-17
origin: user request
---

# README Preflight And Local Skill Linking Plan

## Problem Frame

The README still explains the `npx skills` limitation too abstractly. Users who choose interactively or install one game need a direct checklist of companion skills to select, without implementation rationale. The runtime skills also say to call preflight, but they should make dependency status visible at execution time so missing companion skills or local tools are caught before account evaluation.

The repository already uses ESM through `package.json`, so new local helper scripts can use `.js` instead of `.mjs`. Existing skill-internal `.mjs` files should stay unless there is a strong reason to rename them because those paths are already referenced by skill docs and verification commands.

## Scope Boundaries

In scope:

- Update Chinese and English README install sections with a simple interactive-selection checklist: choose the game skill plus the required companion skills.
- Add dependency/preflight visibility to the skill execution instructions.
- Add local symlink helper commands to link and unlink this checkout's skills under the user's home skills directory for local validation.
- Rename the top-level listing script to `.js` and update package scripts and README references to use `.js`.
- Keep `type: module` in `package.json` and document the TypeScript decision through implementation choices.

Out of scope:

- Changing upstream `npx skills` behavior.
- Renaming all skill-local `.mjs` validation scripts.
- Introducing a TypeScript build chain.
- Silently installing global dependencies or external skills.
- Changing game valuation rules.

## Requirements Traceability

- User asked README to state directly which dependency skills to install when installing a single game.
- User asked every execution to show preflight/dependency status.
- User asked for one npm command to symlink the repository into the home skills directory and one to remove those symlinks.
- User asked whether `type: module` can remove the need for `.mjs`.
- User asked whether TypeScript is necessary for scripts.

## Design Decisions

1. Present interactive install guidance as a short required companion list.
   Rationale: users choosing in the `npx skills` UI need names to select, not an explanation of CLI internals.

2. Use install profiles as the single source of truth for README and local commands.
   Rationale: profiles already encode which companion skills go with each game bundle.

3. Link each skill folder into `~/.agents/skills` rather than linking the repository root.
   Rationale: skills are discovered as individual skill directories, and per-skill symlinks let local edits reflect immediately while preserving normal skill lookup.

4. Keep helper scripts in plain ESM JavaScript.
   Rationale: the scripts are small Node filesystem/JSON utilities; TypeScript would add build/dependency overhead without enough type-safety payoff.

5. Keep existing skill validation scripts as `.mjs` for now.
   Rationale: broad renames would touch many docs and skill references without improving the user-facing local commands.

## Existing Patterns To Follow

- `scripts/list-skills.mjs`
- `skills/install-profiles.json`
- `skills/game-account-preflight/SKILL.md`
- `skills/game-account-toolkit/references/game-skill-standard.md`
- Existing `package.json` ESM configuration.

## Implementation Units

### U1: README Install Guidance

Files:

- Modify: `README.md`
- Modify: `README.en.md`

Behavior:

- Show that interactive install should select the desired game plus companion skills.
- List required companion skills plainly: `game-account-toolkit`, `game-account-preflight`, and `game-account-community-updater`.
- Keep full install and profile command guidance.
- Remove the internal-facing rationale about dependency manifests/default selection from the primary install flow.

Tests:

- README consistency check verifies both languages mention the companion skills and local link commands.

### U2: Local Link/Unlink Commands

Files:

- Create: `scripts/link-local-skills.js`
- Create: `scripts/unlink-local-skills.js`
- Rename: `scripts/list-skills.mjs` to `scripts/list-skills.js`
- Modify: `package.json`

Behavior:

- `npm run link:skills` creates symlinks from each repo skill directory to `~/.agents/skills/<skill-name>`.
- `npm run unlink:skills` removes only symlinks that point back to this checkout's skill directories.
- Existing files/directories that are not matching symlinks are left untouched and reported as conflicts.
- Listing/profile commands continue to work through `.js` ESM scripts.

Tests:

- Link into a temporary home directory and verify symlinks exist.
- Unlink from the same temporary home directory and verify symlinks are removed.
- Existing `npm run list:skills`, `npm run list:profiles`, and profile alias commands still pass.

### U3: Execution Preflight Visibility

Files:

- Modify: `skills/game-account-preflight/SKILL.md`
- Modify: `skills/game-account-toolkit/references/game-skill-standard.md`
- Modify: entry `SKILL.md` files that start account selection, game evaluation, generation, evaluation, or community update.

Behavior:

- Entry skills run preflight first and include a visible `<preflight_report>` before their task-specific output.
- Game skills still lower confidence or stop when required dependencies are missing, based on preflight status.
- The instructions keep installation safe: no silent global installs or external skill modifications.

Tests:

- Text checks confirm every entry skill references visible preflight output.
- Existing skill validations still pass.

## Verification

- `npm run list:skills`
- `npm run list:profiles`
- `node scripts/list-skills.js --profile zzz`
- `node scripts/list-skills.js --json`
- `HOME=/tmp/game-account-link-test npm run link:skills`
- `HOME=/tmp/game-account-link-test npm run unlink:skills`
- `npm run verify:skills`
- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- README and skill preflight consistency check
- `git diff --check`

## Risks

- Symlink commands could remove user-installed skills accidentally. Mitigation: unlink only removes symlinks whose real path points to this checkout.
- README could become too maintenance-oriented. Mitigation: keep the install path concise and move local validation commands to the maintenance section.
- TypeScript could increase maintenance overhead for little benefit. Mitigation: continue with small ESM JavaScript scripts and no build step.
