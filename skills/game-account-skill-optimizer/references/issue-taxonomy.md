# Skill 优化问题分类

updated_at: 2026-08-12

## 分类

### output-dual-platform-shortlists-missing

- 明日方舟主动找号在 `platforms_required` 包含 `pxb7` 和 `pzds` 时，必须输出 `platform_shortlists.pxb7` 与 `platform_shortlists.pzds`。
- 两段都必须有 `display_candidates`；若没有完全符合项，允许展示明确标注的 near match / list-only 项，但不得删除该平台段或伪造合格项。
- 跨平台总榜可以通过 `best_value_listing` 选择任一平台的性价比第一。

### output-in-budget-near-match-not-rendered

- 预算内没有完整满足项、但 `near_match_listings` 已有主预算内详情复核账号时，最终答复必须展示这些账号的 ID/URL，不能只显示预算外精确项。
- 报告按“预算内完整满足数量 → 预算内接近项 → 预算外完整满足项”固定分层；完整满足为零时必须明示 0，否则触发 `output-budget-status-undisclosed`。
- 预算外账号可以进入跨平台性价比判断，但不能把预算内对照项从用户视野中挤掉。

### selection-raw-request-provenance-missing

- `user_request` 必须保留用户原话。资源阈值、标准化别名或当前卡池推导只能写入 `request_provenance.profile_input`，并分别保存 raw/profile SHA-256。
- 用合成 prompt 覆盖原话、缺哈希或 provenance 与 `user_request` 不一致均为 high finding。

### output-final-delivery-contract-missing

- Finalizer 必须生成 `delivery_contract.mode: verbatim_required`，哈希匹配 `final_response`，并包含预算分层、双平台表格和 Self-improve 必需章节。
- 如果存在 `delivered_response`/delivery receipt 且其哈希与 deterministic report 不一致，触发 `output-final-delivery-artifact-mismatch`；这代表 evaluator 验证的不是用户实际收到的内容。
- `self_improve` 只存在 artifact、用户可见结果没有复盘章节时，触发 `self-improve-user-summary-missing`。

### selector-unscoped-freeform-exclusion

- 账号新度、活跃度、陈年/仓库号或阵容断代描述出现在 `selection_profile.exclusions` 时触发 `high` finding。
- 这类描述不能用干员名单证明，应迁移到 run-only `soft_preferences` 并进入人工验号；干员排除保留精确名和稳定别名边界。

### selection-reconciliation-unvalidated

- 从旧画像 artifact 恢复候选、手工改写 `hard_filter_passed`/分数或定向刷新后合并时，必须带 `provenance_reconciliation.validation`。
- validation 至少包含 `status: passed`、`method: canonical_rescore`、与当前画像一致的 `profile_digest`、`validation_command`、`validated_at`，以及覆盖全部刷新候选的 `rescored_listing_ids`。
- 任一项缺失都视为质量门禁绕过，触发 `high` finding 并要求 evaluator `redo_required: true`。

## 自动补丁边界

`autopatch_safe: true` 只适合流程文档、平台顺序、输出格式和运行记录字段这类低风险改动。估值权重、社区 meta、高价值角色分层、平台解析器实现、质量门禁豁免和风险扣分默认 `autopatch_safe: false`，除非用户明确要求实现并且验证脚本覆盖对应误判。

### troubleshooting

执行失败、工具报错、依赖缺失或流程卡住。Troubleshooting 是所有分类之前的第一步：先定位失败阶段，再决定改哪个 skill。

常见信号：

- `errors`、`exceptions`、`tool_failures`、`blocked_steps` 非空。
- 预检查缺必需依赖。
- 脚本异常退出。
- 优化器无法判断目标 skill 或目标文件。

建议：

- 先补运行证据和复现命令。
- 区分是环境问题、平台访问问题、规则问题还是输出契约问题。
- 不要用估值权重变化掩盖工具失败。

### runtime

执行耗时、无响应、重复等待、没有及时切换路径。

常见信号：

- `status: timeout`
- `duration_ms` 超过 30000
- 同一平台同一意图重复失败
- 命令无输出但进程长期运行

