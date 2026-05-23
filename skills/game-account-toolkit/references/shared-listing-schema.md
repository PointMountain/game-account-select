# 通用账号挂牌 schema

```yaml
listing:
  platform: string
  game: string
  url: string
  title: string
  price: number
  currency: CNY
  server: string | null
  account_type: string | null
  published_at: string | null
  view_count: number | null
  want_count: number | null
  discount_text: string | null
  guarantee_tags: string[]
  verification_tags: string[]
  binding_tags: string[]
  email_transfer_status: unbound|unverified_email_included|verified_email_included|not_included|cancelled|unknown|null
  recommendation_tier: primary|flex_budget|risk_backup|excluded|null
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
  skins_or_cosmetics: object[]
  progression: object
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
  started_at: string | null
  duration_ms: number | null
  wait_budget_ms: number | null
  status: success|partial|empty_result|blocked|login_required|timeout|error
  result_count: number
  error_text: string | null
  fallback_used: string | null

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

score:
  hard_filter_passed: boolean
  asset_score: number
  resource_score: number
  price_score: number
  risk_penalty: number
  final_score: number
  explanation: string[]
```

## 字段原则

- 原始文本保留用于追溯，但推荐时必须引用结构化字段。
- 缺失字段不能当作好消息，应降低数据完整度分。
- 邮箱未绑定、邮箱未实名出售应结构化为低找回风险信号；邮箱实名出售、邮箱不出售、邮箱已注销或状态不明必须保留原始标签并进入人工确认。
- 详情页能读到角色卡片角标时，必须保留 `game_assets.agent_statuses`。绝区零在螃蟹/盼之详情中使用 `{"代理人":"x"}` 或 `{"代理人":"x+y"}`，其中 `x` 是影画/命座数，`+y` 是对应专属音擎数量；只有 `x` 时不能直接推断有专武，但也不能直接判定无专武，必须同步保留 `game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name` 供游戏 skill 用本地专武表交叉确认。
- 主推荐、价格浮动备选、风险备选和排除项都必须保留 `url`；价格浮动备选应写入 `recommendation_tier: flex_budget` 和 `budget_delta`。
- 社区证据工具超时或正文不可读时，必须记录 `community_attempt` 和 `fallback_used`，不能只在最终文案里笼统说“未覆盖”。
- 不同游戏的 `game_specific` 由对应游戏 skill 定义。
- 最终推荐必须能解释“为什么入选”和“为什么可能不买”。
