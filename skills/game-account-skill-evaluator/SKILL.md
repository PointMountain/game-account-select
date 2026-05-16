---
name: game-account-skill-evaluator
description: 评估当前仓库 game-account skill 和优化器产出是否达到可用标准，覆盖游戏 skill、selector、toolkit、preflight、generator、updater、optimizer，并在低分时打回重做。
argument-hint: "[skill path or --from-report=optimizer-report.json]"
---

# Game Account Skill Evaluator

## 作用

对当前仓库的 `game-account-*` skill 做质量门禁。它不做账号推荐，只判断目标 skill 或优化器产出的目标 skill 是否达到了可用于真实流程的最低标准。

覆盖范围：

- 游戏估值 skill：规则、证据、风险、验证样例。
- `game-account-select`：编排状态机、平台覆盖、运行记录、优化器接入和用户文案。
- `game-account-toolkit` / `game-account-preflight`：共享契约、平台安全边界、依赖状态。
- `game-account-skill-generator` / `game-account-community-updater`：生成或刷新流程是否有质量门禁和证据边界。
- `game-account-skill-optimizer`：Troubleshooting、仓库级路由、回归样例和质量门禁打回。
- 优化器报告：读取报告引用的目标 skill，逐个评分。

## 必须读取

- `references/evaluation-rubric.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-skill-optimizer/references/optimization-workflow.md`

## 执行前准备

先运行 `game-account-preflight`，并在评估前显示 `<preflight_report>`。如果缺少必需依赖，停止评估并给出补齐步骤。

## 执行

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-skill-optimizer --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=skills/game-account-skill-optimizer/test-fixtures/optimizer-report-sample.json --json
```

## 输出

输出 `<skill_quality_report>`，包含分数、是否通过、是否需要重做、阻塞问题、警告和建议修复。

默认门槛：80 分。生成器创建的新 skill、优化器修改后的 skill、优化器报告引用的目标 skill，都必须通过此评估后才建议用于真实购买筛选。

低于门槛、存在阻塞问题或输出 `redo_required: true` 时，调用方必须打回重做，不能把该 skill 继续用于真实推荐。
