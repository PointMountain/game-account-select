# 游戏账号 skill 标准

updated_at: 2026-05-16

## 必需目录结构

```text
skills/game-account-<slug>/
├── SKILL.md
├── references/
│   ├── valuation-rules.md
│   ├── community-evidence.md
│   ├── changelog.md
│   └── <domain>-knowledge.md
├── scripts/
│   └── validate-sample.mjs
└── test-fixtures/
    └── <slug>-validation-sample.json
```

## 必需行为

1. 执行前先调用 `game-account-preflight` 或明确读取其检查结果，并在后续输出前显示 `<preflight_report>`。
2. 读取 `game-account-toolkit/references/skill-io-contract.md`。
3. 读取本 skill 的估值规则、知识表、社区证据和 changelog。
4. 对账号进行资产、资源、进度、风险、缺失字段和社区一致性评分。
5. 输出 `<game_account_evaluation>` 标签。
6. 如果社区证据过期、覆盖不足或账号资产不在快照中，降低置信度并输出 `rule_update_suggestion`。
7. 用户反馈规则错误时，只提出更新建议；未获确认前不写规则文件。

## 质量门槛

一个 game-account skill 必须满足：

- 有明确游戏名、别名和边界。
- 有可执行评分权重，而不是泛泛描述。
- 有低价值/陷阱资产规则。
- 有绑定、实名、找回、官方验号、区服/渠道服风险规则。
- 有社区证据快照和覆盖限制。
- 有本地验证脚本，能证明“堆数量/泛称高稀有度”的账号不会排第一。
- 有 changelog。
- 通过 `game-account-skill-evaluator`，默认分数至少 80。

## 推荐文件责任

- `SKILL.md`：入口、依赖、必须读取文件、标准输入输出和自我优化策略。
- `valuation-rules.md`：评分权重、硬排序规则、风险扣分、解释要求。
- `community-evidence.md`：来源、覆盖、共识、限制和更新时间。
- `<domain>-knowledge.md`：角色、装备、资源、账号类型等可维护知识表。
- `validate-sample.mjs`：最小回归验证，不依赖联网。

## 生成器默认策略

自动生成的 skill 不应伪装成已完成当前版本研究。默认策略：

- 社区信心为 `low`。
- 只对命名资产、资源、绑定/找回状态、截图完整度给稳定权重。
- 未命名高稀有度总数必须视为缺失字段。
- 生成后必须运行评估器，低于门槛不得建议直接用于真实购买。
