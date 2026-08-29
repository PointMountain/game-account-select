# Optimizer Knowledge

updated_at: 2026-08-29

## Known Run Signals

- Repeated platform timeouts should become a future wait-budget or fallback rule.
- ego-browser-backed platform attempts must leave no hidden query state. Runs should record a stable `query_session_id` plus task space id/name, call `completeTaskSpace` through `query:cleanup`, and attach a process audit; missing cleanup, remaining task spaces, or leftover `ego-browser nodejs` / `run-with-timeout` / platform detail processes should trigger `runtime-browser-session-cleanup-missing`.
- Empty result pages with login prompts should become a data-source limitation, not a repeated retry loop.
- Missing mainstream platforms should become a platform coverage finding even if one platform produced a usable result.
- An Arknights run with both PXB7 and PZDS attempts but only one visible platform result should trigger `output-dual-platform-shortlists-missing`; a passing run contains both platform shortlists and may still select one cross-platform best-value listing.
- A dual-platform artifact can contain five PZDS candidates while a hand-written answer shows only two. Require deterministic Markdown-table rendering, compare candidate ids in the final response with each platform shortlist, and emit `output-platform-shortlist-render-underfilled` when available rows are dropped.
- An artifact may contain valid in-budget near matches while `display_candidates` is saturated by higher-priced exact matches. Array presence is not enough: require a fixed budget-layer report, count zero in-budget exact matches explicitly, and compare the in-budget near-match IDs/URLs against `final_response`; otherwise emit `output-in-budget-near-match-not-rendered`.
- Preserve the raw user request independently from any derived runtime-profile text. Store both hashes in `request_provenance`; never let a synthesized resource threshold erase what the user actually asked.
- Evaluating a deterministic artifact does not validate a later handwritten reply. Finalizers must attach a verbatim delivery hash and required sections, and the user-facing response must include the same budget layers, dual-platform tables, and self-improve summary.
- A plain `experience_summary` string is not a completed self-improve cycle. Real selection runs need structured `self_improve` state with optimizer/evaluator reports and applied-versus-pending knowledge counts; otherwise emit `self-improve-closeout-missing`.
- Raw machine-readable tags in a final recommendation should become an output-format finding.
- User feedback about game meta should become evidence for a rule update suggestion, not an immediate high-confidence rule.
- Failed evaluator reports should become `quality_gate` findings, not warnings that can be ignored.
- Tool failures and dependency gaps should go through Troubleshooting before any valuation rule change.
- For game-account trading, "邮箱未实名出售" / unverified email included can be a positive low-retrieval-risk signal; optimizers should flag runs where it was treated as neutral or risky despite user feedback.
- Live purchase recommendations should not rely on a 30-day community evidence window. If the run records a 7+ day snapshot age, cross-version context, or user feedback that data is stale, emit an evidence refresh-window finding.
- If the run is uncertain about meta, team archetypes, pairings, dupes, signature equipment, or account-trading risk, the optimizer should require community attempts before high-confidence ranking.
- Community-source failures should not end at "unreadable"; flag missing tool fallbacks when Bilibili subtitles, Xiaohongshu bodies, comments, or similar sources time out without browser DOM, metadata, guide-site, official-source, or user-screenshot fallback.
- Main recommendations, flexible-budget backups, risk backups, and excluded listings should retain source URLs so users can compare candidates directly.
- Listing publication time and platform verification time are separate provenance facts. If an ego-ops operation exposes either one, normalized recommendation rows must retain it as `published_at` or `platform_verified_at`; missing values stay null and user-facing output says `未披露`. Never substitute extraction or run timestamps.
- User-approved budget flexibility belongs in a separate backup tier; near-budget accounts should not displace primary in-budget recommendations.
- Hard conditions outrank budget fit. If no listing inside the stated budget satisfies a hard condition, recommend expanding to the flexible budget and identify the cheapest satisfying listing instead of promoting an in-budget miss.
- Multi-team hard requirements must check independent team completeness. Do not count the same support or equipment slot for multiple cores; add regression samples with both shared-support traps and complete-team positives.
- ZZZ Void Hunter feedback can include exact team archetypes and comfort breakpoints. Treat `雅+柚叶+南宫/狼/苍角`、`叶+照+耀嘉音/琉音`、`仪玄+卢西娅+橘福福/琉音`、直伤电 `希希芙+席德/希德+耀嘉音`、异放/妄想天使三小只、薇薇安紊乱队、虚狩 `2+1` 高于耀嘉音 `1+1`、耀嘉音 `0+0` 可用、非虚狩 `0+1 > 1+0`、南宫羽专武优先、琉音机制特殊 as valuation/team-rule signals that need target skill docs plus validation fixtures.
- Global-synchronized games should include YouTube in community-source routing. If B站/小红书 evidence is insufficient and YouTube was not attempted or recorded as unavailable, emit an evidence coverage/fallback recommendation instead of claiming high-confidence meta consensus.
- Repeated valuable platform access without verified ego-ops knowledge should become an operation-gap finding. After a successful live run, add only the stable, reusable observation/action/verification sequence to ego-ops.
- Missing knowledge does not authorize another query stack. Create a read-only ego-ops task card, explore with the single ego-browser task space, verify current-page signals, and record `knowledge_status: exploration_required` until success-only writeback passes validation.
- Once an ego-ops operation is verified, future runs should emit operation-reuse guidance, progressively read only that site/operation, and still revalidate current-page checkpoints.
- Detail and list operations are separate capabilities. A run with a verified detail operation but `list_operation_status: operation_missing` should reuse detail knowledge while reporting only the list-operation gap.
- ZZZ PXB7/PZDS detail operations should preserve asset-card status badges as `agentStatuses` and the S-rank W-Engine name list as `sWEngineNames`; for `x+y`, `x` is dupes/影画 and `y` is the matching signature W-engine count. If the badge only shows `x`, the target ZZZ skill must cross-check S W-Engine names against `references/signature-engines.json`. If a verified detail operation recommends accounts without `agentStatuses` or cannot provide S W-Engine names for single-number badges, emit an asset-status extraction finding instead of relying on title text.
- PZDS ZZZ detail URLs can end in `/6`, but that segment is not the ZZZ list game id. If a run visits `goodsList/6` for ZZZ or records wrong-game evidence, emit `platform-pzds-zzz-list-route-mismatch`; use `gameList` natural navigation or the browser-confirmed `goodsList/275` entry instead, and do not count the wrong route as PZDS coverage.
- A selector run with platform attempts, community attempts, or recommendations but no `coverage_plan.source_tasks` should emit `selector-source-coverage-plan-missing`. This catches the "found something, but did not define completeness first" failure mode.
- A run with coverage gaps, user feedback, rule update suggestions, or execution failures but no `knowledge_update_candidates` should emit `selector-knowledge-ledger-candidates-missing`. This prevents durable learning from living only in chat.
- Selection profiles are run-only. If a run persists its budget, normalized weights, server/risk preference, platform choice, or hard conditions into SKILL/references, emit blocking `selector-session-preference-leak`; only stable facts and evidence-gated valuation candidates may enter durable knowledge.

