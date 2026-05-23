# 筛选状态机

## START

输入用户需求。如果缺少游戏或预算，先询问最少必要信息：

- 游戏
- 预算范围
- 核心偏好：强度、资源、收藏、低风险、性价比

## LOAD_TOOLKIT

先调用 `game-account-preflight`：

1. 运行环境校验。
2. 若缺少必需工具，停止并输出安装/授权指引。
3. 若缺少可选工具，继续但记录能力限制。

再调用 `game-account-toolkit`：

1. 检查依赖。
2. 读取平台访问策略。
3. 确认可用能力：WebFetch、浏览器 CDP、OCR、样本库。

输出：

```yaml
capabilities:
  browser_cdp: boolean
  web_fetch: boolean
  ocr: boolean
limitations: string[]
```

## SELECT_GAME_SKILL

根据游戏选择专属 skill：

- Wuthering Waves（鸣潮）：`game-account-wuthering-waves`
- 明日方舟：`game-account-arknights`
- Neverness to Everness（异环）：`game-account-neverness-to-everness`
- Zenless Zone Zero（绝区零 / ZZZ）：`game-account-zenless-zone-zero`

若游戏未支持，不要套用其它游戏规则。进入 `GENERATE_GAME_SKILL`。

## GENERATE_GAME_SKILL

调用 `game-account-skill-generator`：

1. 根据用户输入的游戏名、别名和已知证据生成 `skills/game-account-<slug>/`。
2. 运行生成后的验证脚本。
3. 调用 `game-account-skill-evaluator` 判断是否达到使用标准。
4. 若未通过或 `redo_required: true`，只输出生成报告、阻塞问题和社区刷新建议；不要用低质量 skill 真实推荐。

输出：

```xml
<skill_generation_report>...</skill_generation_report>
<skill_quality_report>...</skill_quality_report>
```

## BUILD_QUERY

将用户需求转成硬筛和软评分条件。

硬筛例子：

- 预算范围
- 区服/渠道
- 未绑定 TAP/Wegame
- 找回包赔
- 官方验号

软评分例子：

- 强度开荒
- 抽卡资源
- 限定/稀有资产
- 价格优势
- 数据完整度

同时生成预算分层：

- `primary_budget`：用户明示预算内，默认只把这层作为主推荐。
- `flex_budget`：用户允许价格波动时使用；没有明示时可把预算上下 20%-30% 或约 200-300 元作为“价格浮动备选”，但不得放进主推荐。
- `excluded_price`：明显超出预算和浮动范围，只能进入排除列表或数据点，不得诱导购买。

如果用户声明了硬条件，例如“全部虚狩”“必须带某角色/专武/三队完整”，预算分层不得弱化硬条件：

- 先在 `primary_budget` 内寻找满足硬条件的账号。
- 若 `primary_budget` 内没有满足硬条件的账号，扩大到 `flex_budget`，找价格最低且硬条件完整的账号，作为“最低满足价”备选。
- 预算内但不满足硬条件的账号只能进入排除或风险备选，用于解释为什么不推荐；不能因为便宜而替代硬条件完整账号。

## COLLECT_LISTINGS

按保守访问策略获取候选账号：

