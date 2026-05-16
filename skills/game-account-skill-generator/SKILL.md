---
name: game-account-skill-generator
description: 根据用户输入的游戏名、别名和社区证据，生成新的游戏账号买号评估 skill，并运行本地自我验证和质量评估。
argument-hint: "[game name] [aliases/evidence optional]"
---

# Game Account Skill Generator

## 作用

当用户要支持一个新游戏时，生成 `skills/game-account-<slug>/`。生成内容包括入口 skill、估值规则、资产知识表、社区证据快照、changelog、验证样例和验证脚本。

## 执行前准备

先运行 `game-account-preflight`。

## 必须读取

- `references/generation-workflow.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/skill-io-contract.md`

## 执行

```bash
node skills/game-account-skill-generator/scripts/generate-game-skill.mjs --game "Game Name"
```

可选参数：

- `--slug game-slug`
- `--alias "别名"`
- `--out /tmp/output-root`
- `--force`

## 输出

必须输出 `<skill_generation_report>`，包含生成路径、文件列表、验证结果和下一步社区更新建议。

生成后的 skill 默认是低置信基线。真实使用前应运行：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-<slug> --json
```
