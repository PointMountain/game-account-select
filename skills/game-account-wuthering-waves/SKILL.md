---
name: game-account-wuthering-waves
description: Wuthering Waves（鸣潮）账号估值和筛选规则，重点区分限定/版本强势角色、常驻角色高命、专武、抽卡资源和绑定风险。
argument-hint: "[listing json or account description]"
---

# Game Account Wuthering Waves Skill

## 作用

对 Wuthering Waves（鸣潮）账号进行游戏资产估值。该 skill 只负责游戏内价值判断；平台数据由 `game-account-select` 经 `game-account-toolkit` 的已验证 `ego-ops` operation 获取，并由 `ego-browser` 在单一 task space 中执行。

预算、区服、目标、权重、风险容忍度和硬条件只能存在于当次 `selection_profile` / run artifact，且 `persistence_scope: run_only`。不得把任何一次用户画像写成长期估值默认值。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/operation-support-matrix.json`
- `references/valuation-rules.md`
- `references/character-knowledge.md`
- `references/community-evidence.md`
- `references/changelog.md`

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
2. 平台查询前读取 operation support matrix。PZDS 主动找号使用已验证的 `pzds/wuthering-waves-list` 与 `pzds/wuthering-waves-detail`，同一 task space 内先列表后详情；PXB7 仍标为 unsupported，不得声称已覆盖。
3. 标准化挂牌后运行可复用评分入口：

   ```bash
   node skills/game-account-wuthering-waves/scripts/evaluate-listing.mjs --input <listing.json> --out <evaluation.json>
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/wuthering-waves-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
   node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/wuthering-waves-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
   ```

4. `scripts/validate-sample.mjs` 只负责离线 trap 回归，不是唯一评分入口。
5. 每次真实评估写 raw run artifact，至少包含 `selection_profile`、`request_provenance`、`coverage_plan`、`platform_attempts`、`coverage_gaps`、`knowledge_update_candidates` 与 evaluation。
6. 使用 finalizer 收尾：

   ```bash
   node skills/game-account-wuthering-waves/scripts/finalize-evaluation-run.mjs --input <run-artifact.json> --report-out <report.md>
   ```

   它必须生成确定性 Markdown、optimizer/evaluator sidecar、`self_improve`、`quality_gate` 和带 `final_response_sha256` 的 `delivery_contract`。任一非 info finding 或 `redo_required` 都必须补证、修复或明确降级后再交付。

## 输入

接受标准化挂牌、卖家描述或截图 OCR 后文本。

若输入没有包含社区证据快照，先读取 `references/community-evidence.md`。如果快照超过 30 天、跨大版本、或用户样本里出现快照没有覆盖的新角色/新武器，必须降低 `confidence` 并输出 `rule_update_suggestion`。

## 输出

必须输出 `<game_account_evaluation>`，同时保留下列字段：

```yaml
wuthering_waves_score:
  asset_score: number
  resource_score: number
  team_score: number
  risk_penalty: number
  confidence_penalty: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
  rule_update_suggestion: string | null
```

示例：

```xml
<game_account_evaluation>
  <game>Wuthering Waves</game>
  <listing_id>来源账号编号</listing_id>
  <score format="json">{}</score>
  <confidence>low|medium|high</confidence>
  <community_comparison>strong alignment|partial alignment|conflict</community_comparison>
  <missing_fields format="json">[]</missing_fields>
</game_account_evaluation>
```

## 自我优化

如果用户指出某个角色/命座/队伍判断错误，不要立即改文件。先写入 `knowledge_update_candidates`；只有稳定事实或具备版本化证据的规则通过样例、finalizer 和 evaluator 后才能应用。用户本轮画像永远不得沉淀。最终答复必须原样交付通过门禁的 report，不得手写替换。