1. 优先用户提供的链接、截图、复制文本或指定平台。
2. 用户没有指定平台时，按 `game-account-toolkit/references/platform-priority.json` 的 `default_order` 低频尝试：螃蟹账号代售、盼之代售、交易猫、淘手游；闲鱼只作为补充来源。
3. 每个平台最多做少量用户意图明确的列表页/搜索页读取。不要全站扫描。
4. 每条平台路径必须有等待预算：列表页通常 10-15 秒，详情页通常 15-20 秒；单个平台同一意图连续失败后立即降级，不让无输出命令长期挂起。
5. 对每个平台记录：查询词、开始/结束时间、耗时、等待预算、结果数、失败文本、是否进入详情页、是否使用列表卡片/截图/用户文本降级。
6. 平台页面不可读时，请用户提供截图/链接/复制文本；若列表卡片可读但详情页不可读，可保留为 `source_status: partial`，不能假装已验明详情。
7. 盼之详情 URL 末尾的分类段不能反推列表页游戏 ID。例如绝区零详情页 `goodsDetails/<id>/6` 中的 `/6` 不是绝区零列表 ID；不要构造 `goodsList/6` 当作盼之绝区零列表。绝区零列表应从 `https://www.pzds.com/gameList` 自然进入，或使用已经由浏览器确认标题和筛选项为绝区零的 `https://www.pzds.com/goodsList/275`。若进入后标题、面包屑或筛选项不是绝区零，记录 `platform-pzds-zzz-list-route-mismatch` 证据并降级，不得把该尝试计为盼之覆盖。
8. 每次完成盼之列表或详情处理后，必须运行 `npm run pzds:health -- --json`。如果健康检查发现页面缺少盼之游戏入口、console error、阻断文本或卡在加载，先运行 `npm run pzds:repair -- --json` 做 PZDS 站点范围清理并复验；仍失败时记录 `pzds_browser_state_unhealthy`、console error、页面文本和降级路径，不得把本轮 PZDS 结果作为健康覆盖。
9. 若高价值平台没有现成 OpenCLI adapter，记录 `adapter_available: false`、当前降级路径和是否适合 adapter 化；只有用户明确要求实现并且 `opencli browser <session> verify <site>/<command>` 通过后，才把新 adapter 当作可靠数据源。
10. 若平台已有 verified adapter，优先运行 `opencli <site> <command> <input> -f json`，并在记录中保留 `adapter_available: true`、`adapter_verified: true`、`adapter_command`、`verify_command`；adapter 失败时再降级为浏览器 DOM 或用户材料。
11. 绝区零详情页若来自螃蟹 `pxb7/zzz-detail` 或盼之 `pzds/zzz-detail`，必须读取并保留 `agentStatuses` 角色角标字段。该字段来自详情页资产卡片右上角的 `x` 或 `x+y`，`x+y` 表示影画/命座和对应专属音擎；只有 `x` 时不得直接推断有专武，也不得直接判定无专武，必须继续读取 `sWEngineNames` / `game_assets.s_w_engine_names` / `game_assets.w_engines[].name`，交给 ZZZ 本地专武表确认归属。它优先于标题里的 S 角色数量、黄数和“几命”描述。
12. 若 Pxb7/PZDS adapter 没有返回 `agentStatuses` 或 S 音擎名称清单，先用浏览器低频滚动到资产/验号报告角色卡和 S 级音擎区域复核一次；仍缺失时把 `asset_status_source: missing`、`engine_name_source: missing`、`source_status: partial` 和人工确认项写入运行记录，不要用标题猜专属音擎归属。
13. 区分列表页和详情页能力：例如当前只有 `pxb7/zzz-detail` 或 `pzds/zzz-detail` adapter，但列表页仍靠浏览器 DOM 时，分别记录 `list_adapter_available`、`detail_adapter_available` 和对应降级路径，避免把“详情可解析”误当成“平台全链路可解析”。
14. 记录数据来源和限制，不要声称覆盖了未成功读取的平台。

不要全站扫描或高频翻页。

## NORMALIZE_LISTINGS

用 `game-account-toolkit/references/shared-listing-schema.md` 标准化字段。

缺失字段保留为空，不要猜测。

## COLLECT_COMMUNITY_EVIDENCE

读取 `game-account-toolkit/references/community-research-protocol.md`，为当前游戏和版本建立证据快照，或读取游戏 skill 中最近一次仍可用的证据快照。

当快照过期、覆盖不足、或用户要求刷新时，调用 `game-account-community-updater`，把当次调研结果写成 `<community_refresh_report>`。

输入：

- 游戏与版本上下文
- 用户偏好：强度、资源、收藏、低风险、性价比
- 待比较账号中出现的角色、命座、武器、资源和绑定风险

输出：

```yaml
community_evidence:
  version_context: string
  updated_at: YYYY-MM-DD
  community_confidence: low|medium|high
  source_coverage: object
  high_value_assets: string[]
  medium_value_assets: string[]
  low_value_or_trap_assets: string[]
  key_teams: string[]
  limitations: string[]
```

要求：

- 只要存在强度、配队、命座/影画、专武/音擎、版本环境或账号交易避坑的不确定性，就必须先找社群答案或刷新证据；不能只凭本地旧快照或平台标题直接给高置信结论。
- 优先用 B站长视频/字幕/评论、小红书图文/评论、抖音话题或视频信号；平台不可用时记录失败原因并使用降级来源。
- 社区读取必须有工具降级链：先用可用的结构化工具读取搜索/详情/字幕/评论；若超时或无输出，改用浏览器 CDP 读取页面 DOM、标题、简介、相关视频/笔记卡片和公开评论；再尝试 Jina/WebFetch/curl/页面元数据、官方公告、Wiki/攻略站。每一步都记录 `community_attempts`、等待预算、失败文本和 `fallback_used`。
- B站字幕、小红书正文、抖音内容等关键正文无法读取时，`community_confidence` 最高为 `medium`；只有标题/卡片不能单独支撑“当前 meta 强规则”。
- 不得因为单条视频标题、短帖或评论就显著提高账号排名。
- 如果当前证据过期、冲突或覆盖不足，继续筛选时必须降低置信度并列出人工确认项。

## SCORE_WITH_GAME_SKILL

把标准化挂牌和 `community_evidence` 一起传给游戏专属 skill，获取：

- 游戏资产评分
- 资源评分
- 风险扣分
- 版本强度解释
- 排除理由

## RANK_AND_EXPLAIN

合并平台风险、价格、游戏资产分，输出 Top N。

每个入选账号必须包含：

- 商品 URL 或用户可打开的来源链接。
- 价格
- 所属推荐分层：主推荐、价格浮动备选、风险备选或排除。
- 核心资产
- 为什么适合用户偏好
- 风险和缺失信息
- 是否需要人工二次确认

输出要求：

