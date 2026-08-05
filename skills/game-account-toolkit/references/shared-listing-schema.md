# 通用账号挂牌 schema

```yaml
run_artifact:
  run_id: string
  started_at: string
  finished_at: string | null
  game: string
  target_skill: string
  user_request: string
  selection_profile: selection_profile
  profile_confirmation: profile_confirmation
  profile_isolation: profile_isolation
  success_criteria: object
  coverage_plan: object
  coverage_gaps: object[]
  platform_attempts: platform_attempt[]
  community_attempts: community_attempt[]
  platform_shortlists:
    pxb7: platform_shortlist
    pzds: platform_shortlist
  dual_platform_coverage: object
  best_value_listing: listing | null
  recommendations: listing[]
  backup_listings: listing[]
  near_match_listings: listing[] # failed an explicit hard condition; never present as qualified recommendations
  excluded_listings: listing[]
  knowledge_update_candidates: knowledge_update_candidate[]

platform_shortlist:
  status: qualified|near_match_only|list_only_unverified|empty
  candidate_count: number
  detail_verified_count: number
  qualifying: listing[]
  near_matches: listing[]
  list_only_candidates: listing[]
  display_candidates: listing[]
  user_visible_note: string

selection_profile:
  budget:
    target: number|null
    primary_min: number|null
    primary_max: number|null
    flex_min: number|null
    flex_max: number|null
  objective: collector|combat|resource|balanced|custom
  priorities:
    rarity: number
    combat: number
    progression: number
    resources: number
    skins: number
    price_efficiency: number
  must_have: string[]
  exclusions: string[]
  soft_preferences:
    - type: account_recency
      preference: avoid_stale_roster|manual_account_recency_check
      source_text: string
      verification: roster_recency_and_manual_account_history
  server_preferences: string[]
  hard_conditions: string[]
  risk_tolerance: low|medium|high|unknown
  platforms: string[]
  assumptions: string[]
  clarification_required: string[]
  confirmation_required: boolean
  persistence_scope: run_only

budget_expansion:
  enabled: boolean
  trigger: no_in_budget_hard_condition_match
  mode: bidirectional_first_satisfying_band
  directions: [lower, higher]
  max_price: number | null
  authorization: default_fallback|user_explicit|disabled_by_user|not_applicable

profile_confirmation:
  status: needs_clarification|confirmed
  confirmed_at: string|null
  confirmation_mode: automatic_complete_profile|user_confirmed_conflict|null
  profile_digest: string
  clarification_required: string[]

profile_isolation:
  persistence_scope: run_only
  durable_updates_from_profile: []
  rule: string

success_criteria:
  game: string
  budget:
    primary_max: number | null
    flex_max: number | null
  hard_conditions: string[]
  soft_preferences: string[]
  risk_tolerance: low|medium|high|unknown
  minimum_source_coverage:
    platforms: string[]
    community_sources: string[]
  completion_conditions: string[]

coverage_plan:
  intent_summary: string
  source_tasks:
    - id: string
      type: platform_listing|platform_detail|community_evidence|user_input
      source: string
      priority: required|preferred|supplemental
      start_path: verified_adapter|natural_navigation|chrome_use_dom|browser_dom|user_material|search
      success_signal: string
      fallback_order: string[]
      wait_budget_ms: number
      required_fields: string[]
      confidence_cap_if_missing: high|medium|low
  completeness_gates: object
  stop_rules: string[]

coverage_gap:
  source: string
  task_id: string
  reason: timeout|empty_result|blocked|login_required|verification|wrong_game|adapter_missing|field_missing|not_checked
  evidence: string
  fallback_used: string | null
  confidence_effect: string
  user_visible_note: string

listing:
  platform: string
  game: string
  url: string
  title: string
  price: number
  currency: CNY
  server: string | null
  account_type: string | null
  published_at: string | null # 平台披露的上架/发布时间
  platform_verified_at: string | null # 平台验号报告的完成/更新时间
  view_count: number | null
  want_count: number | null
  discount_text: string | null
  guarantee_tags: string[]
  verification_tags: string[]
  binding_tags: string[]
  email_transfer_status: unbound|unverified_email_included|verified_email_included|not_included|cancelled|unknown|null
  recommendation_tier: primary|flex_budget|risk_backup|near_match|excluded|null
  budget_delta: number | null
  raw_text: string
  extracted_at: string
  source_status: success|partial|empty_result|blocked|login_required|timeout|error
  source_duration_ms: number | null
  source_error: string | null

game_assets:
  level: number | null
  characters: object[]
  weapons_or_equipment: object[]
  agent_statuses: object | null
  agent_status_source: asset_card_dom|title_dom|title_text|screenshot|user_text|unknown|null
  premium_currency: object
  estimated_pulls: number | null
  pull_estimate_formula: string | null
  skins_or_cosmetics: object[]
  progression: object
  progression_evidence:
    elite: platform_text_verified|image_verified|not_exposed|unknown
    mastery: platform_text_verified|image_verified|not_exposed|unknown
    module: platform_text_verified|image_verified|not_exposed|unknown
    verification_images: available|not_exposed
    verification_image_count: number
  verification_image_urls: string[]
  game_specific: object

risk:
  tos_risk: low|medium|high|unknown
  retrieval_risk: low|medium|high|unknown
  binding_risk: low|medium|high|unknown
  email_retrieval_risk: low|medium|high|unknown
  data_completeness: low|medium|high
  suspicious_price: boolean

platform_attempt:
  platform: string
  query: string
  url: string | null
  query_session_id: string | null
  browser_transport: chrome_use_extension|opencli_browser|web_access_cdp|none|null
  browser_targets: string[]
  started_at: string | null
  duration_ms: number | null
  wait_budget_ms: number | null
  status: success|partial|empty_result|blocked|login_required|timeout|error
  result_count: number
  error_text: string | null
  fallback_used: string | null
  list_attempts:
    - batch: number
      page: number
      limit: number
      logical_batch_count: number
      strategy: paged_requests|single_accumulating_scan
      status: success|error
      duration_ms: number
      result_count: number
      pagination_partial: boolean
      recovered_by_fallback: boolean
      fallback_used: string|null
      error_text: string|null
  cleanup:
    attempted: boolean
    command: string | null
    closed_sessions: string[]
    closed_targets: string[]
    residual_processes: string[]

community_attempt:
  source: string
  tool: string
  query: string
  url: string | null
  duration_ms: number | null
  wait_budget_ms: number | null
  status: success|partial|limited|failed|timeout|blocked|login_required
  result_count: number
  error_text: string | null
  fallback_used: string | null

knowledge_update_candidate:
  id: string
  type: platform_pattern|community_evidence|valuation_rule|risk_rule|adapter_gap|optimizer_fixture|evaluator_gate|output_format
  confidence: low|medium|high
  evidence: string[]
  observed_in:
    run_id: string
    listing_ids: string[]
    platform_attempt_ids: string[]
    community_attempt_ids: string[]
  suggested_targets: string[]
  requires_user_confirmation: boolean
  validation_commands: string[]
  apply_status: proposed|applied|verified_existing|deferred|rejected
  source_scope: platform_fact|community_evidence|stable_game_fact|selection_profile
  preference_scope: durable|run_only

score:
  hard_filter_passed: boolean
  base_dimensions:
    rarity: number
    combat: number
    progression: number
    resources: number
    skins: number
    price_efficiency: number
  profile_score: number
  asset_quality_score: number
  asset_score: number # backward-compatible alias of asset_quality_score
  resource_score: number # backward-compatible alias of base_dimensions.resources
  collection_score: number # backward-compatible alias of base_dimensions.skins
  progress_score: number # backward-compatible alias of base_dimensions.progression
  price_score: number # backward-compatible alias of base_dimensions.price_efficiency
  risk_penalty: number
  applied_risk_penalty: number
  missing_data_penalty: number
  confidence_penalty: number # backward-compatible alias of missing_data_penalty
  combat_breakdown: # game-specific when combat evaluation applies
    meta_core_score: number
    role_coverage_score: number
    roster_depth_score: number
    role_coverage:
      covered_count: number
      required_count: number
      missing_roles: string[]
    ready_recommended_operators: string[]
    unready_meta_operators: string[]
  push_readiness:
    status: ready|partial|not_ready|unverified
    penalty: number
    reason: string
  playability_penalty: number
  final_score: number
  explanation: string[]
```

