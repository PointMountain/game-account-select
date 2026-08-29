# 平台访问策略

## 原则

平台公开可见不等于允许自动化采集。账号筛选助手应采用用户触发、低频、保守、可解释的访问方式。

## 允许的访问方式

- 用户明确要求查询某个游戏/预算范围，且 support matrix 中对应 game/platform/list 为 `verified` 时，访问少量列表页。
- 用户提供商品链接，且对应 game/platform/detail 为 `verified` 时，读取详情页；未支持时保留链接并请求截图或复制文本，不用通用页面操作绕过能力矩阵。
- 用户提供截图或文本时，从用户输入中抽取字段。
- 动态或登录态页面先用 `ego-ops` 建立任务卡并读取目标 operation，再只使用 `ego-browser` 执行。为当前用户目标创建一个隔离 task space，在该空间内复用登录状态和少量标签页；不得绕过登录、验证码、风控或付费墙。

## 推荐平台顺序

平台顺序的机器可读来源是 `references/platform-priority.json`。用户没有指定平台时，按该文件的 `default_order` 做低频候选发现：

- 用户提供的链接、截图或复制文本。
- 螃蟹账号代售：`https://www.pxb7.com/`。
- 盼之代售：`https://www.pzds.com/`。
- 交易猫。
- 淘手游。
- 闲鱼。

螃蟹和盼之是账号代售场景的重要来源，应优先纳入覆盖判断。正常筛选若没有已验证 operation，必须 fail closed 并降级到用户材料；只读探索仅限维护者显式受控执行，不得成为筛选 fallback。页面受限时同样记录“未覆盖/不可读”的具体原因，不绕过限制。

盼之列表的自然页面已经加载商品、但后续 `loadMore` 遇到 429/频率限制时，只保留当前已加载且可追踪的商品行并标记 `partial`；同一路径不连续重试。结果仍可作为近似/待复核候选展示，但必须公开说明候选覆盖不完整，并由其它排序/详情路径或用户材料补证。

闲鱼常见问题是登录推荐页、空商品卡片、验证码和搜索无输出。遇到这些信号时应快速降级，不要把时间耗在重复等待上。

## Ego Ops operation 缺口与复用

目标平台没有既有 operation 时，正常筛选只记录 capability gap 并请求用户材料。以下流程仅供维护者在明确只读任务卡内、通过 `--allow-exploration` 显式探索：

1. 读取 ego-ops 一级站点索引；未命中时记录 `knowledge_status: exploration_required`。
2. 用当前页面复核域名、登录权限、目标游戏、唯一对象和成功标准。
3. 依次使用语义快照、稳定 DOM/同源数据和必要的视觉复核；任何登录墙、验证、用户接管或对象冲突都立即停止。
4. 只有真实成功并获得稳定、脱敏、可复用的步骤时，才用 ego-ops 脚手架生成站点 index 与 operation，并运行 `validate-knowledge.mjs`。
5. operation 已存在时先读取它，但仍必须实时复核；页面不符时记录 operation drift，不刷新 `last_verified`，也不把探索结果直接用于真实推荐。

筛选记录保留 `query_governance: ego_ops`、`operation`、`knowledge_status`、`operation_reference`、task space、验证证据与 `fallback_used`。仓库 `ego-operations/manifest.json` 是可执行目录，不是站点事实库；认证材料、私有值和完整响应不得进入两处。

### 明日方舟双平台覆盖

- 螃蟹列表：`https://www.pxb7.com/buy/10053/1?...`，使用 `pxb7/arknights-list` 与 `pxb7/arknights-detail` operation。
- 盼之列表：`https://www.pzds.com/goodsList/84/6/headerSearch?...`，其中 `84` 是明日方舟 game id、`6` 是目录段；使用 `pzds/arknights-list` 与 `pzds/arknights-detail` operation。
- 主动找号必须两边都尝试列表读取，并对两边各自的短名单做详情复核。最终总榜可以跨平台排序，但用户可见输出必须保留两个平台清单。
- 某个平台无精确符合项时显示明确标注的近似项和覆盖缺口；不得删除该平台段，也不得把未验详情的列表卡片冒充合格推荐。
- PZDS 的 `onStandTime` 映射为 `published_at`；`verifyTime` 才映射为 `platform_verified_at`。`verifyTime` 为 null 时显示“未披露”，即使 `shotTypeName` 表示官方验号也不能反推验号时间。

### PXB7/PZDS 绝区零详情解析候选（仅受控探索）

