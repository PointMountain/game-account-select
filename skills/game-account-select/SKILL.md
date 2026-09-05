---
name: game-account-select
description: 主动寻找、跨平台比较游戏账号；将预算与目标冻结为本轮画像，按覆盖计划调用已验证浏览器操作和游戏估值，再交付有来源、缺口与质量门禁的推荐。
argument-hint: "[游戏] [预算] [偏好]"
---

# Game Account Select

负责需求、覆盖与交付编排。单账号资产评分交给对应游戏 skill；环境和平台事实交给 preflight/toolkit。预算、权重、区服与硬条件只保留在 run-only `selection_profile`，原始请求单独保留 `request_provenance`。

## 流程

1. 调用 `game-account-preflight`，展示可读摘要；后台加 `--unattended`。冻结 `browser_route: ego_browser`，由 ego-ops 治理，整个查询复用一个有明确归属的 task space，保存数字 id。
2. 读 [需求与交付细则](references/request-and-delivery.md) 与 [覆盖计划](references/source-coverage-playbook.md)。输出 success_criteria、selection_profile、coverage_plan；完整复合目标使用 custom，只有关键缺项或真实冲突才补问。画像完整就继续。
3. 读 [状态机](references/selection-state-machine.md)，按游戏路由评分。真实页面读取前通过 toolkit 检查 [support matrix](../game-account-toolkit/references/operation-support-matrix.json)；unsupported 记录 coverage_gaps 并降级。
4. 保存标准化事实、平台/社区尝试、时间字段、缺失与来源到 raw run artifact。每步有明确输入、输出和停止条件；采集时间不能替代上架/验号时间。
5. 按游戏 finalizer 生成报告、optimizer/evaluator sidecars、self_improve、quality_gate 和 delivery_contract。执行 POST_RUN_OPTIMIZE；非 info findings / redo_required 需补证、修复或按状态机降级。
6. 交付通过门禁的 final_response，保留预算分层、平台清单、近似项、风险和 Self-improve 摘要；完成本轮 task-space 精确清理，记录 cleanup_reports。

## 游戏路由

| 游戏 | Skill |
| --- | --- |
| 明日方舟 | game-account-arknights |
| 鸣潮 | game-account-wuthering-waves |
| 异环 | game-account-neverness-to-everness |
| 绝区零 | game-account-zenless-zone-zero |

未支持游戏使用 game-account-skill-generator；证据过期/跨版本/出现新资产使用 game-account-community-updater。生成或更新后必须运行 game-account-skill-evaluator。

## 按需上下文

- 确定编排边界、成功标准或停止条件：读 [selector architecture](references/selector-architecture.md)。
- 首次真实页面操作：通过 toolkit 读 [ego-browser workflow](../game-account-toolkit/references/ego-browser-workflow.md) 和 [ego-ops contract](../game-account-toolkit/references/ego-ops-query-contract.md)。用户接管、inactive 或未分配状态暂停，等待明确恢复授权。
- 组装 artifact 或跨 skill 交接：读 [skill I/O](../game-account-toolkit/references/skill-io-contract.md)。内部 `<recommendations>` / `<game_account_evaluation>` 标签不作为用户主文案。
- 收尾记录知识候选：读 [knowledge ledger](references/knowledge-ledger.md)；包含 evidence、observed_in、suggested_targets、apply_status 和 source_scope。
- 用户要求实现改进或问题复发：调用 game-account-skill-optimizer，按 [学习闭环](../game-account-skill-optimizer/references/learning-loop.md) 收集、修复和验证。已有授权继续执行；applied 需要实际文件变化与当前回归凭据，verified_existing 仅为既有机制复核。

## 常用入口

```bash
node skills/game-account-select/scripts/parse-selection-profile.mjs --request '明日方舟，限定多，1000元左右' --json
node skills/game-account-select/scripts/create-run-artifact.mjs --game '明日方舟' --user-request '明日方舟，限定多，1000元左右' --json
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input <run-artifact.json> --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<run-artifact.json> --json
```

单次筛选默认记录改进候选；实现改进仅在任务授权范围内。画像衍生预算/权重/区服/风险/硬条件不得写入 durable references，即使用户要求优化 skill 也不例外；selector-session-preference-leak 必须阻塞。
