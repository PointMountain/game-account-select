# 游戏账号 skill 标准

updated_at: 2026-08-30

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
│   ├── evaluate-listing.mjs
│   ├── finalize-evaluation-run.mjs
│   ├── validate-finalizer.mjs
│   └── validate-sample.mjs
└── test-fixtures/
    ├── <slug>-validation-sample.json
    └── <slug>-run-artifact.json
```

## 必需行为

1. 执行前先调用 `game-account-preflight` 或明确读取其检查结果，并在后续输出前显示 `<preflight_report>`。
2. 读取 `game-account-toolkit/references/skill-io-contract.md`。
3. 读取本 skill 的估值规则、知识表、社区证据和 changelog。
4. 将用户请求冻结为 `selection_profile`，`persistence_scope` 必须为 `run_only`；原始请求独立保存在 `request_provenance`。
5. 对账号进行独立资产维度、资源、进度、风险、缺失字段和社区一致性评分。未知字段得 0 分，不得隐含加分。
6. 评分逻辑必须通过 `scripts/evaluate-listing.mjs` 对任意标准挂牌复用；`validate-sample.mjs` 只负责回归。
7. 真实运行必须保留 `coverage_plan`、`platform_attempts`、`coverage_gaps`、`knowledge_update_candidates` 和原始 evaluation。
8. `scripts/finalize-evaluation-run.mjs` 必须生成确定性 Markdown、optimizer/evaluator sidecar、`self_improve`、`quality_gate` 和 SHA-256 绑定的 `delivery_contract`。
9. 如果社区证据过期、覆盖不足或账号资产不在快照中，降低置信度并输出 `rule_update_suggestion`。
10. 用户反馈规则错误时，只提出更新建议；未获确认前不写规则文件。run-only 画像永远不能沉淀。
11. 平台访问先读取 `operation-support-matrix.json`，只调用已验证 `ego-ops` operation，由 `ego-browser` 执行；unsupported route 必须 fail closed。

## 质量门槛

一个 game-account skill 必须满足：

- 有明确游戏名、别名和边界。
- 有可执行评分权重，而不是泛泛描述。
- 有低价值/陷阱资产规则。
- 有绑定、实名、找回、官方验号、区服/渠道服风险规则。
- 有社区证据快照和覆盖限制。
- 有本地验证脚本，能证明“堆数量/泛称高稀有度”的账号不会排第一。
- 有 fixture-independent evaluator 和 raw run-artifact finalizer。
- finalizer 回归证明报告确定性、sidecar、self-improve、redo gate 与 `final_response_sha256`。
- 主动披露平台 operation 支持缺口，不使用未验证浏览器 fallback。
- 有 changelog。
- 通过 `game-account-skill-evaluator`，默认分数至少 80。

## 推荐文件责任

- `SKILL.md`：入口、依赖、必须读取文件、标准输入输出和自我优化策略。
- `valuation-rules.md`：评分权重、硬排序规则、风险扣分、解释要求。
- `community-evidence.md`：来源、覆盖、共识、限制和更新时间。
- `<domain>-knowledge.md`：角色、装备、资源、账号类型等可维护知识表。
- `validate-sample.mjs`：最小回归验证，不依赖联网。
- `evaluate-listing.mjs`：面向任意标准挂牌的公共评分入口。
- `finalize-evaluation-run.mjs`：薄入口，复用 toolkit 的通用 finalizer；特殊选择报告可以保留专属实现。
- `validate-finalizer.mjs`：验证通过和打回两条路径，并比较两次 report body。
- `<slug>-run-artifact.json`：脱敏、可追溯的 finalizer 契约样例。

## 生成器默认策略

自动生成的 skill 不应伪装成已完成当前版本研究。默认策略：

- 社区信心为 `low`。
- 只对命名资产、资源、绑定/找回状态、截图完整度给稳定权重。
- 未命名高稀有度总数必须视为缺失字段。
- 默认生成可复用 evaluator、finalizer、finalizer 回归和 raw artifact fixture。
- 默认 platform operation 支持为 unsupported，直到 `ego-ops` + `ego-browser` 实证并写入矩阵。
- 生成后必须运行评估器，低于门槛不得建议直接用于真实购买。
