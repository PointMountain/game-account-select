# Game Account Skill 评估标准

updated_at: 2026-05-17

## 评估范围

评估器覆盖当前仓库全部 `game-account-*` skill：

- 游戏估值 skill：文件结构、估值规则、社区证据、风险规则、验证样例。
- 主筛选 skill：状态机、平台覆盖、运行记录、用户文案和优化器接入。
- 工具/预检查 skill：依赖状态、平台安全边界、共享 schema 和输入输出契约。
- 生成器/社区更新 skill：产物结构、证据边界和质量门禁。
- 优化器：Troubleshooting、仓库级目标定位、回归样例、质量门禁打回。
- 优化器报告：报告中引用的目标 skill 必须逐个通过。
- 原始运行记录：`--from-report` 收到 raw run artifact 时，必须先经优化器诊断；除 `severity: info` 外的 findings 代表仍需处理的问题，应触发 `redo_required: true`。

## 游戏估值 Skill 分数构成

```yaml
structure: 20
io_contract: 15
valuation_rules: 20
community_evidence: 15
risk_and_missing_data: 15
validation: 15
```

非游戏 skill 使用同一总分门槛，但评分项按职责切换：状态机、共享契约、脚本、回归样例、Troubleshooting、质量门禁和安全边界占主要权重。

## 阻塞问题

- 缺 `SKILL.md`。
- 游戏估值 skill 缺 `references/valuation-rules.md`、`references/community-evidence.md` 或本地验证脚本。
- 主筛选 skill 缺核心状态机或平台尝试记录。
- 优化器缺 Troubleshooting、仓库级回归样例或质量门禁打回。
- 评估器不能覆盖非游戏 skill，或不能评估优化器报告。
- 评估器把原始运行记录当成已处理的优化器报告，导致 runtime、社区证据、链接或预算浮动问题未被打回。
- 没有风险扣分、缺失字段规则或防止“只堆数量/泛称高稀有度”的硬规则。
- 优化器产出的目标 skill 评分低于门槛。

## 通过标准

- 总分 >= 80。
- 无阻塞问题。
- 需要验证脚本的 skill 必须能运行脚本。
- 对优化器报告执行评估时，报告引用的全部目标 skill 都必须通过。
- 对原始运行记录执行评估时，优化器诊断出的非 info findings 必须已经处理或明确作为延期项，否则不通过。

## 打回重做

评估结果低于门槛、存在阻塞问题或任何被评估目标输出 `redo_required: true` 时，调用方必须将产物打回重做。

打回时输出：

```yaml
redo_required: true
redo_reasons:
  - 低于门槛的分数
  - 阻塞问题
  - 需要补的文件或验证样例
```

## 输出建议

评估器应输出机器可读 JSON，也应能转成 `<skill_quality_report>`。
