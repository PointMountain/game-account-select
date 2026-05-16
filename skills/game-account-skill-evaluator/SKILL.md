---
name: game-account-skill-evaluator
description: 评估游戏账号买号 skill 是否达到可用标准。检查文件结构、输入输出契约、社区证据、评分规则、风险规则、验证脚本和 changelog。
argument-hint: "[skill path]"
---

# Game Account Skill Evaluator

## 作用

对已有或生成的 `game-account-*` 游戏估值 skill 做质量门禁。它不做账号推荐，只判断 skill 是否达到了可用于真实筛选的最低标准。

## 必须读取

- `references/evaluation-rubric.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/skill-io-contract.md`

## 执行前准备

先运行 `game-account-preflight`，并在评估前显示 `<preflight_report>`。如果缺少必需依赖，停止评估并给出补齐步骤。

## 执行

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json
```

## 输出

输出 `<skill_quality_report>`，包含分数、是否通过、阻塞问题、警告和建议修复。

默认门槛：80 分。生成器创建的新 skill 必须通过此评估后才建议用于真实购买筛选。
