---
title: README MIT And I18n Polish
status: completed
created: 2026-05-16
origin: user request
---

# README MIT And I18n Polish Plan

## Problem Frame

The README is currently English-only and mentions no real license file. The user wants a default Chinese README, a switch to English, and an MIT license. The repository should present a complete public GitHub package with a real `LICENSE`, license badge, localized README files, and package metadata aligned with the license.

## Scope Boundaries

In scope:

- Add a real MIT `LICENSE` file.
- Update package metadata to declare MIT now that the license file exists.
- Make `README.md` the default Chinese README.
- Add an English README that mirrors the Chinese content.
- Add clear language switch links between Chinese and English.
- Keep install, automatic preflight, skill catalog, maintenance, and safety content from the existing README.

Out of scope:

- Translating every skill reference document.
- Publishing to npm.
- Changing skill runtime behavior.
- Adding a website or generated docs build.

## Requirements Traceability

- User asked to add an MIT license to the README/project.
- User asked for multilingual Chinese and English documentation.
- User asked Chinese to be the default language, with a switch to English.

## Design Decisions

1. Keep `README.md` in Simplified Chinese.
   Rationale: GitHub shows `README.md` by default, matching the user's default Chinese requirement.

2. Add `README.en.md` for English.
   Rationale: this is a common simple i18n pattern for GitHub repos and does not require a docs generator.

3. Add language switch links at the top of both README files.
   Rationale: users should discover the alternate language immediately.

4. Add `LICENSE` and restore `package.json` license metadata.
   Rationale: a license badge should link to a real license file, and package metadata should match it.

## Implementation Units

### U1: License

Files:

- Create: `LICENSE`
- Modify: `package.json`

Behavior:

- MIT license is present and package metadata declares `"license": "MIT"`.
- README badges link to `LICENSE`.

Tests:

- `test -f LICENSE`
- `node -e "console.log(require('./package.json').license)"`

### U2: Default Chinese README

Files:

- Modify: `README.md`

Behavior:

- README is Simplified Chinese by default.
- It retains banner, install instructions, skill catalog, workflow, automatic preflight, I/O, new game generation, maintenance, safety, and license sections.
- It links to `README.en.md`.

Tests:

- README contains `README.en.md`.
- README contains `MIT License`.
- README contains `npx skills add`.

### U3: English Alternate README

Files:

- Create: `README.en.md`

Behavior:

- English content mirrors the default README.
- It links back to `README.md`.

Tests:

- `README.en.md` contains the same install commands.
- `README.en.md` links back to `README.md`.

## Verification

- `npm run list:skills`
- `npm run verify:skills`
- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- `xmllint --noout assets/readme-banner.svg`
- `git diff --check`

## Risks

- Two README files can drift. Mitigation: keep the structure parallel and include only durable content, not generated command output.
- License badge without a license file is misleading. Mitigation: add the license first and validate the file exists.
