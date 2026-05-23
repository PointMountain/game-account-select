# 绝区零（ZZZ）代理人与资产知识表

updated_at: 2026-05-23

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
  - Nangong Yu
  - Liuyin
  - Ju Fufu
  - Lucia
  - Qianxia
  - Zhao
  - Xixifu
  - Sid
  - Airi
```

中文别名：

```yaml
aliases:
  Miyabi: [星见雅, 雅]
  Yixuan: [仪玄]
  Ye Shunguang: [叶瞬光, 小光]
  Fubao Yuzuha: [浮波柚叶, 柚叶]
  Astra Yao: [耀嘉音, 耀佳音, 嘉音, 佳音]
  Soukaku: [苍角]
  Yanagi: [月城柳, 柳]
  Lycaon: [莱卡恩, 狼]
  Nangong Yu: [南宫羽, 南宫]
  Nicole: [妮可]
  Burnice: [柏妮思]
  Liuyin: [琉音]
  Ju Fufu: [橘福福]
  Lucia: [卢西娅]
  Pan Yinhu: [潘引壶]
  Zhao: [照]
  Qianxia: [千夏]
  Xixifu: [希希芙]
  Sid: [席德, 希德]
  Airi: [爱芮]
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

## 专属音擎本地表

专属音擎名称映射维护在 `references/signature-engines.json`。读取螃蟹/盼之详情页时，角色右上角角标不一定写成 `x+y`；若只显示 `x`，需要把页面 `S级音擎` / `S级武器` 名称清单与该 JSON 逐名匹配。匹配到某代理人的专属音擎时，可以确认该代理人有专武；只看到总 S 音擎数量或无法匹配名称时，保持“专武未确认”。

维护要求：

- 新增需要记录的代理人时，同步补充中文名、常见别名和专属音擎名。
- 名称别名只放能在平台页面或可靠资料中确认的写法，避免把泛用 S 音擎误算成专武。
- 平台 adapter 应输出 `sWEngineNames`；标准化层应同步到 `game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name`。

## 队伍判断

- 主 C/异常核心 + 击破/支援/防护 + 合适邦布/音擎，队伍价值高。
- 限定代理人带专属音擎明显加分。
- 孤立限定但无队友、无音擎、无资源，只能中等评分。
- 常驻高影画只有在能补齐强队定位时才加中低权重。

### 三虚狩队伍知识

当用户要求全部虚狩时，当前按星见雅、仪玄、叶瞬光检查。账号价值不能只看三名核心是否齐全，还要看能否同时组成三队：

- 星见雅队：当前优先按 `星见雅 + 浮波柚叶 + 南宫羽/莱卡恩/苍角` 判断。没有柚叶时，不得默认雅队完整；`雅柚柳`、`耀嘉音/妮可` 等旧口径或下位组合只能中置信解释。
- 叶瞬光队：当前优先按 `叶瞬光 + 照 + 耀嘉音/琉音` 判断。只有照+千夏时按旧口径或下位可玩处理，不算当前三虚狩硬条件完整。
- 仪玄队：当前优先按 `仪玄 + 卢西娅 + 橘福福/琉音` 判断。只有仪玄本体和专属音擎不能视作完整队。
- 独立三队检查时，每名辅助只能分配给一支队伍；“星见雅、仪玄、叶瞬光 + 琉音 + 耀嘉音”不是三队完整，只是三个核心共享两个辅助。

### 额外队伍与舒适度信号

- 直伤电队：按 `希希芙 + 席德/希德 + 耀嘉音/耀佳音` 检查。三人齐全可作为账号“玩得舒服”的加分项；希希芙或席德 0+1 也加分。
- 异放队：需要妄想天使三小只，当前买号语境按 `千夏 + 爱芮 + 南宫羽` 处理；缺任一位不能算异放队齐全。
- 薇薇安紊乱队：按 `薇薇安 + 紊乱/异常搭档` 检查，搭档可包括简、柏妮思、月城柳、爱丽丝、格莉丝等；有薇薇安 0+1 或搭档 0+1 时作为舒适度加分。
- 虚狩 2+1 是显著舒适度加分；三位虚狩都 2+1 时排序应优先。
- 剩余队伍的对应主 C/核心 0+1 都算加分，但不能替代三虚狩队伍硬检查。
- 耀嘉音/耀佳音 1+1 是额外舒适度加分，尤其同时服务叶瞬光队和直伤电队时需要单独说明。

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
