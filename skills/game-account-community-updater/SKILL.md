---
name: game-account-community-updater
description: 更新指定游戏账号 skill 的社区证据快照。动态社区页面统一用 ego-browser task space 读取与验证，也支持从 evidence JSON 写入本地 community-evidence.md 和 refresh report。
argument-hint: "[skill path] [evidence json]"
---

# Game Account Community Updater

## 作用

为已有游戏 skill 刷新社区证据，记录来源、覆盖、失败项、共识和局限。明日方舟的结构化主张可参与按玩法评分；用户已授权自动优化时，满足当前独立证据、固定回归与可回滚要求后继续规则更新，并展示实际变更。

## 执行前准备

先运行 `game-account-preflight`，并在刷新前显示 `<preflight_report>`。如果缺少浏览器或网络相关能力，记录降级范围；如果需要 B站、抖音、小红书等动态页面，必须遵循 toolkit 的 ego-browser 单一路由、task-space 生命周期和平台访问安全边界。

## 必须读取

- `references/update-workflow.md`
- `../game-account-toolkit/references/community-research-protocol.md`
- `../game-account-toolkit/references/ego-ops-query-contract.md`
- `../game-account-toolkit/references/operation-support-matrix.json`
- `../game-account-toolkit/references/skill-io-contract.md`

## 执行

确定性写入模式：

```bash
node skills/game-account-community-updater/scripts/update-community-evidence.mjs --skill skills/game-account-zenless-zone-zero --evidence evidence.json
```

默认不会覆盖仓库文件。写入真实 skill 时必须追加 `--write`；试运行或验证时使用 `--out /tmp/...`。

安全刷新模式：

1. 由 ego-ops 治理查询并用 ego-browser 获取少量高信号材料；同一刷新目标复用一个 task space，优先复用矩阵中的已验证 operation。没有对应 operation 时只能按 ego-ops 受控探索并记录 coverage gap，不能切换其它查询软件。
2. 按 `plan-community-refresh.mjs` 生成的玩法与干员缺口取证，把已读内容整理为 schema_version 1 evidence JSON。仅更新日期或增加标题链接不算证据刷新完成。
3. 运行脚本写入快照或输出到临时目录。

## 输出

必须输出 `<community_refresh_report>`，并明确失败来源和置信度。
