---
name: game-account-neverness-to-everness
description: Neverness to Everness（异环）账号估值和筛选规则，关注 S 角色、S 弧盘、觉醒、环石/异晶/骰子资源、主角与账号类型风险。
argument-hint: "[listing json or account description]"
---

# Game Account Neverness to Everness Skill

## 作用

对 Neverness to Everness（异环）账号进行游戏资产估值。该 skill 只负责游戏内价值判断；平台数据由 `game-account-select` 经 `game-account-toolkit` 的已验证 `ego-ops` operation 获取，并由 `ego-browser` 在单一 task space 中执行。

预算、区服、目标、权重、风险容忍度和硬条件只进入当次 `selection_profile` / run artifact，`persistence_scope` 必须为 `run_only`，不得固化为长期估值规则。

## 按需读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/operation-support-matrix.json`
- `references/valuation-rules.md`
- `references/asset-knowledge.md`
- `references/community-evidence.md`
- 追溯或修改规则时读 [changelog](references/changelog.md) 和 [学习闭环](../game-account-skill-optimizer/references/learning-loop.md)。applied 需当前验证凭据。

## 执行前准备

先调用 `game-account-preflight`，并在账号估值前显示 `<preflight_report>`。如果缺少必需依赖，停止估值并给出补齐步骤；如果社区证据不足、版本变化或用户样本出现未覆盖 S 角色/弧盘，调用 `game-account-community-updater` 或按社区调研协议刷新。

## 核心维度

- 猎人等级
- S 级角色数量与质量
- S 级弧盘数量与质量
- 角色觉醒
- 环石、异晶、质实骰子、三重钥匙等资源
- 主角性别或主角相关限制
- TAP 绑定、完美账号/B服等账号类型风险

## 执行流程

1. 将原始请求与派生画像分开记录到 `request_provenance` 和 run-only `selection_profile`。
2. 平台查询前读取 operation support matrix。螃蟹使用 `pxb7/neverness-to-everness-list`、`pxb7/neverness-to-everness-detail`，盼之使用 `pzds/neverness-to-everness-list`、`pzds/neverness-to-everness-detail`；主动找号时在同一 task space 依次读取两边列表，并对各自短名单做详情复核。只采主体商品区，保留平台清单、来源和覆盖缺口。
3. 运行可复用评分入口：

   ```bash
   node skills/game-account-neverness-to-everness/scripts/evaluate-listing.mjs --input <listing.json> --out <evaluation.json>
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/neverness-to-everness-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/neverness-to-everness-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/neverness-to-everness-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/neverness-to-everness-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
   ```

4. `scripts/validate-sample.mjs` 只做离线 trap 回归。
5. 真实评估的 raw run artifact 至少包含 `coverage_plan`、`platform_attempts`、`coverage_gaps`、`knowledge_update_candidates` 与 evaluation。
6. 使用 `scripts/finalize-evaluation-run.mjs` 生成确定性 Markdown、optimizer/evaluator sidecar、`self_improve`、`quality_gate` 和带 `final_response_sha256` 的 `delivery_contract`。任何非 info finding 或 `redo_required` 都不得交付为已完成结果。

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
neverness_to_everness_score:
  asset_score: number
  resource_score: number
  progression_score: number
  risk_penalty: number
  confidence_penalty: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
  rule_update_suggestion: string | null
```

## 自我优化

Neverness to Everness（异环）规则随游戏版本和市场成熟度变化较快。任何角色、弧盘、觉醒权重更新必须先进入 `knowledge_update_candidates`，通过样例、finalizer 和 evaluator 后才能应用；估值变化仍需用户确认。运行画像不得沉淀。最终答复必须原样交付通过门禁的 report。
