## 2026-08-02 by Codex

- Added game-specific `pzds/arknights-list` and `pzds/arknights-detail`. They read public platform facts only and contain no budget, valuation weight, cookie, token, or user preference.
- The confirmed Arknights list route is `goodsList/84/6`; `/6` is the catalogue segment, while `84` is the game id. The adapter reads the rendered Vue `goodsList`, performs a bounded low-frequency pagination scan, then applies the dynamic `minPrice` / `maxPrice` range locally to the returned facts.
- The site's arbitrary price-range component can currently return an empty list even while the unfiltered feed contains matching prices. Do not equate that response with no market supply. Keep the natural feed intact, expose loaded/matching row counts and any partial-scan reason, and let the caller describe the observed coverage rather than claim market exhaustion.
- Arknights `loadMore` is rate-limited to one attempt per 1.2 seconds. If a later page returns 429, throws, or makes no progress after the natural page has loaded, stop immediately and return already-rendered traceable rows with `status.paginationPartial=true`; callers must label coverage partial instead of retrying the same path.
- Arknights details use Nuxt `detailsData` plus `metadataModel.resources`. `publishedAt` comes from `onStandTime`; `status.verifiedAt` comes only from `verifyTime` and is left null when the platform does not expose it.
- The Arknights detail page does not populate `metadataModel.resources` while the default “详情” tab is active. The adapter must click the visible “游戏资产” tab once and wait up to 8 seconds for resources; an empty pre-click array is not evidence that the account has no operators.
- On Arknights details, `.scroll-item_box[title]` under “游戏资产 → 干员” carries the operator name, `.scroll-item_corner` carries `精二/精一`, `data-track-click.metadataId` carries the `MR1...` resource id, and `img.scroll-item_cover` carries the card image URL. Merge this DOM grid with `metadataModel.resources`; either source can arrive first, so a reported `精二` total must not be accepted while the named operator list is silently empty.
- `operatorImageUrls` is index-aligned with `operatorNames`. This shallow parallel-array contract preserves one visible card image per named operator while keeping the OpenCLI row at 12 top-level keys and nesting depth at most one.
- Adapter commands: `opencli pzds arknights-list --minPrice 800 --maxPrice 1300 --limit 20 -f json` and `opencli pzds arknights-detail MRHP2E -f json`.
- Verify commands: `opencli browser gas-arknights-pzds-verify verify pzds/arknights-list --strict-memory` and `opencli browser gas-arknights-pzds-verify verify pzds/arknights-detail --strict-memory`.

## 2026-05-23 by Codex

- PZDS account detail pages expose visible per-agent title nodes in the rendered DOM. This repo-managed ZZZ adapter uses the user's browser-backed COOKIE session and stores no cookie values.
- Adapter command: `opencli pzds zzz-detail QLA18X -f json`.
- Verify command: `opencli browser zzz-verify-pzds verify pzds/zzz-detail --strict-memory`.
- `agentStatuses` comes from visible title nodes such as `0+1\n星见雅`, not from aggregate S-agent or S-W-engine counts.
