---
name: game-account-zenless-zone-zero
description: 绝区零（Zenless Zone Zero / ZZZ）账号的版本化估值与筛选能力。结构化代理人/影画/专属音擎/队伍/资源/国际服区服与绑定风险，并以真实运行产物驱动受控 self-improve 闭环。
argument-hint: "[listing json, account description, or run artifact]"
---

# Game Account Zenless Zone Zero Skill

## 作用与边界

本 skill 负责绝区零资产事实标准化、可执行估值与证据化解释，不负责平台访问、交易、联系卖家或替用户决定购买。

永久知识只保存稳定事实、版本化社区证据和彼此独立的估值维度。预算、区服偏好、目标、权重、风险容忍度和硬条件只能进入当次 `selection_profile` / run artifact，`persistence_scope` 必须为 `run_only`，不得写成长期默认值。

## 按需读取

评分与组装 `<game_account_evaluation>` 前读 [估值输出契约](references/evaluation-contract.md)；应用改进时读 [学习闭环](../game-account-skill-optimizer/references/learning-loop.md)，applied 需当前验证凭据。
真实查询先读 [当前证据与字段核验](../game-account-toolkit/references/current-evidence-workflow.md)：生成取证任务、记录本轮版本、逐字段补证，收尾执行修复清单。

- `../game-account-toolkit/references/skill-io-contract.md`
- 新增/修改规则时读 [game-skill-standard](../game-account-toolkit/references/game-skill-standard.md)。
- 查询平台前读 [operation support matrix](../game-account-toolkit/references/operation-support-matrix.json)。
- `references/valuation-rules.md`
- `references/agent-knowledge.md`
- `references/signature-engines.json`
- `references/community-evidence.md`
- 修改规则或追溯决策时读 [changelog](references/changelog.md)。

## 执行流程

1. 调用 `game-account-preflight` 并展示 `<preflight_report>`。
2. 真实买号评估先检查 `community-evidence.json`：主张或原始来源满7天、跨版本、或出现未覆盖代理人/音擎时，调用 updater 刷新。Markdown 和静态分仅为历史初筛依据；当前来源不足则待核实。
3. 平台查询由 `ego-ops` 治理、`ego-browser` 执行，查询前读取 operation support matrix。螃蟹使用 `pxb7/zzz-list`、`pxb7/zzz-detail`，盼之使用 `pzds/zzz-list`、`pzds/zzz-detail`；主动找号时在同一 task space 依次读取两边列表，并对各自短名单做详情复核。只采主体商品区，保留平台清单、来源和覆盖缺口。
4. 标准化时分别保留 `published_at`、`listed_at_raw` 与 `platform_verified_at`；相对时间不能伪装成绝对时间，缺失写 `null` / “未披露”。“满命”固定解析为影画 6，不得写成角色名或 0 命。
5. 用 `scripts/evaluate-listing.mjs` 调用可复用评分器；`scripts/validate-sample.mjs` 只负责回归，不再是唯一评分入口。
6. “全部虚狩”先核实当次版本名单；3.1 四人名单和旧“三虚狩”均为历史参考。缺最新名单或独立队伍证据时，不声称“全虚狩”。
7. 输出资产强项、缺专属音擎、独立队伍、资源/养成、服务器区域、邮箱/HoYoverse/PSN/TAP、平台验号和找回保障；卖家自述只作为 seller claim。
8. 每次真实估值写有唯一 `run_id` 的 artifact，保留 evaluator 的 `source_listing` / `evidence_policy`。原始请求和画像分存 `request_provenance` 与 run-only `selection_profile`；保留 success_criteria、coverage_plan、coverage_gaps、platform_attempts、community_attempts、knowledge_update_candidates 与 evaluation。
9. 必须由 `scripts/finalize-evaluation-run.mjs` 收尾：生成确定性 Markdown 报告，运行 `game-account-skill-optimizer` 和 raw-artifact evaluator，并将 optimizer/evaluator sidecar、`self_improve`、`quality_gate`、知识候选 applied/pending 状态和带 `final_response_sha256` 的 `delivery_contract` 回写 artifact。
10. finalizer 重算推荐资格，缺证据项留在 `pending_verification`，真实运行自动 collect 并生成 `.repair-plan.json`。当前 Agent 按授权执行；非 info finding 或 redo_required 继续修复、补证或明确降级。

示例：

```bash
node skills/game-account-zenless-zone-zero/scripts/evaluate-listing.mjs \
  --input skills/game-account-zenless-zone-zero/test-fixtures/pxb7-jjbol4373.json

node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/zzz-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pxb7/zzz-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json
node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/zzz-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/zzz-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json

node skills/game-account-zenless-zone-zero/scripts/finalize-evaluation-run.mjs \
  --input /tmp/zzz-account-run.json \
  --report-out /tmp/zzz-account-run.md
```

## Self-improve 边界

每次真实执行都必须输出结构化 `self_improve`：

- `summary_generated` 与本轮有效/失效的解析字段。
- optimizer/evaluator 报告路径、质量状态和阻塞 finding。
- `knowledge_update_candidates` 的证据、目标文件、验证命令、`apply_status`。
- 知识候选总数、已应用数、待验证/延期数。

允许受控自动沉淀：平台主体区解析、字段别名、代理人/音擎已核实名称、脱敏 fixture、证据日期和官方确认的稳定供给事实。估值/强度变化必须有当前版本官方事实与至少两条独立社区证据，并通过 `validate-sample.mjs`、真实 fixture 和 evaluator 后才能标 `applied`。

禁止沉淀：本轮预算、目标、权重、区服偏好、风险容忍度、议价区间与用户硬条件。`proposed` / `deferred` 必须在最终答复里显示为待验证，不能冒充 self-improve 已完成。
