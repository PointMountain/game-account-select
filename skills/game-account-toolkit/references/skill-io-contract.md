# 游戏账号 skill 输入输出契约

updated_at: 2026-08-02

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
  <published_at>平台披露的上架时间；未披露时为 null</published_at>
  <platform_verified_at>平台验号报告时间；未披露时为 null</platform_verified_at>
  <raw_text>卖家描述、OCR 文本或结构化摘要</raw_text>
  <assets format="json">标准化资产 JSON</assets>
  <risk format="json">绑定、实名、找回、验号、平台保障</risk>
</account_listing>
```

### `selection_profile`

自然语言请求先解析为本轮动态画像。预算和目标缺失/冲突时补问；字段完整时展示后自动冻结，只有冲突画像需要用户确认后冻结。该对象只能存在于 run artifact：

```yaml
selection_profile:
  budget:
    target: number|null
    primary_min: number|null
    primary_max: number|null
    flex_min: number|null
    flex_max: number|null
  budget_expansion:
    enabled: boolean
    trigger: no_in_budget_hard_condition_match
    mode: bidirectional_first_satisfying_band
    directions: [lower, higher]
    max_price: number|null
    authorization: default_fallback|user_explicit|disabled_by_user|not_applicable
  objective: collector|combat|resource|balanced|custom
  priorities:
    rarity: 0-100
    combat: 0-100
    progression: 0-100
    resources: 0-100
    skins: 0-100
    price_efficiency: 0-100
  must_have: string[]
  exclusions: string[]
  server_preferences: string[]
  hard_conditions: string[]
  risk_tolerance: low|medium|high|unknown
  platforms: string[]
  assumptions: string[]
  clarification_required: string[]
  confirmation_required: boolean
  persistence_scope: run_only
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
      "base_dimensions": {},
      "profile_score": 0,
      "asset_quality_score": 0,
      "asset_score": 0,
      "resource_score": 0,
      "risk_penalty": 0,
      "applied_risk_penalty": 0,
      "missing_data_penalty": 0,
      "combat_breakdown": {
        "meta_core_score": 0,
        "role_coverage_score": 0,
        "roster_depth_score": 0,
        "role_coverage": {
          "covered_count": 0,
          "required_count": 6,
          "missing_roles": []
        },
        "ready_recommended_operators": [],
        "unready_meta_operators": []
      },
      "push_readiness": {
        "status": "ready|partial|not_ready|unverified",
        "penalty": 0,
        "reason": ""
      },
      "playability_penalty": 0,
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

`top_listings`、备选和排除账号均应保留 `published_at` 与 `platform_verified_at`，用户可见清单分别标为“上架时间”和“平台验号时间”。缺失时显示“未披露”，不可用抓取时间或运行时间补齐。

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
- 预算、画像权重、区服偏好、风险容忍度和本轮硬条件不得写入永久知识或默认评分。违反时 evaluator/optimizer 必须打回。
- `budget_expansion` 是 run-only 查询策略：默认在预算附近无硬条件完整项时向低价和高价分别逐档寻找首个满足价档；用户明确要求严格预算时禁用。保留预算附近 `near_match_listings` 供差价比较，不得把某次扩展金额写成新默认预算。
- 新评分器必须继续输出 `asset_score`、`resource_score` 等旧字段别名，避免破坏现有游戏 skill；新实现以 `base_dimensions`、`profile_score` 和 `asset_quality_score` 为准。
- 角色数量不能替代实战可用性。适用的游戏 skill 应把社区推荐核心、角色实际养成状态和关键职能覆盖拆开输出；如果账号缺少基本推图能力，所有画像都应显示独立的 `playability_penalty`，但不能把某次用户画像固化成永久硬条件。
- 养成字段必须逐项区分 `verified`、`not_exposed` 和 `unknown`。未知专精/模组不得获得隐含加分；公开验号图片可作为 `verification_image_urls` 证据保留，但不能凭存在图片就推定图片未展示的字段。
