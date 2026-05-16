# 明日方舟干员与资产知识表

updated_at: 2026-05-16

## 分类原则

```yaml
operator:
  name: string
  rarity: 6|5|4|unknown
  category: limited|collab|standard|welfare|unknown
  account_value: high|medium|low|unknown
  progress_dependency: high|medium|low
  notes: string
```

## 高价值限定/联动资产

这些资产通常是买号时优先确认的稀缺项。是否高分仍取决于练度、专精、模组和账号风险。

```yaml
high_value_limited_or_collab:
  - W
  - 迷迭香
  - 浊心斯卡蒂
  - 耀骑士临光
  - 归溟幽灵鲨
  - 斥罪
  - 缄默德克萨斯
  - 麒麟R夜刀
  - 百炼嘉维尔
  - 假日威龙陈
  - 黍
  - 令
  - 年
  - 夕
  - 井
  - Ash
  - Ela
  - Iana
```

## 高影响常规六星

```yaml
high_impact_standard:
  - 玛恩纳
  - 史尔特尔
  - 银灰
  - 塞雷娅
  - 伊内丝
  - 焰影苇草
  - 艾雅法拉
  - 伊芙利特
  - 山
  - 棘刺
  - 澄闪
  - 提丰
  - 维什戴尔
  - 锏
```

## 练度字段

高价值干员必须结合：

- 精二等级
- 技能专精等级
- 模组等级
- 潜能是否关键
- 是否有同职业/同队伍支撑

## 低价值或易误判字段

- 博士等级。
- 普通六星总数但未列干员。
- 未练六星数量。
- 无资源/无材料支撑的“收藏号”。
- 只展示首页干员，不展示限定/练度/资源/实名风险。

## 待刷新

- 当前版本最新限定与联动权重。
- 当前高难、集成战略和保全环境中的高影响干员排序。
- 稀有/动态/联名时装列表。