## 字段原则

- 原始文本保留用于追溯，但推荐时必须引用结构化字段。
- `published_at` 与 `platform_verified_at` 是互相独立的来源事实；一个存在不能推导另一个。adapter 可保留站点原始字段名，但进入标准化挂牌和推荐结果时必须映射为这两个字段。
- 平台未披露相应时间时保留 `null`，用户可见结果显示“未披露”。`extracted_at`、run artifact 的 `started_at` / `finished_at`、OCR 或截图时间不得回填成上架或验号时间。
- 真实筛选必须先生成 `success_criteria` 和 `coverage_plan`；没有覆盖计划的结果只能视为临时分析，不能声称完成主动筛选。
- 缺失字段不能当作好消息，应降低数据完整度分。
- 邮箱未绑定、邮箱未实名出售应结构化为低找回风险信号；邮箱实名出售、邮箱不出售、邮箱已注销或状态不明必须保留原始标签并进入人工确认。
- 绝区零资源折算必须区分字段语义：`菲林` 和 `菲林底片` 都按 160:1 折算抽数，`加密母带` / `原装母带` / `邦布券` 按 1:1 折算。不要把 `菲林底片` 当作一张一抽；推荐记录应保留 `estimated_pulls` 和 `pull_estimate_formula`，并与卖家备注或截图交叉确认。
- 详情页能读到角色卡片角标时，必须保留 `game_assets.agent_statuses`。绝区零在螃蟹/盼之详情中使用 `{"代理人":"x"}` 或 `{"代理人":"x+y"}`，其中 `x` 是影画/命座数，`+y` 是对应专属音擎数量；只有 `x` 时不能直接推断有专武，但也不能直接判定无专武，必须同步保留 `game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name` 供游戏 skill 用本地专武表交叉确认。
- 主推荐、价格浮动备选、风险备选和排除项都必须保留 `url`；价格浮动备选应写入 `recommendation_tier: flex_budget` 和 `budget_delta`。
- 用户硬条件没有完全命中时，可输出 `near_match_listings` 解释市场上最接近的选择；每项必须保留失败的硬条件和差距，且不得混入 `recommendations`。
- 预算附近无硬条件完整项且用户未声明严格预算时，把低价/高价各自首个满足价档中经详情复核的账号写入 `budget_breakthrough_listings`，并记录 `expansion_direction`、`budget_delta`、`hard_filter_passed` 和来源 URL。`budget_comparison` 应把它与预算附近最佳近似项逐维比较，至少包含价格差、硬条件差距、实战、养成、资源和皮肤差异；不能只说“更贵所以更好”。
- 社区证据工具超时或正文不可读时，必须记录 `community_attempt` 和 `fallback_used`，不能只在最终文案里笼统说“未覆盖”。
- `chrome-use`、浏览器 CDP 或 OpenCLI 查询必须记录 `query_session_id`、`browser_transport` 和 `browser_targets`。筛选结束后必须运行查询清理脚本，并把 `cleanup.closed_sessions`、`cleanup.closed_targets`、`cleanup.closed_windows`、`cleanup.residual_processes` 写入 artifact。OpenCLI daemon 和 chrome-use relay 是共享服务，不应作为残留查询线程杀掉；只关闭本轮命名 session/target，以及基线之后新建且只含查询页/空白页的独立窗口。
- 平台或社区来源未完成时必须写入 `coverage_gaps`，并把置信度影响同步到最终推荐限制。
- 可复用观察先写入 `knowledge_update_candidates`。除非用户确认或本轮目标明确要求应用优化，否则候选不得直接改写游戏估值规则。
- `verified_existing` 只代表本轮再次验证了运行前已有的 adapter、fallback 或字段，不计入本轮 `applied`；只有本轮实际修改持久文件并跑过 `validation_commands` 才能标记 `applied`。
- `provenance_reconciliation` 从其它画像 artifact 恢复候选时，必须附 `validation.status: passed`、`method: canonical_rescore`、当前 `profile_digest`、验证命令/时间和覆盖全部目标的 `rescored_listing_ids`；否则 finalizer/evaluator 必须打回。
- `selection_profile` 只属于本轮。`profile_isolation.durable_updates_from_profile` 必须为空；预算、权重、区服/风险偏好和用户硬条件不得作为永久默认值或 valuation reference。平台字段、别名、脱敏 fixture、证据日期和稳定客观事实可成为 durable 候选。
- 不同游戏的 `game_specific` 由对应游戏 skill 定义。
- 最终推荐必须能解释“为什么入选”和“为什么可能不买”。
- 对依赖角色阵容推图的游戏，角色/稀有资产总数只能作为资产事实，不能直接代表战力。评分应同时检查社区推荐核心的实际养成、关键战斗职能覆盖和可用阵容深度；数据不足时标为 `unverified`，不得猜测“可推图”。
- 平台仅公开部分养成字段时，应逐字段记录证据状态并保留公开验号图 URL。`not_exposed` 不等于未养成，也不等于已养成；排序中的对应增量必须为 0，留到最终验号确认。
