---
name: game-account-community-updater
description: 更新指定游戏账号 skill 的社区证据快照。支持执行时刷新，也支持从 evidence JSON 写入本地 community-evidence.md 和 refresh report。
argument-hint: "[skill path] [evidence json]"
---

# Game Account Community Updater

## 作用

为已有游戏 skill 刷新社区证据，避免本地估值机制落后。它负责记录来源、覆盖、失败项、共识和局限，不直接改评分权重，除非用户确认后再走规则更新。

## 执行前准备

先运行 `game-account-preflight`，并在刷新前显示 `<preflight_report>`。如果缺少浏览器或网络相关能力，记录降级范围；如果需要 B站、抖音、小红书等动态页面，必须遵循 `web-access` 和平台访问安全边界。

## 必须读取

- `references/update-workflow.md`
- `../game-account-toolkit/references/community-research-protocol.md`
- `../game-account-toolkit/references/skill-io-contract.md`

## 执行

确定性写入模式：

```bash
node skills/game-account-community-updater/scripts/update-community-evidence.mjs --skill skills/game-account-zenless-zone-zero --evidence evidence.json
```

默认不会覆盖仓库文件。写入真实 skill 时必须追加 `--write`；试运行或验证时使用 `--out /tmp/...`。

安全刷新模式：

1. 用 `opencli`、网页搜索或 `web-access` 获取少量高信号来源。
2. 把来源整理为 evidence JSON。
3. 运行脚本写入快照或输出到临时目录。

## 输出

必须输出 `<community_refresh_report>`，并明确失败来源和置信度。
