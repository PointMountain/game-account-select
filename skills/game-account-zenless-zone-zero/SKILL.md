---
name: game-account-zenless-zone-zero
description: 绝区零（Zenless Zone Zero / ZZZ）账号的版本化估值与筛选能力。结构化代理人/影画/专属音擎/队伍/资源/国际服区服与绑定风险，并以真实运行产物驱动受控 self-improve 闭环。
argument-hint: "[listing json, account description, or run artifact]"
---

# Game Account Zenless Zone Zero Skill

## 作用与边界

本 skill 负责绝区零资产事实标准化、可执行估值与证据化解释，不负责平台访问、交易、联系卖家或替用户决定购买。

永久知识只保存稳定事实、版本化社区证据和彼此独立的估值维度。预算、区服偏好、目标、权重、风险容忍度和硬条件只能进入当次 `selection_profile` / run artifact，`persistence_scope` 必须为 `run_only`，不得写成长期默认值。

## 必须读取

- `../game-account-toolkit/references/skill-io-contract.md`
- `../game-account-toolkit/references/game-skill-standard.md`
- `../game-account-toolkit/references/operation-support-matrix.json`
- `references/valuation-rules.md`
- `references/agent-knowledge.md`
- `references/signature-engines.json`
- `references/community-evidence.md`
- `references/changelog.md`

## 执行流程

1. 调用 `game-account-preflight` 并展示 `<preflight_report>`。
2. 真实买号评估先检查 `community-evidence.md`：快照满 7 天、跨版本、或出现未覆盖代理人/音擎时，调用 `game-account-community-updater` 或社区调研协议刷新。
3. 平台访问只复用 operation support matrix 中已验证的 `ego-ops` operation，并由 `ego-browser` 执行。PZDS 列表和详情已发布为 `pzds/zzz-list`、`pzds/zzz-detail`，主动找号时必须先由列表取得唯一商品编号，再在同一 task space 抽详情；PXB7 仍为 unsupported，`pxb7/zzz-detail` 仅是 `exploration_only` 候选，正常筛选不得调用。任何抽取都只采主体商品区，不得把推荐卡片混入资产。
4. 标准化时分别保留 `published_at`、`listed_at_raw` 与 `platform_verified_at`；相对时间不能伪装成绝对时间，缺失写 `null` / “未披露”。“满命”固定解析为影画 6，不得写成角色名或 0 命。
5. 用 `scripts/evaluate-listing.mjs` 调用可复用评分器；`scripts/validate-sample.mjs` 只负责回归，不再是唯一评分入口。
6. 当前“全部虚狩”按版本化名单检查；3.1 为星见雅、仪玄、叶瞬光、蕾米埃尔。旧“三虚狩”样本只作为历史兼容，必须明确缺少当前虚狩，不能继续声称“全虚狩”。
7. 输出资产强项、缺专属音擎、独立队伍、资源/养成、服务器区域、邮箱/HoYoverse/PSN/TAP、平台验号和找回保障；卖家自述只作为 seller claim。
8. 每次真实估值都写 run artifact，原始请求和派生画像分别进入 `request_provenance` 与 run-only `selection_profile`，并包含 `success_criteria`、`coverage_plan`、`coverage_gaps`、`platform_attempts`、`community_attempts`、`knowledge_update_candidates`、`experience_summary` 与 evaluation。
9. 必须由 `scripts/finalize-evaluation-run.mjs` 收尾：生成确定性 Markdown 报告，运行 `game-account-skill-optimizer` 和 raw-artifact evaluator，并将 optimizer/evaluator sidecar、`self_improve`、`quality_gate`、知识候选 applied/pending 状态和带 `final_response_sha256` 的 `delivery_contract` 回写 artifact。
10. 任何非 `info` optimizer finding 或 evaluator `redo_required` 都要继续修复、补证或明确降级，不能以“已总结经验”代替闭环。

示例：

```bash
node skills/game-account-zenless-zone-zero/scripts/evaluate-listing.mjs \
  --input skills/game-account-zenless-zone-zero/test-fixtures/pxb7-jjbol4373.json

node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/zzz-list --task-space <run-id> --limit 20 --task-space-disposition keep --json
node skills/game-account-toolkit/scripts/run-ego-operation.mjs --operation pzds/zzz-detail --task-space <run-id> --input <listing-id> --task-space-disposition keep --json

node skills/game-account-zenless-zone-zero/scripts/finalize-evaluation-run.mjs \
  --input /tmp/zzz-account-run.json \
  --report-out /tmp/zzz-account-run.md
```

## 独立估值维度

- `asset_score`：版本化限定核心、影画断点、免费/常驻供给折价；S 数量不是价值代理。
- `engine_score`：逐名匹配 `signature-engines.json`；总 S 音擎数不能替代归属。
- `team_score`：独立可用队伍与不重复占用关键队友；当前虚狩完整性单独核验。
- `resource_score`：菲林与菲林底片按 160:1，加密/原装母带与邦布券按 1:1。
- `progression_score`：绳匠等级、式舆/危局/零号空洞及养成披露。
- `price_fit_score`：只表达本轮市场对比与价格效率，不改变账号固有资产质量。
- `risk_penalty`：邮箱交付/实名、HoYoverse、PSN/TAP、区服区域、验号与找回保障。
- `confidence_penalty`：未披露资源、平台验号、音擎归属、绝对挂牌时间等缺失事实。

输出 `<game_account_evaluation>` 机器对象时至少保留：

```yaml
zenless_zone_zero_score:
  asset_score: number
  engine_score: number
  team_score: number
  resource_score: number
  progression_score: number
  price_fit_score: number
  risk_penalty: number
  confidence_penalty: number
  final_score: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
```

用户可见最终答复不得暴露原始 XML 标签；应使用自然语言或 Markdown 表格，并分开标明“挂牌价”“合理成交区间”“前置核验条件”。

## Self-improve 边界

每次真实执行都必须输出结构化 `self_improve`：

- `summary_generated` 与本轮有效/失效的解析字段。
- optimizer/evaluator 报告路径、质量状态和阻塞 finding。
- `knowledge_update_candidates` 的证据、目标文件、验证命令、`apply_status`。
- 知识候选总数、已应用数、待验证/延期数。

允许受控自动沉淀：平台主体区解析、字段别名、代理人/音擎已核实名称、脱敏 fixture、证据日期和官方确认的稳定供给事实。估值/强度变化必须有当前版本官方事实与至少两条独立社区证据，并通过 `validate-sample.mjs`、真实 fixture 和 evaluator 后才能标 `applied`。

禁止沉淀：本轮预算、目标、权重、区服偏好、风险容忍度、议价区间与用户硬条件。`proposed` / `deferred` 必须在最终答复里显示为待验证，不能冒充 self-improve 已完成。
