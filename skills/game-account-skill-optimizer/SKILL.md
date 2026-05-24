---
name: game-account-skill-optimizer
description: 分析当前仓库全部 game-account skill 的执行记录、用户反馈和质量门禁结果，内置 troubleshooting，自我进化式生成可验证优化建议。
argument-hint: "[run artifact json or --manual notes]"
---

# Game Account Skill Optimizer

## 作用

这个 skill 用于优化 Game Account Select 体系里的全部 `game-account-*` skill。它不直接筛选账号，也不直接改写游戏估值规则；它负责把一次执行中暴露的问题转成结构化优化建议，帮助仓库级 harness 在下一次运行前少走相同弯路。

适用场景：

- 每次 `game-account-select` 完成真实筛选后，分析本次执行记录。
- 用户指出推荐错误、平台找少了、输出文案奇怪、耗时过长或没有结果。
- `game-account-skill-generator` 或优化流程产出的 skill 未通过质量门禁，需要打回重做。
- `game-account-community-updater`、`game-account-preflight`、`game-account-toolkit`、`game-account-skill-evaluator` 等非游戏 skill 暴露流程、依赖、输出或验证问题。
- 维护者手动提供一段执行记录或 JSON 样本，让优化器给出待改文件和原因。

## 执行前准备

先调用 `game-account-preflight`，并在优化前显示 `<preflight_report>`。如果只是分析本地 JSON 记录，缺少浏览器能力不阻塞；如果需要复查平台页面或社区来源，必须遵循 `game-account-toolkit/references/platform-access-policy.md`。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/platform-access-policy.md`
- `../game-account-toolkit/references/platform-priority.json`
- `references/optimization-workflow.md`
- `references/issue-taxonomy.md`
- `references/optimization-knowledge.md`
- `references/changelog.md`

## 输入

优先接受 JSON 执行记录：

```json
{
  "game": "Wuthering Waves",
  "target_skill": "game-account-wuthering-waves",
  "user_request": "1000元以内性价比账号",
  "platform_attempts": [],
  "evaluation_reports": [],
  "recommendations": [],
  "final_response": "",
  "user_feedback": []
}
```

字段缺失时允许分析，但必须降低置信度并把缺失字段放进 `missing_fields`。

## 执行

离线确定性分析：

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input run-artifact.json --json
```

使用内置回归样例：

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/wuthering-waves-77175988-run.json --json
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/zenless-zone-zero-run.json --json
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/quality-gate-redo-run.json --json
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/clean-run.json --json
```

## Troubleshooting 内置循环

先诊断，再优化。任何执行失败、超时、空结果、质量门禁失败或用户反馈，都必须先归因到具体阶段：

1. 复原 artifact：目标 skill、输入、平台尝试、耗时、错误文本、输出、评估结果。
2. 分类：按 `issue-taxonomy.md` 归入 runtime、empty_result、platform_coverage、output_format、valuation、risk、quality_gate、troubleshooting 等类别。
3. 定位责任边界：区分是平台不可读、主筛选编排、游戏估值规则、工具层、生成器、评估器还是证据刷新问题。
4. 输出修复目标：列出具体文件、证据和验证命令。
5. 若已应用优化，运行 `game-account-skill-evaluator`；低于门槛或 `redo_required: true` 时必须打回重做，不允许继续用于真实推荐。

## 用户反馈沉淀要求

用户人工复盘指出的估值优先级不能只写成一次性建议。应用优化时必须同步更新目标游戏规则、优化器知识库、回归样例和 evaluator 检查；若是全球同步进度游戏，还要检查社区证据协议是否覆盖 YouTube。绝区零这类反馈应至少保留“虚狩 `2+1` 高于耀嘉音/耀佳音 `1+1`、耀嘉音/耀佳音 `0+0` 可用、非虚狩角色通常 `0+1 > 1+0`、妄想天使三小只专武尤其南宫羽专武、琉音机制价值特殊”等信号，并用正反例防止单一舒适度项压过整体账号性价比。

## 输出

面向 skill-to-skill 的机器可读输出为 `<skill_optimization_report>`；面向用户的最终答复必须先给清晰中文摘要，不要把 XML 标签作为主文案直接展示。

```xml
<skill_optimization_report>
  <target_skill>game-account-wuthering-waves</target_skill>
  <confidence>low|medium|high</confidence>
  <findings format="json">[]</findings>
  <suggested_changes format="json">[]</suggested_changes>
  <safe_to_autopatch>false</safe_to_autopatch>
</skill_optimization_report>
```

每个 finding 至少包含：

```yaml
id: string
severity: blocking|high|medium|low|info
category: runtime|empty_result|platform_coverage|output_format|valuation|risk|evidence|user_feedback
summary: string
evidence: string[]
suggested_targets: string[]
autopatch_safe: boolean
```

## 安全边界

- 默认只生成优化建议，不静默修改其它 skill。
- 只有用户明确要求“实现/应用这些优化”时，才修改目标文件。
- 修改后必须运行目标 skill 的验证脚本和 `game-account-skill-evaluator`。未通过时输出 `redo_required` 并继续重做。
- 不把平台失败归咎于用户；必须记录具体失败路径和降级路径。
- 不绕过验证码、登录墙、反自动化限制或平台频率限制。
- 不把单次用户反馈直接升级为通用规则；需要标注证据等级和验证需求。
