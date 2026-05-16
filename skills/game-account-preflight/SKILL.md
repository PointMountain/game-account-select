---
name: game-account-preflight
description: 游戏账号 skill 执行前准备和环境校验。检查 Node、git、gh、opencli、web-access skill、浏览器 CDP 等依赖，能自动处理的给出安全操作，不能自动处理的输出安装指引。
argument-hint: "[--json|--strict|--browser]"
---

# Game Account Preflight Skill

## 作用

在 `game-account-select`、游戏估值 skill、社区更新 skill 或生成器执行前运行。它负责确认本地工具、联网能力和安全边界，避免执行到一半才发现缺依赖。

## 必须读取

- `references/preflight-checklist.md`
- `../game-account-toolkit/references/dependency-state-machine.md`
- `../game-account-toolkit/references/platform-access-policy.md`

## 执行

运行：

```bash
node skills/game-account-preflight/scripts/preflight.mjs --json
```

如需要浏览器/CDP，追加 `--browser`。

## 输出

必须输出 `<preflight_report>`：

```xml
<preflight_report>
  <ok>true|false</ok>
  <checks format="json">[]</checks>
  <missing_required format="json">[]</missing_required>
  <manual_actions format="json">[]</manual_actions>
  <safe_auto_actions format="json">[]</safe_auto_actions>
</preflight_report>
```

## 安全边界

- 不静默安装全局工具。
- 不静默安装或修改 Codex skill。
- 不绕过 Chrome 授权、验证码、登录墙或平台风控。
- 对缺失的 `opencli`、`web-access`、Chrome remote debugging 只输出可执行安装/授权指引。
