# 游戏账号 skill 输入输出契约

updated_at: 2026-05-16

## 设计原则

所有 game-account skill 都应遵循薄编排、文件化证据、显式边界和可验证输出。参考 `gsd-build/get-shit-done` 的可复查文档结构，需求、上下文、执行状态和验证结果分层存放，避免把所有逻辑塞进一个长 prompt。

## 标准输入标签

### `<game_account_request>`

用于主筛选或生成器入口。

```xml
<game_account_request>
  <game>游戏名或别名</game>
  <budget currency="CNY">预算范围</budget>
  <platforms>交易平台或用户提供的数据来源</platforms>
  <preferences>强度, 资源, 收藏, 低风险, 性价比</preferences>
  <risk_tolerance>low|medium|high</risk_tolerance>
</game_account_request>
```

### `<account_listing>`

用于单个账号或候选列表。

```xml
<account_listing>
  <id>来源内唯一标识或临时编号</id>
  <price currency="CNY">价格</price>
  <server>官服/B服/渠道服</server>
  <raw_text>卖家描述、OCR 文本或结构化摘要</raw_text>
  <assets format="json">标准化资产 JSON</assets>
  <risk format="json">绑定、实名、找回、验号、平台保障</risk>
</account_listing>
```

### `<community_evidence>`

用于执行时刷新或覆盖本地快照。

```xml
<community_evidence>
  <updated_at>YYYY-MM-DD</updated_at>
  <confidence>low|medium|high</confidence>
  <source_coverage format="json">{}</source_coverage>
  <sources format="json">[]</sources>
  <high_value_assets format="json">[]</high_value_assets>
  <trap_assets format="json">[]</trap_assets>
  <limitations format="json">[]</limitations>
</community_evidence>
```

### `<skill_generation_request>`

用于 `game-account-skill-generator`。

```xml
<skill_generation_request>
  <game>游戏名</game>
  <aliases format="json">[]</aliases>
  <known_assets format="json">[]</known_assets>
  <evidence_notes>可选社区证据摘要</evidence_notes>
  <slug>可选 ASCII slug</slug>
</skill_generation_request>
```

## 标准输出标签

### `<game_account_evaluation>`

每个游戏估值 skill 的核心输出。

```xml
<game_account_evaluation>
  <game>游戏名</game>
  <listing_id>账号编号</listing_id>
  <score format="json">
    {
      "asset_score": 0,
      "resource_score": 0,
      "risk_penalty": 0,
      "missing_data_penalty": 0,
      "final_score": 0
    }
  </score>
  <confidence>low|medium|high</confidence>
  <community_comparison>strong alignment|partial alignment|conflict</community_comparison>
  <highlights format="json">[]</highlights>
  <concerns format="json">[]</concerns>
  <missing_fields format="json">[]</missing_fields>
  <rule_update_suggestion>null 或文本</rule_update_suggestion>
</game_account_evaluation>
```

### `<recommendations>`

主筛选 skill 的排序输出。

```xml
<recommendations>
  <top_listings format="json">[]</top_listings>
  <excluded_listings format="json">[]</excluded_listings>
  <manual_checks format="json">[]</manual_checks>
  <limitations format="json">[]</limitations>
</recommendations>
```

### `<skill_quality_report>`

评估器输出。

```xml
<skill_quality_report>
  <skill_path>skills/game-account-example</skill_path>
  <score>0-100</score>
  <passed>true|false</passed>
  <blocking_issues format="json">[]</blocking_issues>
  <warnings format="json">[]</warnings>
  <suggested_fixes format="json">[]</suggested_fixes>
</skill_quality_report>
```

### `<community_refresh_report>`

社区更新 skill 输出。

```xml
<community_refresh_report>
  <skill_path>skills/game-account-example</skill_path>
  <updated_at>YYYY-MM-DD</updated_at>
  <confidence>low|medium|high</confidence>
  <sources_added>0</sources_added>
  <failed_sources format="json">[]</failed_sources>
  <output_path>写入位置</output_path>
</community_refresh_report>
```

## 降级规则

- 缺少社区证据时允许执行，但 `confidence` 最高为 `medium`。
- 只拿到搜索结果但没有正文/字幕/评论时，不能把单条标题升级为硬规则。
- 缺少绑定、实名、找回、平台保障时，必须扣风险或列入人工确认。
- 任何自动生成 skill 默认 `community_confidence: low`，直到通过社区更新和评估器。
