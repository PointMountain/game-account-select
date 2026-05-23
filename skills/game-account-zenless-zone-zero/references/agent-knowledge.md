# 绝区零（ZZZ）代理人与资产知识表

updated_at: 2026-05-16

## 分类原则

```yaml
agent:
  name: string
  rank: S|A|unknown
  category: limited|standard|unknown
  role: attack|stun|support|anomaly|defense|unknown
  account_value: high|medium|low|unknown
  signature_engine_value: high|medium|low|unknown
  notes: string
```

## 高价值限定 S 代理人基线

此列表用于账号购买初筛，不等同于实时强度榜。真实筛选前应按社区证据刷新。

```yaml
high_value_limited_agents:
  - Ellen
  - Zhu Yuan
  - Qingyi
  - Jane
  - Caesar
  - Burnice
  - Yanagi
  - Lighter
  - Miyabi
  - Astra Yao
  - Evelyn
  - Trigger
  - Vivian
  - Yixuan
  - Ye Shunguang
  - Fubao Yuzuha
  - Liuyin
  - Ju Fufu
  - Lucia
  - Qianxia
  - Zhao
```

中文别名：

```yaml
aliases:
  Miyabi: [星见雅, 雅]
  Yixuan: [仪玄]
  Ye Shunguang: [叶瞬光, 小光]
  Fubao Yuzuha: [浮波柚叶, 柚叶]
  Astra Yao: [耀嘉音, 嘉音]
  Soukaku: [苍角]
  Yanagi: [月城柳, 柳]
  Lycaon: [莱卡恩]
  Nicole: [妮可]
  Burnice: [柏妮思]
  Liuyin: [琉音]
  Ju Fufu: [橘福福]
  Lucia: [卢西娅]
  Pan Yinhu: [潘引壶]
  Zhao: [照]
  Qianxia: [千夏]
```

## 常驻 S / 易误判资产

```yaml
standard_or_lower_priority:
  - Nekomata
  - Soldier 11
  - Koleda
  - Lycaon
  - Rina
  - Grace
```

常驻 S 不是无价值，但不能因为高影画或数量多就压过限定核心队伍。

## 队伍判断

- 主 C/异常核心 + 击破/支援/防护 + 合适邦布/音擎，队伍价值高。
- 限定代理人带专属音擎明显加分。
- 孤立限定但无队友、无音擎、无资源，只能中等评分。
- 常驻高影画只有在能补齐强队定位时才加中低权重。

### 三虚狩队伍知识

当用户要求全部虚狩时，当前按星见雅、仪玄、叶瞬光检查。账号价值不能只看三名核心是否齐全，还要看能否同时组成三队：

- 星见雅队：优先看浮波柚叶；常见组合包括雅柚苍、雅柚柳、雅柚莱。没有柚叶时，需要耀嘉音/妮可、苍角、月城柳、莱卡恩等明确替代，否则星见雅队不完整。
- 仪玄队：优先看琉音、橘福福、青衣与卢西娅/潘引壶等组合。只有仪玄本体和专属音擎不能视作完整队。
- 叶瞬光队：优先看琉音或照搭配千夏/耀嘉音。若琉音同时要给仪玄，必须确认叶瞬光有照+千夏或其它不抢人的替代。
- 独立三队检查时，每名辅助只能分配给一支队伍；“星见雅、仪玄、叶瞬光 + 琉音 + 耀嘉音”不是三队完整，只是三个核心共享两个辅助。

## 资源字段

- 菲林
- 加密母带
- 原装母带
- 邦布券
- 余波信号
- 丁尼、认证章、突破/技能材料

## 待刷新

- 当前版本最新限定代理人和专属音擎。
- 式舆防卫、危局强袭和零号空洞环境中的队伍价值。
- 邦布与代理人/阵营适配权重。
