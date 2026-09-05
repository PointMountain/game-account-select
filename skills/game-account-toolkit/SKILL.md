---
name: game-account-toolkit
description: 游戏账号的共享执行底座；处理环境、ego-ops/ego-browser 页面事实、字段抽取、来源与精确清理，并提供游戏 evaluator/finalizer 模板和公共契约。
argument-hint: "[check|platform|extract|finalize]"
---

# Game Account Toolkit

输出结构化事实与风险；游戏价值由游戏 skill 判断，最终排序由 selector 负责。动态页面统一经 ego-ops 已验证 operation、ego-browser 单一 task space 读取。

## 按任务读取

| 场景 | 上下文 |
| --- | --- |
| 环境或依赖异常 | game-account-preflight、[dependency state machine](references/dependency-state-machine.md) |
| 读取列表/详情/动态社区 | [运行流程](references/runtime-workflow.md)、[support matrix](references/operation-support-matrix.json)、[ego-ops contract](references/ego-ops-query-contract.md)、[ego-browser workflow](references/ego-browser-workflow.md) |
| 平台受限、查询降级 | [platform access policy](references/platform-access-policy.md) |
| 标准化字段或跨 skill 交接 | [shared listing schema](references/shared-listing-schema.md)、[skill I/O contract](references/skill-io-contract.md) |
| 当前版本角色/装备评价 | [community research protocol](references/community-research-protocol.md) |
| 新游戏或修改评分接口 | [game skill standard](references/game-skill-standard.md)、templates/game-skill/ |
| 实施与验证可复用改进 | [学习闭环](../game-account-skill-optimizer/references/learning-loop.md) |

## 执行

1. 调用 game-account-preflight。`scripts/check-deps.mjs` 是兼容入口，委托给 preflight；缺失依赖按依赖状态机处理。
2. 查询前检查 game/platform/list-or-detail capability 与外部 operation 知识。verified 才能正常执行；unsupported 记录 coverage gap 并 fail closed。exploration_only 仅在维护者受控探索中显式 `--allow-exploration`，验证回写前不可作为真实推荐能力。
3. 在本轮 task space 观察页面身份、对象和成功信号，抽取主体商品事实，保留来源。用语义读取、直接数据、必要视觉复核交叉验证。
4. 多平台传 `--task-space-disposition keep` 复用数字 id；父流程结束用 query:cleanup 精确清理。用户接管、inactive 或未分配错误是硬停止，等待明确恢复授权。
5. 真实评估用 `scripts/finalize-game-evaluation.mjs` 的共享实现生成确定性 report、sidecars、self_improve、quality_gate 与 delivery_contract。裸 applied 状态不计入已应用。

```bash
npm run query:ego -- --operation pzds/arknights-list --task-space <run-id> --limit 20 --json
npm run query:cleanup -- --task-space <id> --json
npm run verify:operation-support
```

## 边界

- 不绕过登录、验证码、风控或付费墙；低频读取，失败保留具体覆盖缺口。
- 不自动下单、联系卖家；安装、规则修改和外部写入沿用本轮授权。
- 浏览器清理只处理本轮所有对象，用户明确要求保留时才 keep。
- 变更平台查询能力需要离线验证与 `verify:live-game-skills`，并验证 task-space cleanup。操作优先级不等于实际支持。
