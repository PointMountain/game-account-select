# Optimizer Knowledge

updated_at: 2026-05-17

## Known Run Signals

- Repeated platform timeouts should become a future wait-budget or fallback rule.
- Empty result pages with login prompts should become a data-source limitation, not a repeated retry loop.
- Missing mainstream platforms should become a platform coverage finding even if one platform produced a usable result.
- Raw machine-readable tags in a final recommendation should become an output-format finding.
- User feedback about game meta should become evidence for a rule update suggestion, not an immediate high-confidence rule.
- Failed evaluator reports should become `quality_gate` findings, not warnings that can be ignored.
- Tool failures and dependency gaps should go through Troubleshooting before any valuation rule change.
- For game-account trading, "邮箱未实名出售" / unverified email included can be a positive low-retrieval-risk signal; optimizers should flag runs where it was treated as neutral or risky despite user feedback.
- Live purchase recommendations should not rely on a 30-day community evidence window. If the run records a 7+ day snapshot age, cross-version context, or user feedback that data is stale, emit an evidence refresh-window finding.
- If the run is uncertain about meta, team archetypes, pairings, dupes, signature equipment, or account-trading risk, the optimizer should require community attempts before high-confidence ranking.
- Community-source failures should not end at "unreadable"; flag missing tool fallbacks when Bilibili subtitles, Xiaohongshu bodies, comments, or similar sources time out without browser DOM, metadata, guide-site, official-source, or user-screenshot fallback.
- Main recommendations, flexible-budget backups, risk backups, and excluded listings should retain source URLs so users can compare candidates directly.
- User-approved budget flexibility belongs in a separate backup tier; near-budget accounts should not displace primary in-budget recommendations.
- Hard conditions outrank budget fit. If no listing inside the stated budget satisfies a hard condition, recommend expanding to the flexible budget and identify the cheapest satisfying listing instead of promoting an in-budget miss.
- Multi-team hard requirements must check independent team completeness. Do not count the same support or equipment slot for multiple cores; add regression samples with both shared-support traps and complete-team positives.
- ZZZ Void Hunter feedback can include exact team archetypes and comfort breakpoints. Treat `雅+柚叶+南宫/狼/苍角`、`叶+照+耀嘉音/琉音`、`仪玄+卢西娅+橘福福/琉音`、直伤电 `希希芙+席德/希德+耀嘉音`、异放/妄想天使三小只、薇薇安紊乱队、虚狩 `2+1` 高于耀嘉音 `1+1`、耀嘉音 `0+0` 可用、非虚狩 `0+1 > 1+0`、南宫羽专武优先、琉音机制特殊 as valuation/team-rule signals that need target skill docs plus validation fixtures.
- Global-synchronized games should include YouTube in community-source routing. If B站/小红书 evidence is insufficient and YouTube was not attempted or recorded as unavailable, emit an evidence coverage/fallback recommendation instead of claiming high-confidence meta consensus.
- Repeated valuable platform access without a native OpenCLI command should become an adapter-gap finding, not permanent one-off DOM scraping.
- OpenCLI adapter generation is only appropriate when the data is browser-visible, backed by verifiable HTTP/JSON/HTML, and can pass `opencli browser verify`; otherwise the correct fallback is user-provided links, screenshots, or copied text.
- Once an OpenCLI adapter has passed `browser verify --strict-memory`, future runs should emit adapter-reuse guidance and prefer `opencli <site> <command>` over one-off browser DOM parsing.
- Detail-page adapters and list-page adapters are separate capabilities. A run with `detail_adapter_available: true` and `list_adapter_available: false` should reuse the detail adapter while reporting only the missing list adapter capability.
- ZZZ Pxb7/PZDS detail adapters should preserve the asset-card status badges as `agentStatuses` and the S-rank W-Engine name list as `sWEngineNames`; for `x+y`, `x` is dupes/影画 and `y` is the matching signature W-engine count. If the badge only shows `x`, the target ZZZ skill must cross-check S W-Engine names against `references/signature-engines.json`. If a verified detail adapter run recommends accounts without `agentStatuses` or cannot provide S W-Engine names for single-number badges, emit an asset-status extraction finding instead of relying on title text.
- PZDS ZZZ detail URLs can end in `/6`, but that segment is not the ZZZ list game id. If a run visits `goodsList/6` for ZZZ or records wrong-game evidence, emit `platform-pzds-zzz-list-route-mismatch`; use `gameList` natural navigation or the browser-confirmed `goodsList/275` entry instead, and do not count the wrong route as PZDS coverage.

## Harness Philosophy

The repository should behave like a self-evolving harness:

- Every real run leaves an artifact with input, attempts, output, failures and feedback.
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
- Adding adapter-gap diagnosis guidance.
- Adding verified-adapter reuse guidance.

Not autopatch-safe by default:

- Changing game valuation weights.
- Declaring new community meta as high confidence.
- Implementing platform scraping or browser bypass logic.
- Writing or registering a new OpenCLI adapter.
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
- A run where valuable platforms have no reusable OpenCLI adapter and should trigger an adapter-generation recommendation.
- A run where pxb7/pzds zzz-detail adapters are verified and should be reused without re-triggering the adapter-gap finding.
- A run where pxb7/pzds zzz-detail adapters are verified but list adapters are missing, proving the optimizer can emit both detail reuse and list-capability gap evidence without conflating the two.
- A run where verified pxb7/pzds zzz-detail adapters are used for ZZZ but the recommendation drops `agentStatuses` or lacks `sWEngineNames` while relying on single-number badges for signature W-Engines, proving the optimizer catches missing asset-card/status-name data.
- A ZZZ run where `agentStatuses` contains only `x` values while the recommendation claims signature W-Engines are complete, proving the optimizer emits `platform-signature-engine-name-list-missing`.
- A ZZZ run where PZDS was "covered" through `goodsList/6` or other wrong-game evidence, proving the optimizer catches route mismatch instead of treating PZDS as a valid covered source.
- A ZZZ run where a user-confirmed best-value account has three Void Hunters at `2+1`, Astra/Yaojiayin at `0+0`, and Delusion Angels signatures, proving the target game validation ranks it above an Astra `1+1` account with weaker Void Hunter or Angels investment.
- A community evidence run where YouTube is omitted for a global-synchronized game, proving the optimizer/evaluator keeps YouTube in the expected evidence-source set.
- A failed evaluator run to prove redo behavior.
