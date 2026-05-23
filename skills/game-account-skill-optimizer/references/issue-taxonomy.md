# Skill 优化问题分类

updated_at: 2026-05-17

## 分类

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
- 若平台经常复用、浏览器可见且当前 `opencli list` 没有对应站点命令，应生成 `platform-opencli-adapter-gap` finding，建议按 OpenCLI adapter 流程建立私有 adapter。
- Adapter 实现不是默认自动补丁；必须完成站点侦察、endpoint 验证、字段核对和 `opencli browser verify <site>/<command>` 后，才能把该 adapter 当作可靠平台来源。
- 若已存在并验证通过，应生成 `platform-opencli-adapter-reuse` finding，提醒下次优先复用 adapter 命令，而不是继续临时 DOM 抽取。
- 列表页和详情页能力要分开判断：只有详情 adapter 可用时，不应把整个平台标成“无 adapter”；应对详情输出复用建议，对列表页缺口单独记录。
- 对绝区零的螃蟹/盼之详情，已验证 adapter 还应输出角色资产角标 `agentStatuses`；如果推荐只保留 `voidHunters` 或标题文本，应生成 `platform-agent-status-asset-cards-missing` finding。

### adapter_gap

目标网站没有可复用 OpenCLI adapter，导致每次都靠临时 CDP/DOM 抽取、手动解析或截图降级。

常见信号：

- `adapter_available: false` 或 `opencli_adapter_available: false`
- `list_adapter_available: false` 且列表页需要反复通过 CDP/DOM 读取
- `detail_adapter_available: false` 且详情页需要反复通过 CDP/DOM 读取
- 运行记录包含 `no opencli adapter`、`missing adapter`、`没有适配器`
- `fallback_used: browser_cdp` / `manual_browser_dom` 且同平台会反复用于账号筛选

建议：

- 先用 `opencli list -f yaml` 和 `opencli <site> -h` 确认确实没有现成站点命令。
- 对浏览器可见、数据来自 HTTP/JSON/HTML、无需绕过验证码/风控/付费墙的平台，调用 `opencli-adapter-author` workflow：`opencli browser analyze <url>`、`opencli browser init <site>/<command>`、字段解码、`opencli browser verify <site>/<command> --write-fixture`。
- 把 endpoint、字段映射、notes 和 verify fixture 写入 `~/.opencli/sites/<site>/`，下次筛选优先复用 adapter。
- 若数据只在不可稳定访问的交互、图片、验证码或付费内容里，停止 adapter 化，降级为用户提供链接、截图或复制文本。

### adapter_reuse

目标网站已有通过 OpenCLI verify 的 adapter，后续筛选应优先使用结构化命令，并把验证命令写入运行记录。

常见信号：

- `adapter_available: true` 或 `opencli_adapter_available: true`
- `detail_adapter_available: true`
- `adapter_verified: true`
- `adapter_command` 类似 `opencli pxb7 detail <url> -f json`
- `verify_command` 类似 `opencli browser <session> verify pxb7/detail --strict-memory`

建议：

- 输出 `platform-opencli-adapter-reuse` finding，并把 `adapter_command` 与 `verify_command` 放入 evidence。
- 不再输出 `platform-opencli-adapter-gap`，除非 adapter 验证失败或能力不足。
- 若 adapter 输出字段缺失、fixture mismatch 或网页肉眼值不一致，修 adapter；不要用游戏估值规则掩盖解析错误。

### asset_status_extraction

账号详情页存在角色卡片角标，但运行记录没有把它结构化保存，导致影画和专属音擎归属只能靠标题猜测。

常见信号：

- 绝区零账号来自 `pxb7/detail` 或 `pzds/detail` verified adapter。
- 运行记录包含 `voidHunters`、S 代理人总数、标题“几命”，但推荐/备选缺少 `agentStatuses` 或 `game_assets.agent_statuses`。
- 用户要求“全部虚狩和对应辅助/专武”，但输出没有说明资产卡角标来源。

建议：

