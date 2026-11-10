---
game: zenless-zone-zero
operation: refresh-evidence
status: partial
last_verified: null
---

# 刷新绝区零社区证据

## 何时做

在筛选账号**之前**做。workflow 第 2 步运行 `scripts/freshness.mjs --game <game>`，退出码为 3（`refresh_required: true`）时触发，常见原因有：快照超过 7 天、游戏版本未确认、名单信号过期。用户反馈数据过时，或查询后发现候选里有未覆盖的角色/装备时，也要做（只针对这些资产定向查）。社区取证默认不超过 8 分钟；超时就带着过期数据继续筛选，并把推荐置信度限到 medium。

## 要维护的事实

当前版本虚狩名单、限定 S 代理人、配队（影画 mindscape 断点）、新代理人的专武名（只记平台页面或可靠资料确认过的写法）。写入：`game.json`（void-hunters/limited 信号）、`data/signature-engines.json`、`evidence.md`。

## 步骤

1. 先核实当前版本号；版本未知时不写“最新”。
2. 动态页面经 ego-ops / ego-browser，在本轮 task space 里读取正文、字幕或清晰图表。搜索卡片和标题只能当入口，不能当依据。官方机制/获取方式和社区强度判断分开记录。
3. 强度或配队结论需要至少两位独立作者，原始发布日期都在 7 天内，版本和玩法一致。转述同一作者算同源；有分歧就保留分歧，不覆盖。
4. 按 [knowledge-schema](../../../knowledge-schema.md) 写回：名单和信号改 `game.json`，来源与局限写 `evidence.md`，机器证据写 `data/community-evidence.json`。不要只改 `updated_at` 来“刷新”旧结论。
5. 不论成功与否，都在 `data/community-evidence.json` 写 `last_refresh_attempt: { date, outcome: refreshed|partial|failed, note }`。当天已经尝试过时，freshness 不再要求重复刷新（状态为 `stale_refresh_attempted_today`），但置信度上限仍是 medium。只有真的拿到新证据时，才更新 `updated_at`、`version_context` 和信号的 `as_of`。
6. 跑 `node "$GAME_ACCOUNT_SKILL_DIR/scripts/verify.mjs"`；开发仓库再跑完整 `npm run verify:skills`。如果是在筛选中途刷新的，把同一批候选改前、改后的 shortlist 排序都写进报告。

## 成功标准

每条当前主张都能追到两个 7 天内的独立来源；做不到时 `claims` 保持为空并写明局限，候选继续标为“待核实”。

## 证据

2026-11-09 的验收运行只读到来源入口，没有拿到可执行的当前强度主张（见仓库 `changelogs/2026-11-09-single-skill.md`），所以状态是 partial。
