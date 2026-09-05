# 估值输出与执行示例

示例命令：

```bash
node skills/game-account-select/scripts/parse-selection-profile.mjs --request "明日方舟限定/联动多，1000元左右，螃蟹" --json
node skills/game-account-arknights/scripts/score-listings.mjs --input <listings.json> --request "战力优先，3000元左右"
npm run query:ego -- --operation pxb7/arknights-list --task-space <run-id> --min-price 800 --max-price 1200 --limit 20 --json
npm run query:ego -- --operation pxb7/arknights-detail --task-space <run-id> --input <url-or-id> --json
npm run query:ego -- --operation pzds/arknights-list --task-space <run-id> --min-price 800 --max-price 1200 --limit 20 --json
npm run query:ego -- --operation pzds/arknights-detail --task-space <run-id> --input <url-or-id> --json
node skills/game-account-arknights/scripts/run-dual-platform-selection.mjs --request "限定多，1000元左右" --details-per-platform 10 --display-per-platform 10 --out /tmp/arknights-dual.json --report-out /tmp/arknights-dual.md
```

双平台执行器统一使用 ego-ops operation，并在外层 selector 创建的单一 ego-browser task space 内完成。把任务卡、operation、知识状态、task space 和验证方式写入 `platform_attempts`；结束后用 `completeTaskSpace` 生成 `cleanup_reports`。

默认每个平台先取 20 个列表样本，再择优复核 10 个详情、展示 10 个候选。盼之列表为详情目标预留一倍余量，并继续受显式 `--limit`、批数及单次最多 60 个的边界限制；缺失详情仍由质量门禁拒绝，不能以预取余量代替验证。




## 独立基础维度

- `rarity`：限定/联动获取类型与收藏稀缺度。
- `combat`：当前社区推荐核心的有效战力、常驻图使用价值和六类推图职能覆盖；不得退化成干员数量榜。
- `progression`：优先计算超大杯/核心干员对应的精二、专精、模组，再计算一般养成。
- `progression_evidence`：分别记录精二/精一、专精、模组的来源状态和验号图；未知专精/模组增量按 0 分，不推定满练。
- `resources`：合成玉、源石、寻访凭证等可量化抽卡资源。
- `skins`：时装收藏；不得替代稀缺干员。
- `price_efficiency`：价格与本轮预算的匹配；不改变账号固有资产质量。
- `risk_penalty`：区服、实名、找回、验号和保障事实，按本轮风险容忍度施加。
- `missing_data_penalty`：缺失详情的置信与评分惩罚。


## 输出

必须输出 `<game_account_evaluation>`，并保留：

- 挂牌的 `published_at`（上架时间）和 `platform_verified_at`（平台验号时间）；两者分开显示，缺失写“未披露”，禁止用抓取时间替代。
- `platform_shortlists.pxb7` 与 `platform_shortlists.pzds` 两个独立结果段，以及一个可为空的 `best_value_listing` 跨平台第一名。
- 用户可见 `final_response` 必须是确定性 Markdown 表格；每个平台默认详情复核 10 个、最多展示 10 个，并逐行保留商品编号/链接。候选不足 10 个时展示全部并说明覆盖缺口；显式传入数量参数仍可覆盖默认值。`presentation.per_platform_rendered` 必须与最终文案实际出现的候选一致。
- 预算附近无完整满足项时必须明确写“预算内完整满足全部硬条件：0 个”，展示最多 5 个预算内 `near_match_listings` 后再展示最多 5 个 `budget_breakthrough_listings`；扩价项不得隐藏预算内对照项。
- 上述跨平台预算分层摘要的数量独立于每个平台的 10 行候选表，不得用摘要上限截短平台清单。
- `request_provenance` 分开保存用户原话与推导画像输入；`delivery_contract.final_response_sha256` 必须匹配最终报告，且 `required_sections` 至少包含预算分层、螃蟹、盼之和 Self-improve。
- 当任一平台只有近似项时，状态必须为 `near_match_only` / `list_only_unverified` 并解释缺口；不得为了凑双平台而伪造“符合条件”。

```yaml
arknights_score:
  base_dimensions:
    rarity: number
    combat: number
    progression: number
    resources: number
    skins: number
    price_efficiency: number
  profile_score: number
  asset_quality_score: number
  asset_score: number # 兼容旧消费者，等于 asset_quality_score
  resource_score: number # 兼容别名
  collection_score: number # 兼容别名
  progress_score: number # 兼容别名
  price_score: number # 兼容别名
  risk_penalty: number
  applied_risk_penalty: number
  missing_data_penalty: number
  confidence_penalty: number # 兼容别名
  playability_penalty: number
  push_readiness:
    status: ready|partial|not_ready|unverified
    score: number
    ready_recommended_count: number
    role_coverage_count: number
    missing_roles: string[]
  combat_breakdown:
    meta_core_score: number
    role_coverage_score: number
    roster_depth_score: number
    ready_recommended_operators: string[]
    unready_meta_operators: string[]
  final_score: number
  hard_filter_passed: boolean
  hard_filter_reasons: string[]
  budget_tier: primary|flex_budget|excluded_price|unscoped
  confidence: low|medium|high
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
```
