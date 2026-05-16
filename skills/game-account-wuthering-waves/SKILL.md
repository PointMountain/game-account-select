---
name: game-account-wuthering-waves
description: Wuthering Waves（鸣潮）账号估值和筛选规则，重点区分限定/版本强势角色、常驻角色高命、专武、抽卡资源和绑定风险。
argument-hint: "[listing json or account description]"
---

# Game Account Wuthering Waves Skill

## 作用

对Wuthering Waves（鸣潮）账号进行游戏资产估值。该 skill 只负责Wuthering Waves（鸣潮）内部价值判断，不负责平台访问。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `references/valuation-rules.md`
- `references/character-knowledge.md`
- `references/community-evidence.md`
- `references/changelog.md`

## 执行前准备

先调用 `game-account-preflight`。如果需要刷新社区证据，调用 `game-account-community-updater` 或按 `game-account-toolkit/references/community-research-protocol.md` 执行当次调研。

## 核心原则

Wuthering Waves（鸣潮）账号不能把总黄数、五星角色数量、五星武器数量或常驻角色高命当作主要价值来源。常驻/弱势角色高命只给低权重。

优先看：

- 限定/版本强势角色
- 关键命座
- 专武
- 队伍完整度
- 星声、月相、浮金波纹、铸潮波纹等资源
- TAP/Wegame 绑定风险
- 官服/B服/渠道服

## 输入

接受标准化挂牌、卖家描述或截图 OCR 后文本。

若输入没有包含社区证据快照，先读取 `references/community-evidence.md`。如果快照超过 30 天、跨大版本、或用户样本里出现快照没有覆盖的新角色/新武器，必须降低 `confidence` 并输出 `rule_update_suggestion`。

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
wuthering_waves_score:
  asset_score: number
  resource_score: number
  team_score: number
  risk_penalty: number
  confidence_penalty: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
  rule_update_suggestion: string | null
```

示例：

```xml
<game_account_evaluation>
  <game>Wuthering Waves</game>
  <listing_id>来源账号编号</listing_id>
  <score format="json">{}</score>
  <confidence>low|medium|high</confidence>
  <community_comparison>strong alignment|partial alignment|conflict</community_comparison>
  <missing_fields format="json">[]</missing_fields>
</game_account_evaluation>
```

## 自我优化

如果用户指出某个角色/命座/队伍判断错误，不要立即改文件。先提出规则更新建议，用户确认后更新 `references/character-knowledge.md` 或 `references/valuation-rules.md`，并追加 `references/changelog.md`。