建议：

- 给该平台设置等待预算。
- 失败后进入降级路径，不反复重试。
- 把失败原因写入数据来源限制。
- 对社区来源同样适用等待预算；`duration_ms` 较长但缺少 `wait_budget_ms` 时，应补运行记录字段，便于下次判断是否该提前降级。
- PZDS 需要多个逻辑批次时应合并为单次累积扫描，避免每批重新导航和从头 `loadMore`；在 `platform_attempts[].list_attempts` 记录实际扫描策略与耗时。
- ego-browser 查询必须有可追踪 `query_session_id` 和 task space id/name，结束后运行 `npm run query:cleanup -- --task-space <id> --json` 并把清理报告写入 artifact。若报告 `ok:false`、`ego_task_spaces_remaining` 非空，或清理后仍有本轮 `ego-browser nodejs`、`run-with-timeout`、`pxb7/pzds/zzz-detail`、`selectPageList`、`goodsList/275` 进程，输出 `runtime-browser-session-cleanup-missing`，先完成 task space 并处理残留再结束。

### empty_result

平台返回空结果、登录提示、验证页面或无法读取候选。

常见信号：

- `result_count: 0`
- `login_required`
- `blocked`
- `verification`
- 页面只有“登录后推荐”而没有商品卡片

建议：

- 标记平台当前不可用或需要用户登录/截图。
- 改用用户提供链接、公开详情页或其它平台。

### platform_coverage

用户目标市场的主流平台没有被纳入搜索顺序。

当前中国账号交易平台优先级以 `game-account-toolkit/references/platform-priority.json` 为准。核心含义：

- 用户指定平台或链接优先。
- 螃蟹账号代售：`https://www.pxb7.com/`
- 盼之代售：`https://www.pzds.com/`
- 交易猫。
- 淘手游。
- 闲鱼仅作为补充，且经常受登录、推荐流和风控影响。

建议：

- 更新平台访问策略和主筛选状态机。
- 不要声明已覆盖没有实际读取的平台。
- 真实主动筛选必须先有 `coverage_plan.source_tasks`。如果运行记录已经包含平台尝试、社区尝试或推荐结果，但没有覆盖计划，输出 `selector-source-coverage-plan-missing`；目标文件包括 `game-account-select` 架构、覆盖手册、状态机、共享 schema 和 evaluator rubric。
- 若平台经常复用、浏览器可见且当前 `opencli list` 没有对应站点命令，应生成 `platform-opencli-adapter-gap` finding，建议按 OpenCLI adapter 流程建立私有 adapter。
- Adapter 实现不是默认自动补丁；必须完成站点侦察、endpoint 验证、字段核对和 `opencli browser verify <site>/<command>` 后，才能把该 adapter 当作可靠平台来源。
- 若已存在并验证通过，应生成 `platform-opencli-adapter-reuse` finding，提醒下次优先复用 adapter 命令，而不是继续临时 DOM 抽取。
- 列表页和详情页能力要分开判断：只有详情 adapter 可用时，不应把整个平台标成“无 adapter”；应对详情输出复用建议，对列表页缺口单独记录。
- 对绝区零的螃蟹/盼之详情，已验证 adapter 还应输出角色资产角标 `agentStatuses`；如果推荐只保留 `voidHunters` 或标题文本，应生成 `platform-agent-status-asset-cards-missing` finding。

### pzds_route_mismatch

盼之列表页 URL 被错误构造，导致看似访问了 PZDS，实际进入了错误游戏或错误频道。

常见信号：

- 绝区零详情 URL 形如 `goodsDetails/<listingId>/6`，执行记录据此访问 `goodsList/6`。
- `goodsList/6` 页面标题、面包屑、筛选项或商品卡显示为英雄联盟、其它游戏或非绝区零内容。
- 运行记录写了 PZDS `partial/success`，但证据里有 `wrong_game`、`非绝区零`、`错误频道` 或“详情页末尾 /6 被当作列表 gameId”。

建议：

