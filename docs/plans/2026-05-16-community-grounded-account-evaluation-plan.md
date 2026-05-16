---
title: Community-Grounded Game Account Evaluation
status: completed
created: 2026-05-16
origin: user request
---

# Community-Grounded Game Account Evaluation Plan

## Problem Frame

The current game account skills are too shallow for real purchasing decisions. They encode broad principles such as "do not value total five-star count too highly", but they do not give the selector a repeatable way to ground each game's account value in current community guide consensus. This is causing low-quality recommendations, especially for Wuthering Waves accounts where standard-character duplicates or raw asset counts can look valuable while actual community value is weak.

This plan improves the skill system so the selector can:

- collect and summarize community guide signals from Bilibili, Xiaohongshu, Douyin-compatible routes where available, and fallback community/search surfaces;
- convert those signals into maintainable per-game evaluation factors;
- score Wuthering Waves listings with explicit evidence, missing-field penalties, and hard downgrade rules;
- run a repeatable Wuthering Waves validation sample comparing listing claims against community-derived value.

## Scope Boundaries

In scope:

- Skill and reference-document changes under `skills/game-account-select`, `skills/game-account-toolkit`, and `skills/game-account-wuthering-waves`.
- A reusable community-research protocol for all game skills.
- Wuthering Waves concrete rules, evidence notes, and validation fixtures.
- A local verification script or documented fixture that can be run without platform scraping.

Out of scope:

- Building a web UI.
- Automating purchase, seller contact, login bypass, captcha bypass, or high-frequency platform scraping.
- Claiming live full-market coverage from a small sample.
- Treating any single creator video, short post, or comment as authoritative without cross-source confirmation.

## Requirements Traceability

- User requested better account filtering because current recommendations are poor.
- User requested integrating Bilibili, Douyin, and other community video/article strategy content into real game-specific evaluation skills.
- User requested running the optimized skill and validating with Wuthering Waves by comparing account content against community evaluation.
- Existing product doc requires Wuthering Waves to avoid overvaluing total five-star count, standard-character duplicates, and missing character details.

## Key Decisions

1. Add a cross-game community evidence protocol rather than hard-coding Bilibili/Douyin steps inside one game skill.
   Rationale: each game needs current community consensus, but collection quality, evidence grading, and fallback behavior should be consistent.

2. Make Wuthering Waves rules concrete enough to score examples offline.
   Rationale: the current Wuthering Waves skill states principles but lacks usable tiers, downgrade gates, and confidence rules.

3. Store validation samples as fixtures, not as scraped raw platform pages.
   Rationale: the product's safety model avoids unnecessary保存 of raw pages/screenshots and supports repeatable testing.

4. Treat Douyin as an optional/community signal source when available.
   Rationale: current local opencli registry exposes Douyin creator/profile/video routes but not a general public search route. The flow should record that limitation and fall back to Bilibili/Xiaohongshu/Tieba/Weibo/search when Douyin cannot be queried reliably.

## Existing Patterns To Follow

- `skills/game-account-select/references/selection-state-machine.md` for orchestrated state-machine style.
- `skills/game-account-toolkit/references/platform-access-policy.md` for conservative platform access and fallback.
- `skills/game-account-toolkit/references/shared-listing-schema.md` for normalized listing structure.
- `skills/game-account-wuthering-waves/references/valuation-rules.md` and `skills/game-account-wuthering-waves/references/character-knowledge.md` for game-specific scoring rules.

## Implementation Units

### U1: Community Research Protocol

Files:

- Create: `skills/game-account-toolkit/references/community-research-protocol.md`
- Modify: `skills/game-account-toolkit/SKILL.md`
- Modify: `skills/game-account-select/references/selection-state-machine.md`

Approach:

- Define evidence-source tiers: official patch/game docs, long-form community guides, high-engagement video guides, discussion/comment consensus, and low-confidence anecdotal posts.
- Define minimum evidence rules before a game factor can influence scoring.
- Define source-specific routing for Bilibili, Xiaohongshu, Douyin, Tieba/Weibo/search fallbacks, and when to mark a source unavailable.
- Add the protocol into the main selection flow before game-specific scoring.

