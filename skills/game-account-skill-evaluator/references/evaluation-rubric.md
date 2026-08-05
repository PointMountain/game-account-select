# Game Account Skill 评估标准

updated_at: 2026-08-06

## 评估范围

评估器覆盖当前仓库全部 `game-account-*` skill：

- 游戏估值 skill：文件结构、估值规则、社区证据、风险规则、验证样例。
- 主筛选 skill：状态机、成功标准、覆盖计划、知识沉淀账本、平台覆盖、运行记录、用户文案和优化器接入。
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
- 主筛选 skill 缺 `success_criteria`、`coverage_plan`、`coverage_gaps` 或 `knowledge_update_candidates`，导致主动筛选完整性和知识沉淀不可复查。
- 主筛选缺少可确认/冻结的 run-only `selection_profile`，或把本轮预算、权重、区服/风险偏好和硬条件写进永久知识。
- 用户未声明严格预算且预算附近无精确项时，运行 artifact 没有分开保存低价/高价扩展精确项、预算附近近似项和逐维差价比较；或把某次扩展价写成永久默认值。
- optimizer/evaluator 不能把 `selector-session-preference-leak` 作为阻塞 finding 打回。
- 对声明 `selection_profile` / `run_only` 的动态游戏 skill，evaluator 未静态扫描 `SKILL.md`、估值/角色知识表和评分脚本；出现 `default_budget`、数值化永久预算、默认区服或官服/B服硬过滤时必须直接 `redo_required: true`。用户请求示例、changelog 和社区证据快照不视为默认规则。
- 优化器缺 Troubleshooting、仓库级回归样例或质量门禁打回。
- 评估器不能覆盖非游戏 skill，或不能评估优化器报告。
- 评估器把原始运行记录当成已处理的优化器报告，导致 runtime、社区证据、链接或预算浮动问题未被打回。
- 平台或 adapter 已提供上架/验号时间，但推荐、备选或排除项没有保留标准字段 `published_at` / `platform_verified_at`；或用抓取/运行时间代替来源时间。
- 明日方舟主动找号声明螃蟹与盼之为必需覆盖时，缺任一 `platform_shortlists` 可见段，或用一个平台的结果冒充双平台完成态。允许一个 `best_value_listing` 跨平台胜出，但不得隐藏另一平台。
- 明日方舟双平台 artifact 已有候选，但最终答复没有 Markdown 表格、漏掉可展示候选，或 `presentation.per_platform_rendered` 与最终文案实际商品编号不一致。
- 真实筛选只留一句 `experience_summary`，没有结构化 `self_improve`、optimizer/evaluator raw-artifact 报告和知识候选 applied/pending 计数；这种口头 self-improve 必须打回。
- 账号级“陈年老号/仓库号/阵容断代”描述进入资产名 `exclusions`，或单字资产名可反向命中整句自由文本，必须打回。
- 从旧画像恢复候选但缺少 canonical rescore、匹配的 profile digest、验证命令/时间或完整 `rescored_listing_ids`，必须以 `selection-reconciliation-unvalidated` 打回；手工改 JSON 后重跑 finalizer 不算 self-improve。
- `verified_existing` 只能计为已有机制复核，不能计入本轮 `applied`；观察到运行前已有 adapter/fallback 不得冒充本轮代码优化。
- 没有风险扣分、缺失字段规则或防止“只堆数量/泛称高稀有度”的硬规则。
- 明日方舟评分器没有把社区推荐核心、实际精二/专精/模组状态、关键推图职能覆盖拆开计算，或缺少“限定数量多但未养成”“高强度输出多但缺关键职能”的回归样例。
- 明日方舟把未公开的专精/模组当作已养成加分，或没有保留平台精二/精一与公开验号图的字段级证据状态。
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
