# 2026-11-09 合并为单一 skill：按站点 × 游戏积累经验

原来的 11 个 skill（主筛选、toolkit、preflight、四个游戏、generator、evaluator、optimizer、community-updater）合并为一个 `game-account-select`，重点是账号筛选。决策见 [ADR-0001](../docs/adr/0001-single-skill-site-game-experience.md)。

## 结构

- `references/sites/<site>/`：站点共享事实（游戏 ID、URL、字段、限流、健康检查）和 16 个 `<game>-list|detail` operation，从原 toolkit 的 ego-operations 迁来，保留 `status` 与 `last_verified`。
- `references/games/<game>/`：看什么、常见坑、`game.json` 信号表、社区证据和 `operations/refresh-evidence.md`（原 community-updater）。明日方舟限定/联动表、绝区零专属音擎表放在各自 `data/`。
- 新增游戏或站点：只加数据目录和 operation 文件，`verify-harness` 检查 manifest、知识文件、索引三者一致。

## 保留 / 删除

- 保留：ego-ops 查询器（`scripts/query.mjs`）、解析器、精确清理、preflight、画像解析；`status: documented` 的 operation fail closed。
- 改为轻量：四套游戏评分引擎与 finalizer 由一个数据驱动的 `scripts/shortlist.mjs` 代替（硬条件、预算分层、按站点分表、缺失字段只报告）。
- 删除：报告哈希交付契约、generator、evaluator、analyze-run 与学习凭据队列；经验写回改为 OPS 协议（`references/ops-model.md`、`knowledge-schema.md`）。
- 全局前置规则已写入 `~/.claude/CLAUDE.md`（安装提示词见 `references/global-agents-prompt.md`）。
- 同时删除旧的计划、产品文档、ADR 0001–0004 和旧 changelog；它们保留在本次改动之前的 git 历史中。

## 验证

- 离线：`npm run verify:skills`（harness 一致性、frontmatter、query-stack 策略、ego operation 与解析回归、shortlist 测试）。
- shortlist 用 `.harness/runs/20261109-skill-acceptance/` 的真实列表数据人工核对过绝区零与明日方舟排序。
- operation 的 `last_verified: 2026-11-09` 来自合并前同日的真实验收：四个游戏在两个平台共 16 个列表/详情 route，在同一个 task space 里都拿到了成功样本，并已精确清理。
  - 当时修复了 4 个问题：盼之鸣潮页面身份被截断摘要误判；摘要之后的验证提示可能被放行；documented operation 被误当成已验证；盼之绝区零的加密母带和资产总数漏读。
  - 前三项的回归在 `tests/live-acceptance.test.mjs`。
  - 那次只读到社区来源入口，没有拿到当前的强度主张，所以各游戏的 refresh-evidence 保持 partial。
- 本次合并没有跑新的 live ego-browser 查询。

## 筛选前的数据更新

- 新增 `scripts/freshness.mjs`，对应 workflow 第 2 步。筛选前会检查社区证据快照日期、版本是否确认、7 天内有没有有效主张，以及名单信号的 `as_of`。
- 数据过期时先跑 refresh-evidence，再开始筛选。刷新失败会写入 `last_refresh_attempt`，当天不重复刷新，推荐置信度最高为 medium。
- shortlist 报告开头会标明数据日期和置信度上限。
- 截至 2026-11-09，四个游戏都判定为需要刷新（快照日期分别是 2026-10-05 / 08-03 / 05-16 / 05-16，版本都未确认）。
