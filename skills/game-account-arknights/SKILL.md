---
name: game-account-arknights
description: 明日方舟账号估值和筛选规则，关注限定/联动干员、六星质量、精二练度、资源、皮肤与区服风险。
argument-hint: "[listing json or account description]"
---

# Game Account Arknights Skill

## 作用

对明日方舟账号进行游戏资产估值。该 skill 只负责明日方舟内部价值判断，不负责平台访问。

## 必须读取

- `references/valuation-rules.md`
- `references/changelog.md`

## 核心维度

- 限定干员
- 联动干员
- 当前高强度六星
- 精二/专精练度
- 合成玉、源石、抽卡券等资源
- 时装数量与稀有时装
- 官服/B服、安卓/iOS
- 找回和实名风险

## 输出

```yaml
arknights_score:
  asset_score: number
  resource_score: number
  collection_score: number
  risk_penalty: number
  confidence: low|medium|high
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
```

## 自我优化

当用户反馈某些干员、皮肤或资源权重不准确时，先提出规则更新建议，确认后更新 references 文件并记录 changelog。
