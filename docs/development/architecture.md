# 架构边界

| 层 | 位置 | 输入 → 输出 |
| --- | --- | --- |
| 入口 | `SKILL.md`、`references/workflow.md` | 用户原话 → run-only 画像、覆盖计划、交付 |
| 站点经验 | `references/sites/<site>/` | 站点 × 游戏 → 已验证的列表/详情 operation |
| 游戏经验 | `references/games/<game>/` | 资产 → 看什么、坑、信号表、证据 |
| 新鲜度 | `scripts/freshness.mjs` | 游戏证据日期、版本、名单 → 是否先刷新、置信上限 |
| 运行底座 | `scripts/preflight` `query` `cleanup` `parsers/` | operation → 标准化 listing、来源、能力缺口、精确清理 |
| 初筛 | `scripts/shortlist.mjs` | listing + 画像 + game.json → 分档候选与缺失字段 |

开发 Harness 位于仓库 `scripts/` 与 `docs/development/`，不随 skill 安装。

## 两个闭环

运行：需求 → 数据新鲜度（过期先 refresh-evidence）→ preflight → coverage → ego-ops/ego-browser → shortlist → 读详情 → 交付。

经验：运行结果 → 对照 operation 成功标准 → 写回唯一归属（站点或游戏）→ 同步索引 → 报告写回了什么。没有成功就不更新 `last_verified`。

决策见 [ADR-0001](../adr/0001-single-skill-site-game-experience.md)。