当前 support matrix 将绝区零的 PXB7/PZDS list/detail 全部标为 `unsupported`；仓库内两个详情解析器仅为 `exploration_only`，外部 `ego-ops` 尚无对应 verified operation。正常筛选不得启动这些解析器，应保留用户链接并请求截图或文本。以下内容只是维护者验证解析候选时需要检查的历史页面语义：

- 仅在 `--allow-exploration` 维护流程中测试 `pxb7/zzz-detail` 或 `pzds/zzz-detail`，不得在正常筛选复用。
- 解析候选需要隔离主体商品区与推荐卡片；若页面确有角色卡片，应输出浅层 `agentStatuses`，若确有 `S级音擎` / `S级武器` 名称清单，应输出浅层 `sWEngineNames`。
- 候选升级为 `verified` 之前，必须完成外部 `ego-ops` operation 回写、manifest 与 support matrix 升级、离线回归和真实 smoke。
- 升级后才可把字段标准化到 `game_assets.agent_statuses`、`game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name`，并记录证据来源。
- 如果只能读到标题里的 S 数量、黄数或几命描述，不能据此确认专属音擎归属；如果角色角标只有 `x` 且没有可匹配的 S 音擎名称，也应降级为 `source_status: partial` 并列为人工确认项。

### PZDS 绝区零列表路由候选（未验证）

PZDS 详情页和列表页的数字段含义不同，不要从详情 URL 反推列表 URL。绝区零详情页通常形如 `https://www.pzds.com/goodsDetails/<listingId>/6`，其中末尾 `/6` 不能当作 `goodsList` 的游戏 ID；直接访问 `https://www.pzds.com/goodsList/6` 可能进入错误游戏或错误频道。

当前没有 `pzds/zzz-list` operation，正常筛选不得读取或声称覆盖 PZDS 绝区零列表。维护者受控探索时：

- 从 `https://www.pzds.com/gameList` 自然导航到绝区零并保留最终 URL，不把历史候选路径当事实。
- 若观察到 `https://www.pzds.com/goodsList/275`，仍必须以页面标题、面包屑、筛选项与商品卡交叉确认；该路径当前不是 verified operation。
- 如果页面标题、面包屑、筛选项或商品卡文本显示为其它游戏，例如英雄联盟，记录 `wrong_game` / `platform-pzds-zzz-list-route-mismatch`，不要把这次尝试计为 PZDS 覆盖。
- 即使候选页面可打开，也只能作为 operation 验证材料；正常筛选继续降级到用户提供的链接、截图或复制文本，不构造其它未验证 `goodsList/<id>` 反复重试。

### PZDS ego-ops 健康复验

每次完成盼之列表或详情处理后，通过 ego-ops 受控 operation 运行一次只读健康复验：

```bash
npm run pzds:health -- --json
```

健康标准：

- `https://www.pzds.com/gameList` 能打开。
- 页面标题为盼之代售相关标题。
- 正文包含当前任一欢迎文案“欢迎来到盼之代售”或“欢迎来到盼之账号”，同时包含“请选择要购买的游戏”，并至少出现一个游戏入口，例如“绝区零”“鸣潮”“明日方舟”。
- ego-browser task space 已完成，事件和页面可见状态没有新的阻断错误。
- 页面没有“验证、滑块、访问过于频繁、安全校验、人机”等阻断文本。

若健康检查失败，记录 `operation_drift` 或 `pzds_browser_state_unhealthy`，在同一 task space 内重新观察一次；仍不正常时停止，不清理 cookie、缓存或登录态，并请用户提供截图、链接或复制文本。

## 性能预算与降级

平台访问必须设置明确等待预算并可提前放弃：

- 列表页/搜索页：通常 10-15 秒。
- 商品详情页：通常 15-20 秒。
- 字幕、评论、图片密集页或登录态页面：通常不超过 30 秒，除非用户明确要求深挖。

同一平台同一意图出现超时、空卡片、登录墙、验证码、`503` 或详情页加载失败时，最多在同一 ego-browser task space 内换一种观察方式或自然导航路径复查一次。仍失败则立刻降级并记录，不要继续堆等待或切换查询软件。

## 查询会话和清理

平台查询必须使用可追踪的 ego-browser task space，推荐名称为 `gas-<game>-<short-timestamp>`。同一用户目标的多平台查询复用这个空间和首次返回的数字 id；只有标签页需要隔离，不为每个平台重复创建空间。

