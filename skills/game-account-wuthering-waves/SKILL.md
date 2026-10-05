---
name: game-account-wuthering-waves
description: Wuthering Waves（鸣潮）账号估值和筛选规则，重点区分限定/版本强势角色、常驻角色高命、专武、抽卡资源和绑定风险。
argument-hint: "[listing json or account description]"
---

# Game Account Wuthering Waves Skill

## 作用

对 Wuthering Waves（鸣潮）账号进行游戏资产估值。该 skill 只负责游戏内价值判断；平台数据由 `game-account-select` 经 `game-account-toolkit` 的已验证 `ego-ops` operation 获取，并由 `ego-browser` 在单一 task space 中执行。

预算、区服、目标、权重、风险容忍度和硬条件只能存在于当次 `selection_profile` / run artifact，且 `persistence_scope: run_only`。不得把任何一次用户画像写成长期估值默认值。

## 按需读取

评分与组装 `<game_account_evaluation>` 前读 [估值输出契约](references/evaluation-contract.md)；应用改进时读 [学习闭环](../game-account-skill-optimizer/references/learning-loop.md)，applied 需当前验证凭据。
真实查询先读 [当前证据与字段核验](../game-account-toolkit/references/current-evidence-workflow.md)：按队伍、共鸣链和专武缺口定向取证，记录版本与字段来源。

- `../game-account-toolkit/references/skill-io-contract.md`
- 新增/修改规则时读 [game-skill-standard](../game-account-toolkit/references/game-skill-standard.md)。
- 查询平台前读 [operation support matrix](../game-account-toolkit/references/operation-support-matrix.json)。
- `references/valuation-rules.md`
- `references/character-knowledge.md`
- `references/community-evidence.md`
- 修改规则或追溯决策时读 [changelog](references/changelog.md)。

## 执行前准备

先调用 `game-account-preflight`，并在账号估值前显示 `<preflight_report>`。如果缺少必需依赖，停止估值并给出补齐步骤；如果需要刷新社区证据，调用 `game-account-community-updater` 或按 `game-account-toolkit/references/community-research-protocol.md` 执行当次调研。

## 核心原则

Wuthering Waves（鸣潮）账号不能把总黄数、五星角色数量、五星武器数量或常驻角色高命当作主要价值来源。常驻/弱势角色高命只给低权重。

优先看：

- 限定/版本强势角色
- 关键命座
- 专武
- 队伍完整度
- 星声、月相、浮金波纹、铸潮波纹等资源
- TAP/Wegame 绑定风险
- 官服/B服/渠道服

## 执行流程

1. 将用户请求冻结为 run-only `selection_profile`，原始请求另存于 `request_provenance` 并保留 SHA-256。
2. 平台查询前读取 operation support matrix。螃蟹使用 `pxb7/wuthering-waves-list`、`pxb7/wuthering-waves-detail`，盼之使用 `pzds/wuthering-waves-list`、`pzds/wuthering-waves-detail`；主动找号时在同一 task space 依次读取两边列表，并对各自短名单做详情复核。只采主体商品区，保留平台清单、来源和覆盖缺口。
3. 标准化挂牌后运行可复用评分入口：

   ```bash
   node skills/game-account-wuthering-waves/scripts/evaluate-listing.mjs --input <listing.json> --out <evaluation.json>
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/wuthering-waves-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/wuthering-waves-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/wuthering-waves-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/wuthering-waves-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
   ```

4. `scripts/validate-sample.mjs` 只负责离线 trap 回归，不是唯一评分入口。
5. 每次真实评估写有唯一 `run_id` 的 raw artifact，保留 evaluator 的 `source_listing` / `evidence_policy`，以及 selection_profile、request_provenance、coverage_plan、platform_attempts、coverage_gaps、knowledge_update_candidates 与 evaluation。
6. 使用 finalizer 收尾：

   ```bash
   node skills/game-account-wuthering-waves/scripts/finalize-evaluation-run.mjs --input <run-artifact.json> --report-out <report.md>
   ```

   它必须生成确定性 Markdown、optimizer/evaluator sidecar、`self_improve`、`quality_gate` 和带 `final_response_sha256` 的 `delivery_contract`。任一非 info finding 或 `redo_required` 都必须补证、修复或明确降级后再交付。

## 输入

接受标准化挂牌、卖家描述或截图 OCR 后文本。

当前证据读取 `references/community-evidence.json`。主张或原始来源满7天、跨版本、或出现未覆盖角色/武器时，定向刷新；历史 Markdown 和静态分只用于初筛。缺版本、队伍适用性或关键字段证据的账号必须留在待核实，不能因静态分高进入主推荐。

## 自我优化

真实运行 finalizer 自动 collect 并生成 `.repair-plan.json`；当前 Agent 按已有授权执行。反馈先记录为知识候选，以当前独立证据、固定旧回归、三类画像对比和当前验证凭据支持 applied。用户本轮画像不得沉淀。最终答复原样交付通过门禁的 report。
