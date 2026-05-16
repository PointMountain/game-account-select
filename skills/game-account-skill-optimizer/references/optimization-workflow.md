# Skill 优化工作流

updated_at: 2026-05-17

## 目标

把真实执行过程中的问题变成可复查、可执行、可验证的 skill 改进建议。优化器关注“下次如何少走弯路”，而不是在当次运行里重新做完整筛选。

仓库采用自我进化 harness 的设计：执行记录是观测，优化器是故障诊断和改进建议层，评估器是质量门禁。任何优化都必须能回到运行证据、目标文件和验证命令。

## 输入来源

- 主筛选 skill 的执行记录。
- 生成器、评估器、社区更新、预检查、工具层或优化器自身的执行记录。
- 平台访问尝试记录：查询词、平台、耗时、状态、错误文本、是否返回候选。
- 推荐结果：入选、排除、缺失字段、规则更新建议。
- 最终回复文本：是否暴露机器标签、是否解释清楚风险。
- 用户反馈：平台漏掉、估值误判、输出格式不适、风险判断不足。
- 质量门禁结果：`score`、`passed`、`redo_required`、阻塞问题和建议修复。

## 分析步骤

1. 读取运行记录，保留原始错误文本、平台路径和评估结果。
2. 先做 Troubleshooting：判断问题发生在平台访问、主筛选编排、游戏估值、工具层、生成器、评估器、证据刷新还是优化器自身。
3. 对每个问题按 `issue-taxonomy.md` 分类。
4. 合并同类问题，避免把同一个平台超时拆成多个噪声建议。
5. 输出建议修改的文件，但不默认写入。
6. 给每条建议标注是否适合自动补丁：
   - 文档/流程补充通常可自动补丁。
   - 游戏估值权重、社区 meta、平台解析逻辑默认需要人工确认。
7. 若本次运行已有用户明确要求实现优化，可由执行者按建议修改目标文件，并运行对应验证脚本和 `game-account-skill-evaluator`。

## 自我进化闭环

1. Observe：记录输入、平台尝试、失败文本、输出和用户反馈。
2. Diagnose：用优化器归因，不把慢、空、低分、误判混成一个笼统问题。
3. Patch：只在用户明确要求实现时修改目标 skill 或共享规则。
4. Evaluate：用目标验证脚本和 `game-account-skill-evaluator` 评分。
5. Redo：评分低于门槛、存在阻塞问题或 `redo_required: true` 时，回到 Diagnose/Patch，不允许把产物用于真实推荐。

## Troubleshooting 清单

- 慢：检查 `duration_ms`、重复查询、等待预算和降级路径。
- 空：检查 `empty_result`、登录提示、验证码、详情页 503、公开列表是否可读。
- 漏平台：对照 `platform-priority.json`，确认螃蟹、盼之、交易猫、淘手游是否按顺序尝试或明确降级。
- 文案怪：检查最终用户回复是否把 `<game_account_evaluation>`、`<recommendations>`、`<skill_quality_report>` 等标签当主文案暴露。
- 估值窄：检查是否只看命座/高稀有度数量，而缺少队伍、主 C、专武/音擎/弧盘/模组/专精、资源和风险。
- 质量低：读取 evaluator 报告，优先修复阻塞问题；如果是优化器产出的 skill，则生成 `quality_gate` finding 并打回重做。

## 输出原则

- 用户首先看到的是简洁的中文摘要和下一步动作。
- XML 标签仅用于内部契约或日志，不作为主推荐文案。
- 所有建议必须带证据，例如“xianyu search 超时 45s 且无输出”“最终回复包含 `<game_account_evaluation>`”。
- 平台覆盖建议必须区分“应该纳入搜索顺序”和“已经有可靠解析器”。

## 手动执行模式

用户可直接粘贴问题描述，例如：

```text
用 game-account-skill-optimizer 分析这次鸣潮筛选为什么慢、为什么漏平台，以及怎么改 skill。
```

如果没有 JSON，优化器应先把用户描述标准化成临时 artifact，再输出低置信度建议。

## 自动执行模式

`game-account-select` 在筛选结束后可把运行摘要交给优化器。自动模式只生成报告；若发现可自动修复的文档问题，也必须由上层流程决定是否应用补丁。

自动应用优化后必须运行：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs <target-skill> --json
```

若优化器输出报告已落盘，还可以评估报告引用的全部目标 skill：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<optimizer-report.json> --json
```
