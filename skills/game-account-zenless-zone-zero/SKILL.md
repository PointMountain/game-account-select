---
name: game-account-zenless-zone-zero
description: 绝区零（Zenless Zone Zero / ZZZ）账号估值和筛选规则，关注限定 S 代理人、专属音擎、关键队伍、菲林/母带资源、绳匠等级和 HoYoverse/PSN/TAP 绑定风险。
argument-hint: "[listing json or account description]"
---

# Game Account Zenless Zone Zero Skill

## 作用

对绝区零（Zenless Zone Zero / ZZZ）账号进行游戏资产估值。该 skill 只负责 ZZZ 内部价值判断，不负责平台访问。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `references/valuation-rules.md`
- `references/agent-knowledge.md`
- `references/community-evidence.md`
- `references/changelog.md`

## 执行前准备

先调用 `game-account-preflight`。如果社区证据过期、跨版本、或账号核心代理人/音擎未覆盖，调用 `game-account-community-updater` 或按社区调研协议刷新。

## 核心维度

- 限定 S 代理人
- 常驻 S 代理人与高影画误判
- 专属音擎 / S 音擎适配度
- 队伍完整度：强攻/击破/支援/异常/防护等定位是否成队
- 菲林、加密母带、原装母带、邦布券、余波信号等资源
- 绳匠等级、式舆防卫/零号空洞进度、养成材料
- HoYoverse、PSN、TAP、B服/渠道服绑定与找回风险

## 输入

接受标准化挂牌、卖家描述或截图 OCR 后文本。

若输入没有社区证据快照，读取 `references/community-evidence.md`。如果快照超过 30 天、跨大版本、或账号核心代理人未覆盖，必须降低 `confidence` 并输出规则更新建议。

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
zenless_zone_zero_score:
  asset_score: number
  engine_score: number
  team_score: number
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

如果用户指出代理人、影画、音擎、队伍或资源判断错误，不要立即改文件。先提出规则更新建议，用户确认后更新 `references/agent-knowledge.md`、`references/valuation-rules.md` 或 `references/community-evidence.md`，并追加 `references/changelog.md`。