- 输出 `platform-pzds-zzz-list-route-mismatch`，严重级别为 `high`，目标文件包括 selector 状态机和平台访问策略。
- 绝区零列表从 `https://www.pzds.com/gameList` 自然导航，或使用已由浏览器确认标题/筛选项为绝区零的 `https://www.pzds.com/goodsList/275`。
- 错路由不得计为 PZDS 覆盖；如果正确列表为空，记录为空结果并降级到已知详情样本、用户链接、截图或复制文本。

### adapter_gap

目标网站没有可复用 OpenCLI adapter，导致每次都重复写临时 ego-browser DOM 抽取、手动解析或截图降级。

常见信号：

- `adapter_available: false` 或 `opencli_adapter_available: false`
- `list_adapter_available: false` 且列表页需要反复通过 ego-browser DOM 读取
- `detail_adapter_available: false` 且详情页需要反复通过 ego-browser DOM 读取
- 运行记录包含 `no opencli adapter`、`missing adapter`、`没有适配器`
- `fallback_used: ego_browser_semantic` / `ego_browser_direct` / `ego_browser_visual` 且同平台会反复用于账号筛选

建议：

- 先用 `opencli list -f yaml` 和 `opencli <site> -h` 确认确实没有现成站点命令。
- 对浏览器可见、数据来自 HTTP/JSON/HTML、无需绕过验证码/风控/付费墙的平台，调用 `opencli-adapter-author` workflow：`opencli browser analyze <url>`、`opencli browser init <site>/<command>`、字段解码、`opencli browser verify <site>/<command> --write-fixture`。
- 把 endpoint、字段映射、notes 和 verify fixture 写入 `~/.opencli/sites/<site>/`；若 adapter 已脱敏且可复用，再同步到 `game-account-toolkit/opencli-adapters`，下次筛选优先复用 adapter。
- 若数据只在不可稳定访问的交互、图片、验证码或付费内容里，停止 adapter 化，降级为用户提供链接、截图或复制文本。

### adapter_reuse

目标网站已有通过 OpenCLI verify 的 adapter，后续筛选应优先使用结构化命令，并把验证命令写入运行记录。

常见信号：

- `adapter_available: true` 或 `opencli_adapter_available: true`
- `detail_adapter_available: true`
- `adapter_verified: true`
- `adapter_command` 类似 `opencli pxb7 zzz-detail <url> -f json`
- `verify_command` 类似 `opencli browser <session> verify pxb7/zzz-detail --strict-memory`

建议：

- 输出 `platform-opencli-adapter-reuse` finding，并把 `adapter_command` 与 `verify_command` 放入 evidence。
- 不再输出 `platform-opencli-adapter-gap`，除非 adapter 验证失败或能力不足。
- 若 adapter 输出字段缺失、fixture mismatch 或网页肉眼值不一致，修 adapter；不要用游戏估值规则掩盖解析错误。

### asset_status_extraction

账号详情页存在角色卡片角标或 S 级音擎清单，但运行记录没有把它结构化保存，导致影画和专属音擎归属只能靠标题猜测。

常见信号：

- 绝区零账号来自 `pxb7/zzz-detail` 或 `pzds/zzz-detail` verified adapter。
- 运行记录包含 `voidHunters`、S 代理人总数、标题“几命”，但推荐/备选缺少 `agentStatuses` 或 `game_assets.agent_statuses`。
- `agentStatuses` 存在但多为 `x` 单数字，推荐却声称“带专武/专武齐全”，同时缺少 `sWEngineNames`、`game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name`。
- 用户要求“全部虚狩和对应辅助/专武”，但输出没有说明资产卡角标来源。

建议：

- 修复或复用 OpenCLI detail adapter，让它滚动到资产卡片区域并输出浅层 `agentStatuses`，同时读取 S 级音擎名称清单 `sWEngineNames`。
- 在 `shared-listing-schema.md`、`selection-state-machine.md` 和对应游戏 `valuation-rules.md` 中要求保留该字段。
- `x+y` 表示该角色有 `y` 个对应专属音擎；只有 `x` 时必须用本地专武表和 S 音擎名称交叉确认，不能只看总 S 音擎数。
- 不能读取角标或 S 音擎名称时，把账号降级为 `source_status: partial` 并列为人工确认。

