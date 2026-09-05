# 优化输入输出契约

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
