---
name: game-account-arknights
description: 明日方舟账号的通用动态估值与筛选能力。把限定/联动稀缺度、当前实战、养成、抽卡资源、皮肤、价格效率和风险拆成独立基础维度，再按本轮用户画像动态排序；预算、区服和收藏/战力偏好不会写成永久默认值。
---

# Game Account Arknights Skill

## 作用与边界

本 skill 负责明日方舟资产事实标准化、基础维度评分和基于本轮 `selection_profile` 的动态排序，不负责平台访问，也不替用户购买或联系卖家。

永久知识只保存稳定事实和彼此独立的评价维度。预算、目标、权重、区服偏好、风险容忍度和硬性条件只能存在于当次 run artifact；不得把“1000 元、限定优先、官服”等会话条件写回本文件或 references 作为默认规则。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `references/valuation-rules.md`
- `references/operator-knowledge.md`
- `references/operator-value-map.json`
- `references/collab-roster.json`
- `references/community-evidence.md`
- `references/changelog.md`

## 执行流程

1. 调用 `game-account-preflight` 并展示 `<preflight_report>`。
2. 用 `../game-account-select/scripts/parse-selection-profile.mjs` 解析自然语言。
3. 预算或主要目标缺失/冲突时只补问关键项；其余缺项用中性假设并写入 `assumptions`。
4. 查询前向用户展示画像。预算和目标完整时自动记录 `profile_confirmation` 和 digest，冻结为 run-only artifact 后继续，不要求用户先选择预算策略。
   - 只有 `objective_conflict` 或预算/目标真正缺失时才停止补问；`--profile-confirmed` 仅用于消解已经展示并由用户确认的复合目标冲突。
5. 主动找号必须同时运行螃蟹与盼之的明日方舟列表/详情 adapter。两边分别形成可见清单；某边没有完全符合项时仍要显示该平台的近似项或明确覆盖缺口，禁止把单平台结果写成完成态。
6. 平台 adapter 只读取价格、区服、资产、资源、挂牌/验号时间和风险事实；不得在 adapter 中决定账号是否值得买。
7. 用 `scripts/score-listings.mjs` 计算独立基础维度，再按冻结画像做跨平台统一排序；总榜可以选出任意平台的性价比第一，但不能吞掉另一平台清单。
8. 输出候选、风险、缺失字段、证据覆盖和人工验号项。
9. 默认先查本轮预算主区间和浮动区间；没有硬条件完整项时，两平台自动向更低价和更高价逐档扩展，各自在首个精确满足价档停止。只有用户明确要求严格预算才禁用；同时保留预算附近近似项，按收藏补齐与推图提升分别解释差价。
10. 用户给出明确资源数值时，将它冻结为本轮硬条件而不只是提高资源权重。例如“合成玉 10 万左右”解析为 `orundum:80000-120000`，“合成玉 10 万以上”解析为 `orundum:100000+`；未满足者只能进入近似候选并标明缺口。
11. 平台文本缺少低练度联动干员、但详情提供公开验号图时，调用 `scripts/verify-collab-images.mjs` 对干员页 OCR 复核；图中未找到仍只能记为未确认，不能把文本缺失直接等同于账号缺失。
12. 每个平台默认详情复核 5 个、表格展示 5 个；完全符合项不足时用明确标注的接近项或列表待复核项补足比较视野。候选确实不足 5 个时展示全部并说明覆盖缺口，不得把 artifact 中已有候选手工删成 1–2 个。
13. 数据采集结束必须由 `scripts/finalize-selection-run.mjs` 收尾：先用 `scripts/render-selection-report.mjs` 生成双平台 Markdown 表格，再运行 optimizer 和 raw-artifact evaluator，并把 `self_improve`、`presentation`、`quality_gate`、完整 `final_response` 和 sidecar 报告落盘。禁止绕过收尾器手写最终推荐。
14. 任何非 info optimizer finding 或 evaluator `redo_required` 都要继续修复/降级，不得口头声称“已总结经验”后仍把坏结果当完成态。
15. “不要陈年老号/断代仓库号”等账号级描述进入 `soft_preferences.account_recency` 和付款前人工复核，不得进入干员 `exclusions`；干员排除只允许精确名或至少两个字符的稳定别名匹配，禁止单字干员名反向命中整句描述。
16. PZDS 多批列表需求合并成一次 `single_accumulating_scan`，在同一浏览器页面内低频加载并记录 `list_attempts`；不得为第 2/3 批从头重复导航和扫描。PXB7 保留轻量分页请求。

示例命令：

```bash
node skills/game-account-select/scripts/parse-selection-profile.mjs --request "明日方舟限定/联动多，1000元左右，螃蟹" --json
node skills/game-account-arknights/scripts/score-listings.mjs --input <listings.json> --request "战力优先，3000元左右"
opencli pxb7 arknights-list --minPrice 800 --maxPrice 1200 --limit 20 -f json
opencli pxb7 arknights-detail <url-or-id> -f json
opencli pzds arknights-list --minPrice 800 --maxPrice 1200 --limit 20 -f json
opencli pzds arknights-detail <url-or-id> -f json
node skills/game-account-arknights/scripts/run-dual-platform-selection.mjs --request "限定多，1000元左右" --details-per-platform 5 --display-per-platform 5 --out /tmp/arknights-dual.json --report-out /tmp/arknights-dual.md
```

双平台执行器会在首个 OpenCLI 命令前捕获浏览器 target 基线，逐命令登记本轮新标签，并在成功、失败、信号中断和进程退出时关闭本轮拥有的标签及 `about:blank` 占位符；清理报告写入 `cleanup_reports`。不要在执行器外再创建无名验证 session，也不要把 `--keep-tab false` 误认为已经关闭了自动化窗口。

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
- 用户可见 `final_response` 必须是确定性 Markdown 表格；每个平台默认最多展示 5 个，并逐行保留商品编号/链接。`presentation.per_platform_rendered` 必须与最终文案实际出现的候选一致。
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

## Self-improve 边界

每次执行都输出：

- 本轮有效/无效的解析和平台字段。
- 覆盖缺口与详情缺失字段。
- `knowledge_update_candidates` 及证据、目标文件、验证命令。
- `self_improve`：`summary_generated`、optimizer/evaluator 报告路径、质量状态、知识候选总数/本轮已应用数/已有机制复核数/待验证数。

只有 `apply_status: applied` 且验证通过的稳定流程/字段修复才写“本轮已应用”。`verified_existing` 只表示复核了运行前已存在的机制，不能算本轮代码优化；`proposed` / `deferred` 必须显示为待验证。跨画像恢复候选时还必须提供 `canonical_rescore` 证据、匹配的新画像 digest 和完整重评分商品 ID，否则 optimizer 必须输出 `selection-reconciliation-unvalidated` 并打回。

允许自动沉淀：平台字段、解析别名、干员别名、脱敏 fixture、证据日期和稳定客观事实。估值变化只能作为候选，满足社区证据门槛且通过回归/evaluator 后再更新。禁止自动沉淀本轮预算、权重、区服偏好、风险容忍度和用户硬条件。
