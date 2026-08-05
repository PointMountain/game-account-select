# Repo-managed OpenCLI adapters

These files let users of this skill pack install the same game-specific Pxb7/PZDS adapters used during local development.

The adapter package is intentionally narrow:

- It groups command source by game under `games/<game>/clis/<site>/`.
- It keeps site-level memory and verify fixtures under `sites/<site>/`.
- It includes only public adapter source, endpoint notes, and verify expectations.
- It does not include cookies, tokens, raw HTML dumps, browser cache, screenshots, or personal account state.
- It installs into `~/.opencli` only when the user runs the installer with `--install`.
- Existing local files are not overwritten unless `--force` is passed.
- `pxb7/arknights-list` / `pxb7/arknights-detail` and `pzds/arknights-list` / `pzds/arknights-detail` provide the same cross-platform selection facts. Detail commands return per-operator E2/E1 evidence, field-level progression availability, platform timestamps, and public verification-image URLs. Fields that are not exposed, such as mastery/module in current reports, remain `not_exposed` instead of being inferred.

Install or check from a checkout or installed skill folder:

```bash
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --check
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --install
```

After installation, verify with the user's logged-in/browser-backed OpenCLI environment:

```bash
opencli validate pxb7/arknights-list
opencli validate pxb7/arknights-detail
opencli validate pzds/arknights-list
opencli validate pzds/arknights-detail
opencli browser gas-arknights-pxb7-verify verify pxb7/arknights-list --strict-memory
opencli browser gas-arknights-pxb7-verify verify pxb7/arknights-detail --strict-memory
opencli browser gas-arknights-pzds-verify verify pzds/arknights-list --strict-memory
opencli browser gas-arknights-pzds-verify verify pzds/arknights-detail --strict-memory
opencli validate pxb7/zzz-detail
opencli validate pzds/zzz-detail
opencli browser zzz-verify verify pxb7/zzz-detail --strict-memory
opencli browser zzz-verify-pzds verify pzds/zzz-detail --strict-memory
```
