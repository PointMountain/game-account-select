---
name: game-account-neverness-to-everness
description: Neverness to Everness（异环）账号估值和筛选规则，关注 S 角色、S 弧盘、觉醒、环石/异晶/骰子资源、主角与账号类型风险。
argument-hint: "[listing json or account description]"
---

# Game Account Neverness to Everness Skill

## 作用

对Neverness to Everness（异环）账号进行游戏资产估值。该 skill 只负责Neverness to Everness（异环）内部价值判断，不负责平台访问。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `references/valuation-rules.md`
- `references/asset-knowledge.md`
- `references/community-evidence.md`
- `references/changelog.md`

## 执行前准备

先调用 `game-account-preflight`，并在账号估值前显示 `<preflight_report>`。如果缺少必需依赖，停止估值并给出补齐步骤；如果社区证据不足、版本变化或用户样本出现未覆盖 S 角色/弧盘，调用 `game-account-community-updater` 或按社区调研协议刷新。

## 核心维度

- 猎人等级
- S 级角色数量与质量
- S 级弧盘数量与质量
- 角色觉醒
- 环石、异晶、质实骰子、三重钥匙等资源
- 主角性别或主角相关限制
- TAP 绑定、完美账号/B服等账号类型风险

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
neverness_to_everness_score:
  asset_score: number
  resource_score: number
  progression_score: number
  risk_penalty: number
  confidence_penalty: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
  rule_update_suggestion: string | null
```

## 自我优化

Neverness to Everness（异环）规则随游戏版本和市场成熟度变化较快。任何角色、弧盘、觉醒权重更新都必须先提出建议，用户确认后再修改 references 文件。
