# 社区证据更新流程

updated_at: 2026-05-16

## 输入 JSON

```json
{
  "updated_at": "2026-05-16",
  "community_confidence": "medium",
  "source_coverage": {
    "bilibili": "limited",
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

- 不覆盖游戏知识表和估值权重。
- 默认只输出到 `--out` 目录；要更新真实 `references/community-evidence.md` 必须显式传 `--write`。
- 来源失败必须写入 limitations，不得假装覆盖。
- 只有搜索结果、标题或片段时，`community_confidence` 最高为 `medium`。
- 没有可复查链接时，`community_confidence` 最高为 `low`。

## 推荐刷新节奏

- 大版本或新卡池：立即刷新。
- 常规使用：30 天内快照可复用，超过 30 天执行刷新。
- 用户样本出现未覆盖角色/装备/资源体系：执行临时刷新。
