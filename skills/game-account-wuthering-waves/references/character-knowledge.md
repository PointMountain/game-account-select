# Wuthering Waves（鸣潮）角色知识表

该文件维护Wuthering Waves（鸣潮）账号估值所需的角色与队伍知识。它必须随版本变化更新。

updated_at: 2026-05-16

## 分类原则

每个角色至少标注：

```yaml
name: string
category: limited|standard|unknown
meta_relevance: high|medium|low|unknown
valuable_duplicates: string[]
signature_weapon_value: high|medium|low|unknown
notes: string
updated_at: YYYY-MM-DD
```

## 当前已知规则

- 常驻角色高命不能作为高价值主因。
- 限定/版本强势角色、关键命座和专武显著高权重。
- 若卖家描述只写总黄数或五星数量，但不列角色/命座，应降低置信度。

## 当前版本价值分层

该分层来自 `community-evidence.md` 的 2026-05-16 快照。它是账号估值用的购买决策分层，不等同于绝对战斗强度榜。

### 高价值限定/核心资产

```yaml
high_value_limited:
  - name: Hiyuki
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 当前 3.3 上半新 5 星，多来源强度榜高位；买号时看是否有专武、资源和可组队友。
    updated_at: 2026-05-16
  - name: Aemeath
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位，和 Lynae/Mornye 等队伍关系影响账号价值。
    updated_at: 2026-05-16
  - name: Lynae
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位，和 Aemeath/Mornye 组合时队伍完整度价值更高。
    updated_at: 2026-05-16
  - name: Mornye
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 当前 3.3 上半复刻/卡池角色，多来源高位；与 Aemeath/Lynae 相关队伍价值较高。
    updated_at: 2026-05-16
  - name: Augusta
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位；与 Iuno 等队伍关系影响账号价值。
    updated_at: 2026-05-16
  - name: Cartethyia
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位但榜单间存在细微差异；买号时看 Aero 队和专武完整度。
    updated_at: 2026-05-16
  - name: Shorekeeper
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位辅助/队伍价值资产；不是单纯输出数量资产。
    updated_at: 2026-05-16
  - name: Galbrena
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位；有专武和可用队伍时价值更稳定。
    updated_at: 2026-05-16
  - name: Qiuyuan
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位；买号时看是否能和已有核心形成完整队。
    updated_at: 2026-05-16
  - name: Phrolova
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: high
    notes: 多来源高位；3.3 下半卡池相关资产，证据需随版本刷新。
    updated_at: 2026-05-16
  - name: Iuno
    category: limited
    meta_relevance: high
    valuable_duplicates: [community-confirmed key resonance chains only]
    signature_weapon_value: medium
    notes: 当前 3.3 上半卡池角色，多来源高位或中高位；与 Augusta 等队伍关系提高账号价值。
    updated_at: 2026-05-16
```

### 中价值限定/常用资产

```yaml
medium_value_assets:
  - Jinhsi
  - Zani
  - Phoebe
  - Carlotta
  - Camellya
  - Changli
  - Jiyan
  - Verina
  - Cantarella
  - Zhezhi
  - Yinlin
```

这些角色仍可作为账号价值来源，但必须看队伍、专武、资源和用户偏好。它们不能单独压过当前版本高价值核心组合。

### 低价值或高命陷阱资产

```yaml
low_value_or_trap_assets:
  - Lingyang
  - Calcharo
  - Jianxin
  - Encore
  - standard-character-duplicates-without-current-team
```

这些资产不是完全无用，但买号时不能因为高命、五星数量或展示位置靠前就高估。除非社区证据显示某角色在当前版本特定队伍中重新获得高价值，否则只给低权重。

## 队伍与组合判断

- Aemeath + Lynae + Mornye：当前快照中的高价值组合方向之一，账号同时持有多名核心且有专武/资源时明显加分。
- Augusta + Iuno：当前快照中的高价值组合方向之一，需看主 C/辅助位置和武器完整度。
- Cartethyia 相关 Aero 队：Cartethyia 单独高价值，但完整队伍和专武会显著影响买号价值。
- Hiyuki：当前 3.3 上半新角色，必须结合可用队友、武器和资源判断，不要只因“新角色”无条件满分。

## 社媒热门配队标签

这些标签用于买号解释和排序，不等同于永久强度榜。若版本环境或中文社区叫法变化，应刷新 `community-evidence.md`。

```yaml
team_archetypes:
  - label: 爱莫林
    aliases: [Aemeath-Mornye-Lynae, 小爱莫宁琳奈]
    key_members: [Aemeath, Mornye, Lynae]
    scoring_notes: 命中两名即可作为队伍方向，三名齐全且主C/关键位有专武时高分。
  - label: 卡千夏
    aliases: [Cartethyia-Chisa-XiaKong, 卡提千咲夏空]
    key_members: [Cartethyia, Chisa, Xia Kong]
    scoring_notes: Cartethyia 是核心信号，Chisa/Xia Kong 等队友和专武决定完整度。
  - label: 日月守
    aliases: [Jinhsi-moon-support-Shorekeeper, 今汐月辅守岸]
    key_members: [Jinhsi, Shorekeeper]
    scoring_notes: 中文社区叫法可能漂移；只在卖家明确队伍关系或截图证明时加高分。
  - label: 奥尤
    aliases: [Augusta-Iuno]
    key_members: [Augusta, Iuno]
    scoring_notes: 二者同号且武器/资源明确时加队伍分。
  - label: 绯雪队
    aliases: [Hiyuki core]
    key_members: [Hiyuki]
    scoring_notes: Hiyuki 需要结合适配队友、专武和资源；孤立角色只给中段队伍分。
```

## 待补充/待刷新

- 哪些命座属于质变命座。
- 哪些专武对角色价值影响最大。
- 3.3 下半 Denia/Chisa/Phrolova 卡池实际社区评价。
- 爱莫林、卡千夏、日月守等中文社区热门配队的稳定来源和命名别名。
- B站字幕、小红书笔记、抖音公开视频正文的稳定读取结果。
