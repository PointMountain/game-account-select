# 社区证据更新流程

updated_at: 2026-05-16

## 输入 JSON

明日方舟运行时使用 `schema_version: 1`，必填 `game`、`version_context`、`sources` 和 `claims`。source 必须有独立作者标识 `publisher`、URL、`published_at`、`observed_at`、`content_kind`、`excerpt` 和版本。可用于当前估值的 content_kind 为 body/transcript/article_image/official_data；标题不能支持估值。

claim 包含 `id`、`kind: operator_valuation`、干员 `subject`、`contexts: [story|roguelike|high_difficulty]`、`status: supported|disputed|pending`、`as_of`、版本、`source_ids` 和 `values`。values 只包含0–100的 combat_value/story_value、meta_tier、roles、requirements；requirements 的 elite 为0–2，mastery/module 为0–3。保留相反意见为 disputed，不以覆盖写入消除分歧。两条不同URL不等于两位独立作者，转述同一原作者归为同源。

运行时逐条检查来源与主张日期、玩法、版本、独立作者和冲突。没有满足门槛的主张时允许 `claims: []` 并明确局限，不能把读取成功冒充当前知识完整。`--write` 同时保存机器JSON和Markdown；先校验结构，JSON是权威输入。

下面的旧格式仍支持生成供人阅读的Markdown，不提供运行时估值覆盖：

```json
{
  "updated_at": "2026-05-16",
  "community_confidence": "medium",
  "source_coverage": {
    "bilibili": "limited",
    "youtube": "not_checked",
    "douyin": "failed"
  },
  "sources": [
    {
      "title": "source title",
      "url": "https://example.com",
      "note": "why it matters"
    }
  ],
  "consensus": {
    "high_value_assets": ["asset"],
    "medium_value_assets": [],
    "low_value_or_trap_assets": ["count-only listings"],
    "risk_factors": ["binding unknown"]
  },
  "limitations": ["Douyin timed out"]
}
```

## 写入规则

- 不直接覆盖旧知识表；结构化主张通过运行时门槛覆盖对应玩法。估值修改沿本轮授权走候选、固定回归和回滚凭据。
- 默认只输出到 `--out` 目录；要更新真实 `references/community-evidence.md` 必须显式传 `--write`。
- 来源失败必须写入 limitations，不得假装覆盖。
- 只有搜索结果、标题或片段时，`community_confidence` 最高为 `medium`。
- 没有可复查链接时，`community_confidence` 最高为 `low`。

## 推荐刷新节奏

- 大版本或新卡池：立即刷新。
- 真实买号筛选：默认 7 天内快照可复用；全球同步进度游戏应尝试 YouTube 作为独立长视频来源。
- 常规使用：若对应游戏 skill 明确放宽，可在 14 天内复用；不要继续把 30 天作为买号默认窗口。
- 用户样本出现未覆盖角色/装备/资源体系：执行临时刷新。