- 主推荐只放 `primary_budget` 且硬条件通过、风险可接受的账号。
- `flex_budget` 内的账号可作为“价格浮动备选”单独展示，必须说明超出或低于预算多少、为什么不是主推。
- 如果没有账号同时满足预算和硬条件，必须明确写出“预算内未发现合格项”，再列出 `flex_budget` 中价格最低的合格项；不要给一个预算内不合格账号当 Top 1。
- 风险备选和被排除账号也要保留链接，方便用户自行打开比较；没有链接时必须说明来源缺口。
- 不要用最低价覆盖质量判断；便宜但邮箱不出售、TAP/PSN/实名/找回链不清的账号应降级为风险备选或排除。

用户可见答复必须是自然语言推荐和清单，不要把 `<game_account_evaluation>` 或 `<recommendations>` 原始标签作为主文案输出。机器可读标签可在内部日志或用户明确要求结构化输出时附在后面。

不要在完成 `POST_RUN_OPTIMIZE` 收尾门禁前发送最终答复。若收尾门禁发现会影响推荐正确性的缺口，必须先回到相应状态补查、降级或改写推荐。

## FEEDBACK_LOOP

询问或接收用户反馈：

- 推荐是否准确
- 哪个账号被高估/低估
- 原因是什么

如果反馈揭示规则问题，进入 `PROPOSE_RULE_UPDATE`。

## POST_RUN_OPTIMIZE

强制收尾阶段。每次筛选完成后，必须先把本次运行写成 raw run artifact，再依次调用 `game-account-skill-optimizer` 和 `game-account-skill-evaluator`。这个阶段不是可选总结；它决定本次查询是否需要回到前面的状态补查、降级、改写推荐或更新 skill。

输入：

- `run_id`
- `started_at`
- `finished_at`
- `game`
- `target_skill`
- `user_request`
- `budget` / `budget_max` / `allow_budget_flex`
- `capabilities`
- `query_plan`
- `platform_attempts`
- `platform_attempts[].list_adapter_available`
- `platform_attempts[].detail_adapter_available`
- `platform_attempts[].adapter_command`
- `platform_attempts[].verify_command`
- `platform_attempts[].asset_status_source`
- `platform_attempts[].asset_status_verified`
- `recommendations`
- `backup_listings`：价格浮动备选和风险备选，必须保留 URL、价格差、降级原因。
- `excluded_listings`
- `final_response_draft`
- `missing_fields`
- `community_attempts`：社区来源、工具、等待预算、耗时、状态、失败文本、降级路径。
- `community_evidence`
- `rule_update_suggestions`
- `user_feedback`
- `evaluation_reports`：目标 skill、生成器产物或优化产物的 evaluator 输出。

执行：

1. 写入临时 artifact，默认放在 `/tmp/game-account-select-runs/<timestamp>-<game>.json`；除非用户要求持久化，不把真实查询 artifact 提交进仓库。
2. 运行优化器：

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input <run-artifact.json> --json
```

3. 运行评估器读取同一个 raw artifact：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<run-artifact.json> --json
```

处理规则：

- 优化器输出 `empty_result`、`runtime`、`platform_coverage`：若影响候选完整性，回到 `COLLECT_LISTINGS`；若平台不可读但已低频降级，在最终答复里列入数据来源限制。
- 优化器输出 `evidence`：若影响强度/配队/版本判断，回到 `COLLECT_COMMUNITY_EVIDENCE`；若只能拿到标题、卡片或 metadata，降低置信度并列入人工确认。
- 优化器输出 `output_format`：回到 `RANK_AND_EXPLAIN`，补齐链接、预算分层、排除理由和自然语言结论。
- 优化器输出 `valuation` 或 `risk`：若只是当前账号缺字段，补人工确认项；若是规则缺陷，进入 `PROPOSE_RULE_UPDATE`。用户已明确要求“优化/应用”时，允许修改对应 skill 后继续质量门禁。
- 评估器输出 `mode: run_artifact_analysis` 且 `redo_required: true`：逐条处理 `optimizer_findings`。能在本次查询内补救的先补救；外部平台限制、验证码、登录墙、卖家未披露字段等不能补救的问题，必须在最终答复中明确为残留风险，不能给高置信结论。
- 评估器输出目标 skill 低于门槛、存在阻塞问题或 `quality_gate` finding：打回重做。先修目标 skill，再运行目标验证脚本和 `game-account-skill-evaluator`；通过前不得把优化后的 skill 用于真实推荐。
- 若本次筛选触发了文件修改，至少评估这些目标：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-select --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs <target-game-skill> --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-skill-optimizer --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-skill-evaluator --json
```

输出给用户：

- 主推荐和风险结论仍然放在最前面。
- 收尾阶段只输出简短摘要：`optimizer` 是否发现问题、`evaluator` 是否通过、哪些问题已补救、哪些因平台/卖家/登录限制保留为人工确认。
- 不把完整 `<skill_optimization_report>` 或 `<skill_quality_report>` 当作主文案；只有用户要求结构化调试时才附上。

## PROPOSE_RULE_UPDATE

输出拟更新的文件、规则和原因。只有用户确认后才修改 skill 文件。修改后必须运行目标验证脚本和 evaluator；低于门槛或 `redo_required: true` 时继续回到本状态重做。

## END

总结本次查询限制、保留的待验证平台/规则问题，以及下一次如何改进。
