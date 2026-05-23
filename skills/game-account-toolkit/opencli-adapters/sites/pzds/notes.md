## 2026-05-23 by Codex

- PZDS account detail pages expose visible per-agent title nodes in the rendered DOM. This repo-managed ZZZ adapter uses the user's browser-backed COOKIE session and stores no cookie values.
- Adapter command: `opencli pzds zzz-detail QLA18X -f json`.
- Verify command: `opencli browser zzz-verify-pzds verify pzds/zzz-detail --strict-memory`.
- `agentStatuses` comes from visible title nodes such as `0+1\n星见雅`, not from aggregate S-agent or S-W-engine counts.
