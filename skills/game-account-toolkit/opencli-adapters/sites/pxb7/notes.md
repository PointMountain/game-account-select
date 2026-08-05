## 2026-08-02 by Codex

- Added game-specific `pxb7/arknights-list` and `pxb7/arknights-detail`; both return platform facts only and contain no valuation profile or budget defaults.
- Verified the list endpoint response shape as `data.list[]`, with pagination tokens in `data.properties`; response `price` is cents while the price-filter values are CNY.
- Arknights `showTitle` contains delimited sections for `精二六星`, `精一六星`, `六星干员`, `联动干员`, and `时装`. Missing sections must remain partial instead of being inferred.
- Arknights detail DOM also exposes public verification-image URLs. The adapter preserves them as `verificationImageUrls` and emits `operatorProgression` plus `progressionEvidence`; the current public report does not expose dedicated mastery/module values, so both remain `not_exposed` until final verification.
- OpenCLI 1.8.0 `page.fetchJson` redeclares an internal `request` identifier on a second same-page call. Arknights list pagination therefore performs all page-token requests inside one browser IIFE; the 60-row regression returned 60 unique listings with prices bounded by the requested ceiling.

## 2026-05-23 by Codex

- Pxb7 account detail pages are browser-visible but may be protected by Aliyun WAF. This repo-managed ZZZ adapter uses the user's browser-backed COOKIE session and stores no cookie values.
- Adapter command: `opencli pxb7 zzz-detail https://www.pxb7.com/product/2187082765844721999/1 -f json`.
- Verify command: `opencli browser zzz-verify verify pxb7/zzz-detail --strict-memory`.
- ZZZ asset cards under the rendered detail report expose status badges like `2+1\nLv. 60\n雅`; the adapter normalizes `雅` to `星见雅` and emits shallow `agentStatuses`.
- Important parser pitfall: total S-agent count must prefer the title phrase `14个S级代理人` or the asset section count, not the first `S级代理人`-adjacent digit from `2命雅`.
- Important parser pitfall: binding fields must prefer the current product title / `详情附图【...】` tags before falling back to full-page text. Full-page text can include related products or repeated platform text with conflicting email labels.
- ZZZ resource pitfall: `菲林底片` is a polychrome-like numeric field for pull estimation, not a 1:1 tape. Use `(菲林 + 菲林底片) / 160 + 加密母带` for conservative ZZZ pull estimates unless the page exposes additional tape fields.
