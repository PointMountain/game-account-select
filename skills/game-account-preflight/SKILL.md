---
name: game-account-preflight
description: 游戏账号 skill 执行前准备和环境校验。检查 Node、git、gh、opencli 和浏览器路由；chrome-use 扩展桥可用时独占浏览器主路径，不再探测 web-access/CDP，并支持禁止交互式授权的无人值守模式。
argument-hint: "[--json|--strict|--browser|--unattended|--opencli-adapters]"
---

# Game Account Preflight Skill

## 作用

在 `game-account-select`、游戏估值 skill、社区更新 skill 或生成器执行前运行。它负责确认配套 skill、本地工具、联网能力和安全边界，避免执行到一半才发现缺依赖。

## 必须读取

- `references/preflight-checklist.md`
- `../game-account-toolkit/references/dependency-state-machine.md`
- `../game-account-toolkit/references/platform-access-policy.md`
- `../game-account-toolkit/references/skill-io-contract.md`

## 执行

运行：

```bash
node skills/game-account-preflight/scripts/preflight.mjs --json
```

如需要浏览器，追加 `--browser`。该检查先验证 `chrome-use` 扩展 relay；一旦可用，就冻结 `browser_route.selected_transport: chrome_use_extension`，跳过 `web-access` 和 remote-debugging 探针，避免双重初始化与授权弹窗。

用户不在电脑前、后台执行或明确要求无人值守时使用 `--unattended`（它隐含 `--browser`）。这个模式禁止 CDP 兜底：若 relay 不可用，预检会停止浏览器路径并记录需要用户恢复扩展连接，不会调用 `web-access`。只有普通交互模式中 relay 确实不可用时，才检查 `web-access` + Chrome remote debugging；启动或授权 CDP 前仍需用户在场。

如需要确认仓库托管的 Pxb7/PZDS OpenCLI adapter 是否已同步到本机，追加 `--opencli-adapters`。

## 输出

必须先把 `<preflight_report>` 显示给用户，再继续后续 skill 输出。即使全部检查通过，也要保留这段报告，方便用户确认本次运行使用了哪些本地能力：

```xml
<preflight_report>
  <ok>true|false</ok>
  <browser_route format="json">{}</browser_route>
  <checks format="json">[]</checks>
  <missing_optional format="json">[]</missing_optional>
  <missing_required format="json">[]</missing_required>
  <manual_actions format="json">[]</manual_actions>
  <safe_auto_actions format="json">[]</safe_auto_actions>
</preflight_report>
```

## 安全边界

- 不静默安装全局工具。
- 不静默安装或修改 Codex skill。
- 不绕过 Chrome 授权、验证码、登录墙或平台风控。
- `browser_route.selected_transport` 一旦选定，本轮不再初始化另一条浏览器传输；chrome-use 成功后不得加载 `web-access` 或运行它的 `check-deps.mjs`。
- `--unattended` 下禁止尝试 `web-access`/CDP，即使本机安装了该 skill。
- 对缺失的 `opencli`、`chrome-use`、`web-access` 或 Chrome remote debugging 只输出可执行安装/授权指引。
- 对缺失或版本不一致的仓库托管 OpenCLI adapter，只输出安装脚本指引；不静默写入 `~/.opencli`。