Test scenarios:

- The selector flow requires community signal collection or a documented cached evidence set before scoring a new game/version.
- Douyin unavailability does not block scoring, but is disclosed as a coverage limitation.
- Missing or conflicting community evidence lowers confidence rather than inventing a score.

Verification:

- Read `skills/game-account-select/references/selection-state-machine.md` and confirm a community evidence stage exists before `SCORE_WITH_GAME_SKILL`.
- Read `skills/game-account-toolkit/SKILL.md` and confirm the new protocol is listed as a required reference for community-backed evaluation.

### U2: Wuthering Waves Evaluation Rules

Files:

- Modify: `skills/game-account-wuthering-waves/SKILL.md`
- Modify: `skills/game-account-wuthering-waves/references/valuation-rules.md`
- Modify: `skills/game-account-wuthering-waves/references/character-knowledge.md`
- Modify: `skills/game-account-wuthering-waves/references/changelog.md`

Approach:

- Add a current community-evidence section with dated coverage and source limitations.
- Convert Wuthering Waves scoring from principles into explicit buckets:
  - limited meta cores and team enablers;
  - standard or weak duplicate traps;
  - signature weapon and resonance-chain value;
  - resource liquidity;
  - account binding and channel risk;
  - missing-field confidence penalties.
- Require recommendation explanations to cite which account assets matched community-backed tiers and which did not.

Test scenarios:

- A listing with many standard-character duplicates but weak limited cores is downgraded.
- A listing with fewer total five-star assets but strong current limited cores, signature weapons, and resources outranks the raw-count listing when risk is acceptable.
- Missing weapon/binding/resource details lowers confidence and final recommendation tier.

Verification:

- Run the validation sample from U3 and confirm the expected ranking and explanations.

### U3: Repeatable Wuthering Waves Validation

Files:

- Create: `skills/game-account-wuthering-waves/references/community-evidence.md`
- Create: `skills/game-account-wuthering-waves/test-fixtures/wuthering-waves-validation-sample.json`
- Create: `skills/game-account-wuthering-waves/scripts/validate-sample.mjs`
- Modify: `README.md`

Approach:

- Record the community research summary, source coverage, search terms, and limitations.
- Create fixture listings representing:
  - a bad raw-count/high-standard-duplicates account;
  - a stronger limited-core account;
  - a risky/missing-data account.
- Add a small deterministic script that scores the fixtures using the documented Wuthering Waves rules and prints ranked results with downgrade reasons.
- Document how to run the validation.

Test scenarios:

- Running `node skills/game-account-wuthering-waves/scripts/validate-sample.mjs` ranks the limited-core account above the standard-duplicate account.
- The script output includes community comparison labels, not only numeric scores.
- The script fails if fixture IDs are missing, scores are NaN, or expected top account is not selected.

Verification:

- Run the validation script.
- Run dependency check: `node skills/game-account-toolkit/scripts/check-deps.mjs`.

## Dependencies

- `opencli` registry currently includes Bilibili search/video/subtitle/comment routes and Xiaohongshu search/note/comment routes.
- Douyin has creator and hashtag routes but no general public search route in the current registry; the implementation must expose this as a coverage limitation.
- Live community information is time-sensitive, so all evidence snapshots must include `updated_at`.

## Risks

- Community meta can drift quickly after patches. Mitigation: all evidence and character tiers are dated, and stale evidence lowers confidence.
- Search tools may fail due to login, cookies, rate limits, or anti-automation. Mitigation: protocol requires fallback and explicit limitation reporting.
- A small validation sample may not prove broad market performance. Mitigation: phrase it as a regression-style sanity check, not full market proof.

## Verification Checklist

- Plan file exists in `docs/plans/`.
- Relevant skill/reference files are updated.
- Community evidence notes include platform coverage and limitations.
- Wuthering Waves sample validation script passes.
- Dependency check is run.
- Git diff is reviewed for accidental unrelated changes.
