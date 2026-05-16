---
name: game-account-skill-optimizer
description: 分析游戏账号筛选执行记录和用户反馈，识别慢路径、空结果、平台覆盖、输出格式和估值规则问题，并生成可执行的 skill 优化建议。
argument-hint: "[run artifact json or --manual notes]"
---

# Game Account Skill Optimizer

## 作用

这个 skill 用于优化 Game Account Select 体系里的其它 skill。它不直接筛选账号，也不直接改写游戏估值规则；它负责把一次筛选运行中暴露的问题转成结构化优化建议，帮助后续避免重复踩坑。

适用场景：

- 每次 `game-account-select` 完成真实筛选后，分析本次执行记录。
- 用户指出推荐错误、平台找少了、输出文案奇怪、耗时过长或没有结果。
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
  "skill": "game-account-wuthering-waves",
  "user_request": "1000元以内性价比账号",
  "platform_attempts": [],
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
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input skills/game-account-skill-optimizer/test-fixtures/clean-run.json --json
```

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
- 不把平台失败归咎于用户；必须记录具体失败路径和降级路径。
- 不绕过验证码、登录墙、反自动化限制或平台频率限制。
- 不把单次用户反馈直接升级为通用规则；需要标注证据等级和验证需求。
