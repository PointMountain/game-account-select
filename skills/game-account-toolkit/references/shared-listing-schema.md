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
  raw_text: string
  extracted_at: string

game_assets:
  level: number | null
  characters: object[]
  weapons_or_equipment: object[]
  premium_currency: object
  skins_or_cosmetics: object[]
  progression: object
  game_specific: object

risk:
  tos_risk: low|medium|high|unknown
  retrieval_risk: low|medium|high|unknown
  binding_risk: low|medium|high|unknown
  data_completeness: low|medium|high
  suspicious_price: boolean

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
- 不同游戏的 `game_specific` 由对应游戏 skill 定义。
- 最终推荐必须能解释“为什么入选”和“为什么可能不买”。
