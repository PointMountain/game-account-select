---
name: game-account-skill-optimizer
description: 复盘账号筛选或估值的原始运行记录，诊断失败和用户反馈；跨运行去重问题，在授权范围内实现修复，并用补丁与回归凭据验证 self-improve。
argument-hint: "[raw run artifact | collect | status | verify]"
---

# Game Account Skill Optimizer

负责所有 game-account skill 的诊断与可验证演进。输入是 raw run artifact 或手工问题描述，输出 `<skill_optimization_report>`；用户先看到中文结论、证据与待处理项。

## 路由

- 单次复盘：读 [optimization workflow](references/optimization-workflow.md)、[issue taxonomy](references/issue-taxonomy.md)，运行 analyze-run。
- 跨运行复发、实现或应用改进：读 [学习闭环](references/learning-loop.md)，先 collect 留基线，再复现、补丁、verify、apply。
- 组装输入或报告：读 [report contract](references/report-contract.md) 和 [skill I/O](../game-account-toolkit/references/skill-io-contract.md)。
- 诊断已知问题：按 finding ID 搜索 [optimization knowledge](references/optimization-knowledge.md)；只有追溯改动才读 [changelog](references/changelog.md)。
- 平台问题：再读 toolkit 的 [access policy](../game-account-toolkit/references/platform-access-policy.md)、[priority](../game-account-toolkit/references/platform-priority.json) 与 [support matrix](../game-account-toolkit/references/operation-support-matrix.json)。

## 执行

1. 调用 game-account-preflight；离线 JSON 分析不要求浏览器可用。需要复查页面才进入 toolkit 的 ego-ops/ego-browser 链路。
2. 复原目标 skill、输入、原始错误、平台/社区尝试、真实耗时、输出与 evaluator 结果。缺字段放 missing_fields，降低置信度。
3. Troubleshooting：把 runtime、empty_result、platform_coverage、output_format、valuation、risk、quality_gate 等问题定位到责任层，输出 evidence 与 suggested_targets。
4. 默认产出建议与知识候选；用户已要求实现时继续当前授权，添加正反例并修改对应责任文件。个别版本/用户反馈不能直接成为永久估值规则。
5. 修改后运行目标验证与 game-account-skill-evaluator；低分、阻塞或 redo_required 回到诊断。需要声称 applied 时走学习闭环固定门禁并保留当前凭据。
6. 将 applied、verified_existing、proposed/deferred 分开交付；队列延期不会洗掉本轮 raw artifact 的阻塞项。

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input <run.json> --json
node skills/game-account-skill-optimizer/scripts/learning-loop.mjs collect --input <run.json>
node skills/game-account-skill-optimizer/scripts/learning-loop.mjs status
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<run.json> --json
```

## 边界

单次预算、目标、权重、服务器和风险偏好属于 run_only。稳定规则仍需目标游戏的证据等级与验证样例。平台未知操作 fail closed；复用操作仍检查当前前置条件。验证脚本只运行固定仓库命令，不执行运行记录给出的 shell。只写 apply_status 不算补丁，缺凭据触发 self-improve-applied-evidence-missing。
