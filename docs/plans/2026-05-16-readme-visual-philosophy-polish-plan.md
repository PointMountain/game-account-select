---
title: README Visual And Philosophy Polish
status: completed
created: 2026-05-16
origin: user request
---

# README Visual And Philosophy Polish Plan

## Problem Frame

The current README is functional, but it still reads partly like internal skill implementation documentation. The user wants it to feel more like a public product-facing skill repository: localized visuals, an anime-game style icon, a polished flow diagram with node explanations, better language-switch state, and a design philosophy section inspired by strong skill repos such as `taste-skill` and `web-access`.

## Scope Boundaries

In scope:

- Split the README banner into Chinese and English localized assets.
- Add a small anime-game style project icon under the title area, similar to public skill repositories that use a visual mark below the intro.
- Rewrite README copy to describe user-facing capabilities rather than internal skill obligations.
- Replace the plain text arrow workflow with a polished flow diagram asset and node-by-node explanation.
- Improve language switch styling so the active language is bold, dark, and not linked.
- Add a "design philosophy" section for this skill pack in both Chinese and English READMEs.
- Keep install commands, skill catalog, license, safety boundaries, and maintainer validation intact.

Out of scope:

- Changing runtime skill behavior.
- Translating every reference document.
- Publishing a package or website.
- Adding a frontend app.

## Requirements Traceability

- User asked for separate Chinese and English banner images.
- User asked for a small anime-game style icon under the title area.
- User asked to remove internal implementation language such as "users do not need to run preflight" and make the README more feature-oriented.
- User asked for a better-looking flow diagram instead of text arrows, with each node explained.
- User asked active language to be non-clickable/bold/dark instead of a link.
- User asked to reference `eze-is/web-access` and summarize the current skill's design philosophy.

## Design Decisions

1. Use SVG assets for banners, icon, and workflow diagram.
   Rationale: SVG is reviewable, small, deterministic, and renders on GitHub without binary generation.

2. Keep default Chinese README and English alternate in parallel structure.
   Rationale: `README.md` remains Chinese by default, while `README.en.md` remains an equivalent switch target.

3. Describe preflight as a capability label rather than an instruction.
   Rationale: public README copy should explain what the system provides to users, not prescribe internal skill implementation details.

4. Add a philosophy section with three durable principles.
   Rationale: this mirrors stronger skill repos that explain how the skill thinks, not just what files exist.

## Implementation Units

### U1: Localized Visual Assets

Files:

- Create: `assets/readme-banner-zh.svg`
- Create: `assets/readme-banner-en.svg`
- Create: `assets/readme-icon.svg`
- Create: `assets/readme-flow-zh.svg`
- Create: `assets/readme-flow-en.svg`
- Remove the old shared `assets/readme-banner.svg` after replacing README references with localized banners.

Tests:

- `xmllint --noout` on all SVG assets.
- READMEs reference the localized banner and flow assets.

### U2: README Copy And Language Switch

Files:

- Modify: `README.md`
- Modify: `README.en.md`

Behavior:

- Chinese README active language is bold text, English is a link.
- English README active language is bold text, Chinese is a link.
- README content is capability-led and user-facing.
- Workflow diagram replaces plain text arrow block.

Tests:

- README i18n consistency script checks language links, assets, install commands, license, and all skill names.

### U3: Philosophy Section

Files:

- Modify: `README.md`
- Modify: `README.en.md`

Behavior:

- Add a concise skill design philosophy section inspired by strong skill repos.
- Emphasize goal-driven selection, evidence before scoring, explicit uncertainty, and safe platform behavior.

Tests:

- Both READMEs contain the philosophy heading and matching durable concepts.

## Verification

- `npm run list:skills`
- `npm run verify:skills`
- `node skills/game-account-preflight/scripts/preflight.mjs --json`
- `node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json`
- README i18n/asset consistency script
- `xmllint --noout assets/readme-banner-zh.svg assets/readme-banner-en.svg assets/readme-icon.svg assets/readme-flow-zh.svg assets/readme-flow-en.svg`
- `git diff --check`

## Risks

- README can become too decorative. Mitigation: visuals support the flow and brand, while copy stays focused on install, capabilities, philosophy, and safety.
- Two localized README files can drift. Mitigation: use the same section order and verify key commands, assets, and skill names in both files.
