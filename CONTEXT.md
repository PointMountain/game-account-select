# Game account selection domain

This repository ships one agent skill, `game-account-select`, that screens game-account listings on trading sites for a user's request. Experience is organised along two keys — the trading **site** and the **game** — so adding a game or site means adding a data directory, not a new skill.

## Canonical terms

### Site

A trading website (currently `pxb7`, `pzds`). `references/sites/<site>/index.md` holds facts shared across that site's games (game IDs, URL shapes, field names, rate limits, health checks). Each `operations/<game>-list|detail.md` is one verified or documented ego-ops operation.

### Game

`references/games/<game>/` holds durable, user-independent screening knowledge: what assets matter, common traps, risk signals, the `game.json` signal table the shortlist script reads, and dated community evidence.

### Operation status

`documented` (written down, never run), `partial` (ran with gaps), `verified` (succeeded end-to-end; carries `last_verified`). The query runner refuses non-verified operations (`operation_documented_only`). Files without a status are legacy verified files.

### Selection profile

The normalized, run-only interpretation of the current request: budget, must-haves, weights, server, risk tolerance. It drives the shortlist but is never persisted.

### Shortlist

`scripts/shortlist.mjs` applies hard filters, scores listings from `game.json` signals plus price efficiency, splits by budget tier and site, and lists missing fields instead of rewarding them. It is a screening aid; the agent still reads details before recommending.

### Writeback

After a run, reusable facts go to exactly one owner: site behaviour → the site operation or site index; game judgement → the game directory. Only real successes update `last_verified`. See `references/ops-model.md`.

## Invariants

- All live page access routes through `ego-ops` operations executed by `ego-browser`; no other browser or fetch stack.
- Unsupported site × game combinations are reported as coverage gaps, never filled by a fallback.
- Unknown or missing fields receive zero positive credit and stay visible.
- Run-only preferences and unverified valuation changes are never persisted.