### output_format

机器可读标签直接出现在用户主文案中，导致回复不自然。

常见信号：

- 最终回复包含 `<game_account_evaluation>`
- 最终回复包含 `<recommendations>` 且没有自然语言摘要
- JSON 过长且没有解释
- 推荐、备选或排除账号缺商品链接，用户无法打开比较。
- 平台详情已经提供上架时间或验号时间，但标准化推荐没有保留 `published_at` / `platform_verified_at`，或把抓取时间冒充其中之一。
- 用户允许预算上下浮动，但输出没有单独列出价格浮动备选。

建议：

- 用户可见部分先给推荐结论、理由、风险和人工确认项。
- 每个推荐、备选和排除项分别展示“上架时间 / 平台验号时间”；缺失写“未披露”，两者不得混用。
- 机器标签只在调试、日志或用户明确要求结构化输出时展示。
- Top 推荐、价格浮动备选、风险备选和排除列表都保留 URL；超预算 200-300 元的账号只进“价格浮动备选”，不得混入主推荐。
- 明日方舟双平台结果必须通过确定性 renderer 生成 Markdown 表格；artifact 已有候选却在最终答复中漏行时，输出 `output-platform-shortlist-render-underfilled`，保留各平台 available/expected/actual 数量证据。
- 扩价运行还必须核对预算内 near-match 的 ID/URL 是否真实出现在最终答复；仅判断数组非空不足以证明用户看到了预算内选择。

### self_improve_closeout

真实筛选只写一句经验总结或口头声称运行 optimizer/evaluator，但没有结构化收尾状态与报告。

建议：

- 生成 `self_improve`，分别记录经验摘要、覆盖缺口、optimizer、evaluator 和知识候选状态。
- 区分 `applied` 与 `proposed/deferred`；未通过证据和回归的估值变化不得伪装成已自动应用。
- 最终表格生成后再运行 optimizer/evaluator；存在非 info finding 时必须 `redo_required`，不得交付为完成态。

### valuation

估值规则漏掉关键游戏理解或过度依赖单一字段。该分类适用于所有游戏 skill，不只适用于鸣潮。

常见信号：

- 只看命座、专武或总稀有度。
- 忽略热门配队、主 C 是否带专武、队伍角色关系。
- 忽略绝区零专属音擎/队伍/邦布，明日方舟专精/模组/限定联动，异环弧盘/觉醒等游戏特有资产。
- 用户反馈某个队伍或角色价值判断错误。
- 用户要求多个核心分别成队，但推荐把共享队友重复计算，例如“三虚狩 + 两个辅助”被当成三支完整队。
- 用户指出需要优先找最适配队友，再列下位替代，例如绝区零星见雅优先确认柚叶，不能只说有泛用辅助。
- 用户指出绝区零三虚狩当前口径、直伤电、异放/妄想天使三小只、薇薇安紊乱队、2+1/1+1/0+1 舒适度加分、非虚狩 `0+1 > 1+0`、耀嘉音/耀佳音 `0+0` 可用、南宫羽专武优先和琉音机制价值等具体错误。

建议：

- 更新对应游戏的 `valuation-rules.md`、知识表和验证样例。
- 新增验证样例，确保相同误判不复发。
- 对“多核心多队”类硬条件，验证样例应包含一个共享辅助陷阱和一个独立成队正例。
- 对绝区零三虚狩类反馈，验证样例应包含旧口径陷阱，例如叶瞬光只带照+千夏或雅队只带雅柚柳时不能按当前三队完整评分，同时包含直伤电、妄想天使三小只、薇薇安紊乱队和舒适度加分正例。若用户人工复盘给出更高性价比账号，应把该账号形态做成正例，并加入“耀嘉音 1+1 但虚狩/三小只投入较弱”之类反例，防止单一舒适度信号压过整体战力。

### hard_condition_budget

用户给了预算和硬条件，但预算内候选不满足硬条件时，筛选流程错误地推荐了便宜但不合格的账号，或没有扩大价格范围寻找最低满足条件账号。