进入第一条浏览器命令前，把 preflight 的 `browser_route` 写入 run artifact，并冻结 `selected_transport: ego_browser`。首次实际 heredoc 完成运行时验证，同时记录 `task_space_id`、`task_space_name` 和当前 ownership。

执行顺序：

1. 列表发现优先 `snapshotText()` 获取结构；批量字段用一次 `js()` IIFE 或同页 `browserFetch()` 拉少量页面，并立刻用可见行数、商品 id、价格和 URL 抽样复核。不要逐个打开大量详情页或高频翻页。
2. 详情只打开短名单。对每个关键候选先读语义树，再用稳定 locator 或紧凑 DOM 提取；字段敏感或语义树不完整时补截图。ego-ops operation 是先验流程，不能替代本轮页面证据。
3. 每个有浏览器参与的 `platform_attempt` 记录 `browser_transport: ego_browser`、task space id/name、tab target id、观察方式、验证方式和数据条数。
4. 关键导航、点击、输入或提取后必须读回验证。`@N` 只用于最新 snapshot；长期复用 locator 或显式 CSS，避免陈旧 ref 导致误点。
5. 用户接管、inactive 或未分配状态是硬停止。不要自动重试、创建替代空间或调用 takeover；告诉用户当前空间和待完成动作，等待明确确认。
6. 任务确认完成后，用独立最终 heredoc 完成 task space：

```bash
npm run query:cleanup -- --task-space <task-space-id-or-name> --json
```

或直接运行专用最终 heredoc：

```bash
ego-browser nodejs <<'EOF'
const target = <task-space-id>
const spaces = await listTaskSpaces()
const matched = spaces.find((space) => space.id === target)
if (!matched) cliLog(JSON.stringify({ done: true, already_closed: true }))
else if (matched.ownership !== 'agent') cliLog(JSON.stringify({ done: false, skipped: 'task-space-not-agent-owned', ownership: matched.ownership }))
else cliLog(JSON.stringify(await completeTaskSpace(matched.id, { keep: false })))
EOF
```

清理报告写入 run artifact：`done`、请求与完成的 task space id/name、`ego_task_spaces_remaining` 和剩余匹配进程。只关闭本轮明确记录的空间，不按名称前缀或页面 URL 扫描其它空间。默认只审计进程；只有明确确认是本轮残留查询脚本时才追加 `--kill`，不要终止 ego-browser 应用或无关进程。

推荐降级顺序：

1. 公开详情页不可读但列表卡片可读：保留列表卡片字段，标记 `source_status: partial` 和 `fallback_used: list_card`。
2. 已验证 operation 失效：留在同一 ego-browser task space，先读语义树，再用一次 DOM/页内请求或视觉复核；不要重复等待同一路径。
3. 浏览器也不可读：请求用户提供链接、截图或复制文本。
4. 标记平台当前不可用，并把失败文本交给优化器。

## 禁止的访问方式

- 全站实时抓取。
- 高频翻页扫库。
- 绕过验证码或风控。
- 自动登录、自动下单、自动联系卖家。
- 批量保存非必要的原始页面和图片。

## 平台字段

通用字段优先抽取：

- 平台
- 游戏
- 商品 URL
- 标题
- 价格
- 区服/渠道
- 发布时间
- 浏览/想要/热度
- 降价信息
- 找回包赔
- 官方验号
- 支持砍价
- 绑定状态
- 原始描述文本

每个推荐、备选和排除账号都应保留商品 URL；没有 URL 时必须保留平台、商品编号和原始标题，方便用户二次定位。

## 风险提示

每次访问平台前，如果使用浏览器自动化，应提示：

```text
平台可能对自动化访问有风控或条款限制。本次只做低频、用户触发的购买前信息整理，不进行交易撮合或绕过限制。
```

## 页面访问失败时

不要反复重试同一路径。按顺序降级：

1. 尝试页面内自然导航。
2. 在同一 ego-browser task space 中切换语义、直接数据与视觉工作流；不要创建另一条浏览器传输。
3. 尝试用户提供链接。
4. 请求用户提供截图或复制文本。
5. 标记该平台当前不可用。

建议记录每次平台尝试：

- 平台和 URL/查询词。
- 耗时。
- 等待预算。
- 结果数。
- 失败文本。
- 降级路径。
- 是否登录/验证/风控/503/空结果。

筛选结束后把这些字段交给 `game-account-skill-optimizer`，用于下次避免相同慢路径。

## 样本保存

只保存筛选所需的结构化字段和用户确认结果。避免无必要保存完整 HTML、完整截图或个人敏感信息。
