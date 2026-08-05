# 明日方舟动态估值规则

updated_at: 2026-08-02

## 永久规则只定义维度

永久评分器只计算稀缺度、当前实战能力、养成完成度、抽卡资源、皮肤收藏、价格效率、账号风险和数据完整度。它不保存任何用户会话的预算或权重。

```text
profile_score = Σ(base_dimension × normalized_runtime_weight)
final_score = profile_score - risk_penalty(risk_tolerance) - missing_data_penalty
```

`selection_profile.persistence_scope` 和 `profile_isolation.persistence_scope` 必须是 `run_only`。若 `durable_updates_from_profile` 非空，或由 `selection_profile` 派生的候选试图写入 references/SKILL.md，optimizer 必须输出阻塞 finding `selector-session-preference-leak`。

## 基础维度定义

### rarity

只计算已确认的限定/联动获取类型及收藏稀缺度。常驻干员不因强度高而进入稀缺分；未养成限定仍可有收藏价值，但养成分和实战分独立偏低。获取类型来自 `operator-value-map.json`，未知干员不得凭标题猜分类。

### combat

综合当前实战能力、社区推荐核心、常驻图价值、关键角色覆盖和练度。单纯“六星很多”“限定很多”或“超大杯很多”不产生高实战分；未养成核心不得压过成熟主力阵容。版本强度是时效性判断，证据超过 7 天或未覆盖新版本时最高 `medium` confidence。

`combat` 固定拆成三个子项：

- `meta_core_score`：当前 `apex/core/strong` 干员的有效价值，必须乘以对应精二、专精和模组可用度，并使用递减收益。
- `role_coverage_score`：部署回费、阻挡站场、物理输出、法术输出、治疗续航、控制/再部署六类推图职能。
- `roster_depth_score`：可用主力深度，只占小权重，避免重新变成数量榜。

```text
combat = meta_core_score × 55%
       + role_coverage_score × 30%
       + roster_depth_score × 15%
```

### progression

精二、技能专精、模组和关键潜能分别进入养成完成度。优先计算社区推荐核心的对应练度，再少量计算一般角色练度。卖家只给精二总数而不给角色对应关系时，可作为粗略事实，但必须扣数据完整度。平台只证明精二/精一时，只计算该阶段本身；专精或模组为 `null` 必须按 0 增量处理，不能用“通常会练”推定。原始验号图 URL 和字段可用性写入 `progression_evidence`。

### push_readiness

`push_readiness` 是跨画像基础质量，不替代本轮动态权重：

- `ready`：至少 4 名已养成社区推荐核心，且覆盖至少 5/6 推图职能。
- `partial`：至少 2 名已养成推荐核心，且覆盖至少 4/6 职能。
- `not_ready`：数量很多但关键角色未养成，或明显缺先锋、阻挡、治疗等基础职能。
- `unverified`：无法把干员名称与精二状态对应起来。

非 `ready` 账号施加独立 `playability_penalty`。该罚分在收藏画像中仍然存在，防止买到“收藏很多但推不动图”的仓库号；它不是区服或用户偏好硬过滤。

### resources

抽数估算：

```text
estimated_pulls = (orundum + originite_prime × 180) / 600
                + ten_pull_tickets × 10
                + single_pull_tickets
```

龙门币、材料和芯片是养成储备，不应误算成抽数。

### skins

皮肤只进入独立收藏维度。动态、联动或明确绝版皮肤可更高，但在任何画像下都不能伪装成稀缺干员；收藏画像只是提高本轮权重。

### price_efficiency

预算匹配只影响价格效率和推荐层级：`primary`、`flex_budget`、`excluded_price`。它不修改 `asset_quality_score`。在主区间内，同等资产下更低价格的效率分更高；不能因为更接近目标价而奖励更贵账号。预算之外的账号可以作为市场数据或备选，但不能伪装成主区间候选。

若本轮 `budget_expansion.enabled: true`，低于或高于预算浮动区间的精确满足项仍保持 `excluded_price` 的价格事实，但可以按 `lower|higher` 单列为 `budget_breakthrough`。比较结论必须使用独立维度增量：联动/限定补齐属于稀缺收藏收益；只有 `combat`、`progression`、`push_readiness` 实际提高才算推图收益。不得把收藏溢价表述成战力提升。

### risk_penalty

区服、实名、找回、官方验号和包赔始终保留为底层事实。本轮没有声明硬条件时只展示并罚分；只有 `hard_conditions` 明示时才硬过滤。风险容忍度只改变本轮罚分倍率，不改变事实。

### missing_data_penalty

缺干员名单、对应练度、资源、绑定/实名/找回/验号状态时扣分并列入 `missing_fields`。缺失不能当作利好。

## 动态画像

画像由 `parse-selection-profile.mjs` 生成，支持：

- “限定多、1000 元左右”：收藏目标，提高 `rarity`；预算只写入本轮 artifact。
- “战力优先、3000 元左右”：提高 `combat` 和 `progression`。
- “抽数多”“皮肤多”“性价比优先”“必须有某干员”：分别进入独立维度或硬条件。

权重必须归一化。预算和主要目标缺失或冲突时补问；区服/风险只有会显著改变结果时补问，其余写中性 `assumptions`。

## 排序硬规则

- 收藏画像下，单纯皮肤堆积不能替代限定/联动干员。
- 战力画像下，未养成限定不能压过精二、专精和模组清楚的成熟主力阵容。
- 任何画像下，完全未养成的限定数量陷阱不得压过具备社区核心和完整推图职能的成熟小阵容。
- “联动全齐”需要逐名核对；平台文本只暴露六星/精一/精二名单时，低练度五星和一星可能是假缺失。若有公开验号干员页，可用 OCR 补证并保留图片 URL、命中名和方法；没有图片或 OCR 未命中时保持 `unverified`，不得武断判无。
- 只有输出型超大杯、但缺部署回费/阻挡/治疗的账号必须降级并显示缺失职能。
- 只给博士等级、六星总数或营销泛称的账号不能进入高置信 Top 1。
- 官服、B 服、验号和包赔只有在本轮明确为硬条件时硬过滤；风险事实任何时候都不得删除。

## 证据与更新门槛

官方事实由鹰角新闻与 PRTS 维护。获取类型是客观事实；强度和交易溢价是经验判断，规则变化至少需要两条可复核、相互独立的社区资料，记录日期和局限，并通过同批候选的收藏/战力换榜回归后才能落盘。
