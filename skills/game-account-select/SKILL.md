---
name: game-account-select
description: 在螃蟹（pxb7）、盼之（pzds）等交易网站主动筛选游戏账号。先把预算和偏好冻结为本轮画像，再通过已验证的浏览器操作读取列表和详情，按本轮目标筛选、排序，交付带来源、风险和缺口的候选清单。经验按“站点”与“游戏”积累，新增游戏时只加数据目录。用于找号、比较账号、评估单个商品链接，或维护这些经验。
argument-hint: "[游戏] [预算] [偏好/硬条件] [平台]"
---

# Game Account Select

> 安装/配置 Agent：先读 [全局前置提示词](references/global-agents-prompt.md)，按授权处理。普通使用直接从下方开始。

帮用户在交易网站上“大海捞针”：主动找到符合条件的账号，并说清楚每个候选的来源、风险和缺失字段。不替用户购买、付款或联系卖家。

## 经验路由

经验按两个主键积累，见 [ops-model](references/ops-model.md)：

- **site**：先读 [sites/index](references/sites/index.md)，只读本轮站点的 `index.md` 和 `<game>-list` / `<game>-detail` operation。
- **game**：先读 [games/index](references/games/index.md)，只读本轮游戏的 `index.md`；筛选脚本会读它的 `game.json`。
- 整体流程：[workflow](references/workflow.md)。游戏或站点还没收录时，按其中「新增游戏或站点」处理，不新建 skill。

## 执行

1. **画像**：用 `scripts/profile.mjs` 解析用户原话并展示结果。只有缺游戏、缺预算或目标真的冲突时才追问。画像只在本轮有效。
2. **数据新鲜度**：运行 `scripts/freshness.mjs --game <game>`。需要刷新（退出码 3）时，先按该游戏的 `operations/refresh-evidence.md` 更新版本、名单和社区证据，再开始筛选，避免用过期的数据排序。刷新失败时记录这次尝试，带着旧数据继续，交付时写明数据日期，置信度最高为 medium。
3. **覆盖计划**：未指定平台时，螃蟹和盼之都要读。对应的 site operation 不是 verified 时，只记缺口，并请用户提供链接或截图。
4. **查询**：先跑 `scripts/preflight.mjs --browser`，再用 `scripts/query.mjs` 读列表和短名单详情。全程只经 ego-ops / ego-browser，复用同一个 task space，结束时用 `scripts/cleanup.mjs` 精确清理。遇到验证码、用户接管或商品对不上时停止。
5. **筛选**：用 `scripts/shortlist.mjs` 按硬条件过滤、按本轮目标初排，再对照游戏 index 的“看什么 / 常见坑”复核前几名。分数只用来排序；缺失字段不算利好。
6. **交付**：按 workflow 第 6 步。预算分层，两个平台各一张表。每个候选带链接、上架时间、验号时间（缺失写“未披露”）、风险和需要人工确认的问题，并写明本轮使用的数据日期。

```bash
node skills/game-account-select/scripts/profile.mjs --request "绝区零 800元左右 虚狩多 低风险"
node skills/game-account-select/scripts/freshness.mjs --game zenless-zone-zero
node skills/game-account-select/scripts/query.mjs --operation pzds/zzz-list --task-space gas-zzz-1 --max-price 1000 --task-space-disposition keep --json
node skills/game-account-select/scripts/shortlist.mjs --profile profile.json --listings pxb7.json --listings pzds.json --markdown
node skills/game-account-select/scripts/cleanup.mjs --task-space <id> --json
```

## 自动沉淀（完成、失败或中断都要做）

按顺序：读取经验 → 用当前页面复核 → 执行 → 对照成功标准 → 写回唯一归属 → 同步索引 → 报告。格式见 [knowledge-schema](references/knowledge-schema.md)。

- 站点事实、URL 规则、解析坑写进 `sites/<site>/`；资产名单、估值坑、风险词写进 `games/<game>/`。同一件事只写一处。
- 真实查询完整成功时刷新对应 operation 的 `last_verified`；部分成功只记录观察到的事实。修解析问题时先加一个能复现问题的失败样例。
- 用户的预算和偏好永远不写入；强度结论需要两个 7 天内的独立来源。
- 写完跑 `npm run verify:skills`。没有新知识要说明原因；写入或校验失败就报告“未沉淀”。这是 Agent 需要遵守的工作协议，不是后台钩子，也不授权提交、推送或在平台上做写操作。
