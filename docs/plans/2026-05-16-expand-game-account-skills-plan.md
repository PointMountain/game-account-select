---
title: Expand Game Account Skills
status: completed
created: 2026-05-16
origin: user request
---

# Expand Game Account Skills Plan

## Problem Frame

The Wuthering Waves skill now has a community-grounded workflow, concrete scoring rules, and a repeatable validation sample. The other game skills still use shallow rule summaries, and the selector does not yet support Zenless Zone Zero. This work brings the other supported games closer to the same standard and adds a new ZZZ account-purchase skill.

## Scope Boundaries

In scope:

- Strengthen Arknights and Neverness to Everness valuation rules with community-evidence requirements, scoring buckets, risk/missing-field penalties, and validation samples.
- Add `game-account-zenless-zone-zero` with ZZZ-specific account purchase rules, character/engine/team/resource/risk logic, changelog, and validation sample.
- Wire ZZZ into `game-account-select`, README, and product docs.
- Add deterministic local validation scripts for Arknights, Neverness to Everness, and ZZZ.

Out of scope:

- Live platform scraping or broad community research runs for every game in this pass.
- Web UI changes.
- Automatic trading, seller contact, login bypass, captcha bypass, or high-frequency platform access.

## Requirements Traceability

- User asked to optimize the other game skills.
- User asked to add a Zenless Zone Zero account purchase skill.
- Existing selector pattern requires each game to keep independent rules and avoid applying one game's logic to another.
- Existing community protocol requires current-version evidence snapshots or explicit confidence downgrades when coverage is limited.

## Key Decisions

1. Use the same document shape across game skills.
   Rationale: the selector can reason consistently across games when every skill exposes evidence, value tiers, scoring buckets, risk penalties, and validation fixtures.

2. Treat Arknights as a mature account market with collection and progress value.
   Rationale: Arknights account value depends on limited/collab operators, elite/mastery/module progress, rare skins, and server/platform risk, not just six-star count.

3. Treat Neverness to Everness as early-market and evidence-limited.
   Rationale: the game skill already acknowledges fast-changing market maturity; missing community evidence must lower confidence and avoid overconfident S-rank valuation.

4. Treat ZZZ as team- and weapon-dependent.
   Rationale: ZZZ account value depends on limited S-rank agents, W-Engines, team archetypes, resources, Inter-Knot/account platform risk, and whether a listing only advertises S-rank count.

## Existing Patterns To Follow

- `skills/game-account-wuthering-waves/references/valuation-rules.md`
- `skills/game-account-wuthering-waves/references/character-knowledge.md`
- `skills/game-account-wuthering-waves/references/community-evidence.md`
- `skills/game-account-wuthering-waves/scripts/validate-sample.mjs`
- `skills/game-account-toolkit/references/community-research-protocol.md`

## Implementation Units

### U1: Arknights Skill Upgrade

Files:

- Modify: `skills/game-account-arknights/SKILL.md`
- Create: `skills/game-account-arknights/references/community-evidence.md`
- Create: `skills/game-account-arknights/references/operator-knowledge.md`
- Modify: `skills/game-account-arknights/references/valuation-rules.md`
- Modify: `skills/game-account-arknights/references/changelog.md`
- Create: `skills/game-account-arknights/test-fixtures/arknights-validation-sample.json`
- Create: `skills/game-account-arknights/scripts/validate-sample.mjs`

Test scenarios:

- A listing with limited/collab/high-impact operators, progress, resources, and clear risk status outranks a generic high-six-star-count account.
- A risky account with strong assets is downgraded for server/account/binding/guarantee gaps.
- The script fails if the expected top account is not selected.

### U2: Neverness to Everness Skill Upgrade

Files:

- Modify: `skills/game-account-neverness-to-everness/SKILL.md`
- Create: `skills/game-account-neverness-to-everness/references/community-evidence.md`
- Create: `skills/game-account-neverness-to-everness/references/asset-knowledge.md`
- Modify: `skills/game-account-neverness-to-everness/references/valuation-rules.md`
- Modify: `skills/game-account-neverness-to-everness/references/changelog.md`
- Create: `skills/game-account-neverness-to-everness/test-fixtures/neverness-validation-sample.json`
- Create: `skills/game-account-neverness-to-everness/scripts/validate-sample.mjs`

Test scenarios:

- A listing with named S assets, matching S arc plates, awakenings, resources, and clean account type outranks a vague total-S-count listing.
- TAP/perfect/B-server mismatch and missing S asset details reduce confidence.
- Early-market evidence limitations are surfaced rather than hidden.

### U3: Zenless Zone Zero Skill

Files:

- Create: `skills/game-account-zenless-zone-zero/SKILL.md`
- Create: `skills/game-account-zenless-zone-zero/references/community-evidence.md`
- Create: `skills/game-account-zenless-zone-zero/references/agent-knowledge.md`
- Create: `skills/game-account-zenless-zone-zero/references/valuation-rules.md`
- Create: `skills/game-account-zenless-zone-zero/references/changelog.md`
- Create: `skills/game-account-zenless-zone-zero/test-fixtures/zenless-zone-zero-validation-sample.json`
- Create: `skills/game-account-zenless-zone-zero/scripts/validate-sample.mjs`
- Modify: `skills/game-account-select/SKILL.md`
- Modify: `skills/game-account-select/references/selection-state-machine.md`
- Modify: `README.md`
- Modify: `docs/product/game-account-selection-assistant.md`

Test scenarios:

- A listing with limited S-rank agents, matching W-Engines, complete teams, resources, and clean binding outranks a raw S-rank-count account.
- Standard S-rank duplicates and unmatched W-Engines do not dominate ranking.
- Missing HoYoverse/PSN/TAP binding and guarantee status is penalized.

### U4: Verification And Pipeline

Files:

- All scripts and docs above.

Verification:

- `node skills/game-account-arknights/scripts/validate-sample.mjs`
- `node skills/game-account-neverness-to-everness/scripts/validate-sample.mjs`
- `node skills/game-account-zenless-zone-zero/scripts/validate-sample.mjs`
- `node skills/game-account-wuthering-waves/scripts/validate-sample.mjs`
- `node skills/game-account-toolkit/scripts/check-deps.mjs`
- Browser pipeline remains not applicable unless a web app/server is added.

## Risks

- ZZZ and Arknights meta can drift quickly. Mitigation: evidence snapshots are dated and stale snapshots cap confidence.
- Neverness to Everness may have limited public market evidence. Mitigation: explicitly label evidence as low/limited and require named assets before high scores.
- Validation scripts are regression sanity checks, not market price prediction. Mitigation: README should present them as rule checks.
