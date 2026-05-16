---
title: Game Account Skill Optimizer
status: active
created: 2026-05-17
origin: user-request
---

# Game Account Skill Optimizer Plan

## Problem Frame

Recent Wuthering Waves account selection exposed several repeatable workflow problems:

- Slow or empty platform paths were retried too long before falling back.
- The final answer leaked raw XML-style `<game_account_evaluation>` tags that are useful for machine contracts but awkward for user-facing recommendations.
- Platform coverage missed Pangxie (`pxb7.com`) and Panzhi (`pzds.com`), even though they are important Chinese account trading sources.
- Wuthering Waves scoring over-focused on chains and weapons without enough explicit treatment of current social-meta team archetypes such as Ai-Mo-Lin, Ka-Qian-Xia, and Ri-Yue-Shou.
- Execution problems were noticed manually but not converted into durable skill improvement suggestions or validation fixtures.

The repository already has a skill framework, preflight checks, community updater, evaluator, and per-game validation samples. The new work should fit that structure instead of creating a separate runtime.

## Scope

Build a new `game-account-skill-optimizer` skill that can run manually or be invoked after account selection. It analyzes execution traces, user feedback, and recommendation artifacts, then produces structured optimization findings and optional safe patch suggestions. Update `game-account-select` and Wuthering Waves references so future runs know when and how to use it.

Also update Wuthering Waves scoring rules and validation data to cover team archetypes and user-facing output polish. Add platform strategy guidance for Pangxie and Panzhi without implementing unsafe or high-frequency scraping.

## Non-Goals

- No automatic account purchasing, seller messaging, login bypassing, CAPTCHA bypassing, or bulk platform scraping.
- No silent self-modification after every run. The optimizer may propose changes; writing rules still requires user confirmation unless the user explicitly asks for an implementation pass.
- No full browser adapter for Pangxie or Panzhi in this change. The first step is platform policy and execution guidance.
- No replacement of the existing `<game_account_evaluation>` contract for internal skill-to-skill use. The change is to separate machine-readable artifacts from user-facing prose.

## Requirements Traceability

- R1: Implement a skill that optimizes other game-account skills after each screening run or when manually invoked.
- R2: Analyze execution-time issues such as long runtimes, empty results, blocked pages, missing platforms, weak recommendations, and awkward output format.
- R3: Use the prior Wuthering Waves 77175988 run as a validation fixture.
- R4: Prevent raw machine-contract tags from being exposed as the primary user-facing answer.
- R5: Add Pangxie and Panzhi to platform strategy alongside Taoshouyou and Jiaoyimao.
- R6: Improve Wuthering Waves scoring to consider social-meta teams and main DPS plus signature-weapon fit, not only resonance chains and weapon count.

## Existing Patterns To Follow

- `skills/game-account-community-updater/` for a maintenance skill that writes reports from structured JSON.
- `skills/game-account-skill-evaluator/` for a quality-gate skill with a deterministic script.
- `skills/game-account-toolkit/references/skill-io-contract.md` for tagged input/output contracts.
- `skills/game-account-wuthering-waves/scripts/validate-sample.mjs` for regression-style validation.
- `skills/install-profiles.json`, `README.md`, and `README.en.md` for skill inventory updates.

## Implementation Units

### Unit 1: Optimizer Skill

Files:

- `skills/game-account-skill-optimizer/SKILL.md`
- `skills/game-account-skill-optimizer/references/optimization-workflow.md`
- `skills/game-account-skill-optimizer/references/issue-taxonomy.md`
- `skills/game-account-skill-optimizer/references/changelog.md`
- `skills/game-account-skill-optimizer/scripts/analyze-run.mjs`
- `skills/game-account-skill-optimizer/test-fixtures/wuthering-waves-77175988-run.json`

Decisions:

- Accept a JSON run artifact so validation can be deterministic and offline.
- Output `<skill_optimization_report>` for machine use, plus a short prose summary for humans.
- Treat auto-patching as opt-in. The script should classify findings and suggest target files but not edit them.

Test Scenarios:

- A fixture with `xianyu` timeout, Google timeout, Taoshouyou success, and detail-page 503 should identify slow-path and fallback findings.
- A fixture containing raw `<game_account_evaluation>` in final user text should produce an output-polish finding.
- A fixture missing Pangxie/Panzhi sources should produce platform-coverage findings.
- A fixture with `rule_update_suggestion` for Wuthering Waves team/meta knowledge should suggest Wuthering Waves rule updates.

### Unit 2: Main Selection Integration

Files:

- `skills/game-account-select/SKILL.md`
- `skills/game-account-select/references/selection-state-machine.md`
- `skills/game-account-toolkit/references/platform-access-policy.md`
- `skills/game-account-toolkit/references/shared-listing-schema.md`
- `README.md`
- `README.en.md`
- `skills/install-profiles.json`

Decisions:

- Add a post-run optimization stage after feedback handling and before ending the flow.
- Update platform ordering to prefer user-provided platforms, then Pangxie/Panzhi/Trading Cat/Taoshouyou as available low-frequency sources.
- Require final recommendations to keep machine-readable details in compact JSON or summarized fields instead of raw XML tags in the visible prose.

Test Scenarios:

- Frontmatter verification should include the new skill.
- Skill listing should show the optimizer and install profile should include it where appropriate.
- Text checks should confirm Pangxie/Panzhi are listed in platform policy and selection flow.

### Unit 3: Wuthering Waves Rules and Validation

Files:

- `skills/game-account-wuthering-waves/references/valuation-rules.md`
- `skills/game-account-wuthering-waves/references/character-knowledge.md`
- `skills/game-account-wuthering-waves/references/community-evidence.md`
- `skills/game-account-wuthering-waves/references/changelog.md`
- `skills/game-account-wuthering-waves/test-fixtures/wuthering-waves-validation-sample.json`
- `skills/game-account-wuthering-waves/scripts/validate-sample.mjs`

Decisions:

- Add a distinct team-archetype score so recognized meta teams can beat isolated high-chain assets when risk and price are comparable.
- Keep chains and signature weapons important, but require role/team compatibility for high value.
- Treat newly named team archetypes as community-evidence-backed enough for medium confidence, with refresh required for exact Chinese community naming drift.

Test Scenarios:

- A complete team account with moderate chains should outrank an isolated high-chain account.
- 77175988-style account should score as a strong recommendation but still carry medium confidence when resource/third-party binding screenshots are missing.
- Resource-only accounts should remain useful for pull planning but not outrank a clearly stronger complete-team account for a strength-focused buyer.

## Verification

Run:

```bash
npm run verify:frontmatter
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/wuthering-waves-77175988-run.json --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-skill-optimizer --json
node skills/game-account-wuthering-waves/scripts/validate-sample.mjs
npm run verify:skills
```

## Risks

- Optimizer recommendations can become noisy if they flag every missing field. The taxonomy should separate blocking, recommended, and informational findings.
- Platform source order can drift quickly. The policy should describe strategy and safe access, not hardcode brittle selectors.
- Team archetype names may vary between Chinese and English communities. Rules should store aliases and mark evidence freshness.

