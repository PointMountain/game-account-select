# 明日方舟干员与资产知识

updated_at: 2026-08-02

机器可读事实以 `operator-value-map.json` 为准。知识表把以下字段严格分离：

```yaml
operator:
  name: string
  aliases: string[]
  acquisition_type: limited|collab|standard|welfare|unknown
  collector_value: 0-100
  combat_value: 0-100
  story_value: 0-100
  meta_tier: apex|core|strong|situational|unrated
  roles: string[]
  progression_dependency: high|medium|low
  evidence_as_of: YYYY-MM-DD|null
```

## 分类边界

- `acquisition_type` 是获取事实，不等于当前强度。
- `collector_value` 是稀缺收藏信号，不等于实战分。
- `combat_value` 必须结合当前证据和实际练度。
- `story_value` 表示常驻图/活动图的泛用推图价值；不得用单一合约或肉鸽榜替代。
- `meta_tier` 是多来源社区档位快照，不是数量奖励；`apex/core` 只有在已养成时才算推图核心。
- `roles` 使用 deployment、laneholding、physical_damage、arts_damage、sustain、control、fast_redeploy、support，用于检查阵容职能而不是职业图标数量。
- `progression_dependency` 描述精二、专精、模组及队伍依赖。
- 未覆盖新干员保持 `unknown` 并触发证据刷新，不能继承本轮画像。

已修正旧硬编码错误：斥罪是常驻干员，不计入限定稀缺；维什戴尔是限定干员，不能列为常驻。联动角色灰烬、艾拉、双月、麒麟R夜刀等同时具有获取稀缺性，但实战价值仍单独计算。

## 练度和阵容事实

高价值干员必须尽量关联到：精二等级、技能专精、模组、关键潜能、同队支撑。只披露“精二 60 个”时保留总数事实，但 `operator_progression` 仍视为缺失。运行时只有平台精二/精一名单时，未知 `mastery` / `module` 的增量分均为 0；保留原始验号图供最终验号复核。

推图可用度必须同时输出：已养成社区推荐核心、未养成核心、六类职能覆盖、缺失职能和 `push_readiness`。即使本轮是收藏画像，也要施加基础可玩性罚分；只有用户明确接受纯仓库收藏时才可在解释中降低该项的重要性，不能删除事实。

## 易误判字段

- 博士等级。
- 无名单的六星/精二总数。
- 未养成限定数量。
- 只堆超大杯输出但没有先锋、阻挡或治疗。
- 账号有超大杯名字，但详情无法确认对应精二/专精/模组。
- 无资源支撑的“收藏号”。
- 皮肤总数替代限定/联动数量。
- 标题写“全图鉴/毕业”但无官方验号或详情佐证。

## 更新协议

别名和经官方/Wiki核验的获取类型可作为稳定客观事实候选。强度、收藏溢价或交易估值变化必须先进入 `knowledge_update_candidates`，附至少两条独立社区资料，并通过 `validate-sample.mjs` 和 evaluator；任何当前预算或用户偏好不得进入本表。