常见信号：

- 用户说“给定金额没有满足条件可以扩大金额/搜索范围”。
- 用户要求“尽可能找价格最低且满足条件的号”。
- 用户未声明严格预算且预算附近没有精确满足项，但结果既没有低价/高价扩展精确项，也没有分别记录两个方向逐档扩展的停止原因。
- 预算内主推缺硬条件，例如缺指定角色、专武、绑定状态、独立三队或低风险交付。

建议：

- 主筛选状态机应先在 `primary_budget` 内找硬条件完整账号。
- 先完整覆盖 `flex_budget`；没有精确项且用户未声明严格预算时，从浮动区间下界和上界向两侧逐档搜索，各自在首个有详情复核合格项的价格档后停止，输出低价/高价精确备选。用户明确要求严格预算时不得扩展。
- 预算内不合格账号只能进排除或风险备选，不能作为 Top 1。
- 同时保留预算内最佳 `near_match_listings`，逐维解释差价买到了收藏完整度、实战、养成、资源、皮肤还是风险改善；收藏溢价不能伪装成战力提升。

### evidence

社区证据过期、覆盖不足或无法支撑规则升级。

常见信号：

- `community_confidence: low|medium`
- `rule_update_suggestion` 非空
- 新角色或新队伍未出现在快照中
- 用户要求按社群配队、强度或避坑经验排序，但运行记录没有成功的 `community_attempts`。
- B站字幕、小红书正文、评论或攻略页面读取失败，并且没有记录工具降级路径。

建议：

- 调用 `game-account-community-updater` 或按社区调研协议刷新证据。全球同步进度游戏应把 YouTube 作为 B站之外的独立长视频来源。
- 在刷新前不要把单次观察升级为硬规则。
- 对 opencli 超时、正文不可读、登录墙或空卡片，改用浏览器 DOM、页面 metadata、Jina/WebFetch/curl、官方公告、Wiki/攻略站或用户截图/文本，并记录 `fallback_used`。
- 如果运行记录已有 `coverage_gaps`、`user_feedback`、`rule_update_suggestions` 或执行失败，但 `knowledge_update_candidates` 为空，输出 `selector-knowledge-ledger-candidates-missing`。这些观察应先进入知识沉淀候选，再由用户确认、fixture 和 evaluator 决定是否写入规则。

### risk

绑定、找回、验号、实名、平台保障没有被充分处理。

常见信号：

- missing fields 中包含绑定、PS5、TAP、Wegame、找回包赔、官方验号。
- 最终推荐没有置顶交易风险。

建议：

- 提高缺失字段扣分。
- 输出人工确认清单。

### user_feedback

用户明确指出偏好、平台、规则或输出体验不符合预期。

建议：

- 用户反馈可作为优化触发器，但规则写入仍需证据和验证。
- 若用户明确要求实现优化，可在当前工作流中修改文件并运行测试。

### quality_gate

生成器或优化器产出的 skill 未通过 `game-account-skill-evaluator`。

常见信号：

- `selection_profile.persistence_scope` 或 `profile_isolation.persistence_scope` 不是 `run_only`。
- `profile_isolation.durable_updates_from_profile` 非空。
- `knowledge_update_candidates` 由 `selection_profile` / `run_only` 偏好派生，却指向 SKILL/references 或已标记 `applied`。

上述任一情况必须输出阻塞 finding `selector-session-preference-leak`。证据要保留本轮预算、目标、区服/硬条件和拟写入目标；不得自动补丁修复估值规则。

- evaluator 输出 `passed: false`。
- evaluator 输出 `redo_required: true`。
- `score` 低于 `threshold`。
- 阻塞问题包含缺文件、缺验证样例、缺风险规则、缺证据或优化器自身回归样例失败。

建议：

- 不要继续把该 skill 用于真实推荐。
- 把 evaluator 的阻塞问题转成优化器 finding，定位到目标 skill 的 `SKILL.md`、`references/`、`scripts/` 和 `test-fixtures/`。
- 修完后重新运行目标验证脚本和 evaluator；仍低分则继续打回重做。