## Harness Philosophy

The repository should behave like a self-evolving harness:

- Every real run leaves an artifact with input, attempts, output, failures and feedback.
- The artifact starts with success criteria and a source coverage plan, not only post-hoc attempts.
- Actionable observations become knowledge update candidates before they become rule changes.
- The optimizer turns artifacts into precise findings and target files.
- The evaluator decides whether generated or optimized skill output is usable.
- Low score, blocking issues or `redo_required: true` means the work loops back into diagnosis and patching.
- The loop improves local rules and fixtures without silently rewriting business logic.

## Safe Patch Policy

Autopatch-safe changes:

- Adding platform coverage guidance.
- Adding output-format guidance.
- Adding runtime logging fields.
- Adding deterministic fixtures.
- Adding ego-ops operation-gap diagnosis guidance.
- Adding verified-operation reuse guidance.

Not autopatch-safe by default:

- Changing game valuation weights.
- Declaring new community meta as high confidence.
- Implementing platform scraping or browser bypass logic.
- Writing ego-ops knowledge before a successful current-page verification.
- Removing risk checks to improve scores.
- Marking a failed evaluator report as acceptable.

## Validation Expectations

An optimizer sample should identify at least one issue from a real run artifact. A high-quality report should include target files, evidence, severity, category, whether the suggestion is safe to autopatch, and which evaluator gate must pass after the change.

Regression coverage should include:

- A real-ish noisy account screening run.
- A clean run with no findings.
- A non-Wuthering target skill run to prove repository-wide routing.
- A Zenless Zone Zero run covering email-unverified risk ranking and shortened evidence refresh windows.
- A run covering community evidence fallback, wait-budget recording, listing links, and flexible-budget backup output.
- A run covering hard-condition budget expansion and multi-team completeness, such as ZZZ all Void Hunters needing three independent teams.
- A ZZZ run where old team archetypes or comfort bonuses are wrong, proving the optimizer flags exact team-rule updates and the target skill validation catches old口径陷阱.
- A run where valuable platforms have no reusable ego-ops operation and should trigger a success-only operation-writeback recommendation.
- An Arknights run where support-matrix-verified PXB7/PZDS operations are recognized as reusable without re-triggering the operation-gap finding.
- A negative ZZZ run that falsely labels exploration-only detail parsers as verified, proving the optimizer emits `platform-operation-support-claim-mismatch` and never emits reuse.
- A negative ZZZ run with missing list knowledge plus false detail verification claims, proving list gaps and support-claim mismatches stay distinct without publishing either capability.
- Future ZZZ asset-card and signature-name completeness regressions should only activate after the corresponding detail operations are promoted to `verified`; until then the capability mismatch is the blocking finding.
- A ZZZ run where PZDS was "covered" through `goodsList/6` or other wrong-game evidence, proving the optimizer catches route mismatch instead of treating PZDS as a valid covered source.
- A ZZZ run where a user-confirmed best-value account has three Void Hunters at `2+1`, Astra/Yaojiayin at `0+0`, and Delusion Angels signatures, proving the target game validation ranks it above an Astra `1+1` account with weaker Void Hunter or Angels investment.
- A community evidence run where YouTube is omitted for a global-synchronized game, proving the optimizer/evaluator keeps YouTube in the expected evidence-source set.
- A run where nested operation facts expose a listing or platform-verification time but the normalized recommendation drops it, proving the optimizer emits `output-listing-time-facts-omitted`.
- A failed evaluator run to prove redo behavior.
- A run that tries to turn a 1000-CNY collector/server preference into a permanent game-skill default, proving the optimizer rejects session preference leakage.
- An Arknights run where five out-of-budget exact matches hide two already-verified in-budget near matches and the handwritten answer omits Self-improve/provenance/delivery contract, proving the entire delivery chain is rejected until deterministic finalization repairs it.
