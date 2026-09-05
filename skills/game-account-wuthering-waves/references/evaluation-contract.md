# 估值输出与执行示例

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
wuthering_waves_score:
  asset_score: number
  resource_score: number
  team_score: number
  risk_penalty: number
  confidence_penalty: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
  rule_update_suggestion: string | null
```

示例：

```xml
<game_account_evaluation>
  <game>Wuthering Waves</game>
  <listing_id>来源账号编号</listing_id>
  <score format="json">{}</score>
  <confidence>low|medium|high</confidence>
  <community_comparison>strong alignment|partial alignment|conflict</community_comparison>
  <missing_fields format="json">[]</missing_fields>
</game_account_evaluation>
```