- 修复或复用 OpenCLI detail adapter，让它滚动到资产卡片区域并输出浅层 `agentStatuses`。
- 在 `shared-listing-schema.md`、`selection-state-machine.md` 和对应游戏 `valuation-rules.md` 中要求保留该字段。
- `x+y` 只表示该角色有 `y` 个对应专属音擎；只有 `x` 时不要推断专武。
- 不能读取角标时，把账号降级为 `source_status: partial` 并列为人工确认。

### output_format

机器可读标签直接出现在用户主文案中，导致回复不自然。

常见信号：

- 最终回复包含 `<game_account_evaluation>`
- 最终回复包含 `<recommendations>` 且没有自然语言摘要
- JSON 过长且没有解释
- 推荐、备选或排除账号缺商品链接，用户无法打开比较。
- 用户允许预算上下浮动，但输出没有单独列出价格浮动备选。

建议：

- 用户可见部分先给推荐结论、理由、风险和人工确认项。
- 机器标签只在调试、日志或用户明确要求结构化输出时展示。
- Top 推荐、价格浮动备选、风险备选和排除列表都保留 URL；超预算 200-300 元的账号只进“价格浮动备选”，不得混入主推荐。

### valuation

估值规则漏掉关键游戏理解或过度依赖单一字段。该分类适用于所有游戏 skill，不只适用于鸣潮。

常见信号：

- 只看命座、专武或总稀有度。
- 忽略热门配队、主 C 是否带专武、队伍角色关系。
- 忽略绝区零专属音擎/队伍/邦布，明日方舟专精/模组/限定联动，异环弧盘/觉醒等游戏特有资产。
- 用户反馈某个队伍或角色价值判断错误。
- 用户要求多个核心分别成队，但推荐把共享队友重复计算，例如“三虚狩 + 两个辅助”被当成三支完整队。
- 用户指出需要优先找最适配队友，再列下位替代，例如绝区零星见雅优先确认柚叶，不能只说有泛用辅助。

建议：

- 更新对应游戏的 `valuation-rules.md`、知识表和验证样例。
- 新增验证样例，确保相同误判不复发。
- 对“多核心多队”类硬条件，验证样例应包含一个共享辅助陷阱和一个独立成队正例。

### hard_condition_budget

用户给了预算和硬条件，但预算内候选不满足硬条件时，筛选流程错误地推荐了便宜但不合格的账号，或没有扩大价格范围寻找最低满足条件账号。

常见信号：

- 用户说“给定金额没有满足条件可以扩大金额/搜索范围”。
- 用户要求“尽可能找价格最低且满足条件的号”。
- 预算内主推缺硬条件，例如缺指定角色、专武、绑定状态、独立三队或低风险交付。

建议：

- 主筛选状态机应先在 `primary_budget` 内找硬条件完整账号。
- 预算内无合格账号时扩大到 `flex_budget`，输出“最低满足价”备选。
- 预算内不合格账号只能进排除或风险备选，不能作为 Top 1。

### evidence

社区证据过期、覆盖不足或无法支撑规则升级。

常见信号：

- `community_confidence: low|medium`
- `rule_update_suggestion` 非空
- 新角色或新队伍未出现在快照中
- 用户要求按社群配队、强度或避坑经验排序，但运行记录没有成功的 `community_attempts`。
- B站字幕、小红书正文、评论或攻略页面读取失败，并且没有记录工具降级路径。

建议：

- 调用 `game-account-community-updater` 或按社区调研协议刷新证据。
- 在刷新前不要把单次观察升级为硬规则。
- 对 opencli 超时、正文不可读、登录墙或空卡片，改用浏览器 DOM、页面 metadata、Jina/WebFetch/curl、官方公告、Wiki/攻略站或用户截图/文本，并记录 `fallback_used`。

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

- evaluator 输出 `passed: false`。
- evaluator 输出 `redo_required: true`。
- `score` 低于 `threshold`。
- 阻塞问题包含缺文件、缺验证样例、缺风险规则、缺证据或优化器自身回归样例失败。

建议：

- 不要继续把该 skill 用于真实推荐。
- 把 evaluator 的阻塞问题转成优化器 finding，定位到目标 skill 的 `SKILL.md`、`references/`、`scripts/` 和 `test-fixtures/`。
- 修完后重新运行目标验证脚本和 evaluator；仍低分则继续打回重做。
