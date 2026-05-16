---
name: game-account-{{slug}}
description: {{game_name}} 账号估值和筛选规则，关注命名核心资产、资源、进度和账号安全风险。
argument-hint: "[listing json or account description]"
---

# Game Account {{title_name}} Skill

## 作用

对 {{game_name}} 账号进行游戏资产估值。该 skill 只负责 {{game_name}} 内部价值判断，不负责平台访问、交易撮合或卖家沟通。

## 执行前准备

先调用 `game-account-preflight`，并读取 `game-account-toolkit/references/skill-io-contract.md`。

## 必须读取

- `references/valuation-rules.md`
- `references/asset-knowledge.md`
- `references/community-evidence.md`
- `references/changelog.md`

## 输入

接受 `<account_listing>` 或卖家描述/OCR 文本。若没有传入 `<community_evidence>`，读取本地社区证据快照。

## 输出

必须输出 `<game_account_evaluation>`，并包含 final_score、confidence、community_comparison、highlights、concerns、missing_fields、rule_update_suggestion。

## 自我优化

如用户指出资产权重或风险判断错误，先输出 `<rule_update_suggestion>`。只有用户确认后才修改 references 文件并追加 changelog。
