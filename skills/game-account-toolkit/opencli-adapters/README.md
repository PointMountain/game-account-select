# Repo-managed OpenCLI adapters

These files let users of this skill pack install the same game-specific Pxb7/PZDS adapters used during local development.

The adapter package is intentionally narrow:

- It groups command source by game under `games/<game>/clis/<site>/`.
- It keeps site-level memory and verify fixtures under `sites/<site>/`.
- It includes only public adapter source, endpoint notes, and verify expectations.
- It does not include cookies, tokens, raw HTML dumps, browser cache, screenshots, or personal account state.
- It installs into `~/.opencli` only when the user runs the installer with `--install`.
- Existing local files are not overwritten unless `--force` is passed.

Install or check from a checkout or installed skill folder:

```bash
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --check
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --install
```

After installation, verify with the user's logged-in/browser-backed OpenCLI environment:

```bash
opencli validate pxb7/zzz-detail
opencli validate pzds/zzz-detail
opencli browser zzz-verify verify pxb7/zzz-detail --strict-memory
opencli browser zzz-verify-pzds verify pzds/zzz-detail --strict-memory
```
