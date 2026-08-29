# 平台访问策略

## 原则

平台公开可见不等于允许自动化采集。账号筛选助手应采用用户触发、低频、保守、可解释的访问方式。

## 允许的访问方式

- 用户明确要求查询某个游戏/预算范围时，访问少量列表页。
- 用户提供商品链接时，读取对应详情页。
- 用户提供截图或文本时，从用户输入中抽取字段。
- 动态或登录态页面只使用 `ego-browser`。为当前用户目标创建一个隔离 task space，在该空间内复用登录状态和少量标签页；不得绕过登录、验证码、风控或付费墙。

## 推荐平台顺序

平台顺序的机器可读来源是 `references/platform-priority.json`。用户没有指定平台时，按该文件的 `default_order` 做低频候选发现：

- 用户提供的链接、截图或复制文本。
- 螃蟹账号代售：`https://www.pxb7.com/`。
- 盼之代售：`https://www.pzds.com/`。
- 交易猫。
- 淘手游。
- 闲鱼。

螃蟹和盼之是账号代售场景的重要来源，应优先纳入覆盖判断。若当前没有可用 adapter 或页面受限，不要绕过限制；记录“未覆盖/不可读”的具体原因，并让用户提供链接或截图。

盼之列表的自然页面已经加载商品、但后续 `loadMore` 遇到 429/频率限制时，只保留当前已加载且可追踪的商品行并标记 `partial`；同一路径不连续重试。结果仍可作为近似/待复核候选展示，但必须公开说明候选覆盖不完整，并由其它排序/详情路径或用户材料补证。

闲鱼常见问题是登录推荐页、空商品卡片、验证码和搜索无输出。遇到这些信号时应快速降级，不要把时间耗在重复等待上。

## OpenCLI adapter 缺口

当目标平台没有现成 `opencli <site>` 命令，但该平台会反复用于账号筛选时，先判断是否值得生成 adapter：

1. 运行 `opencli list -f yaml` 和 `opencli <site> -h` 确认没有可复用站点命令或命令能力不足。
2. 若页面在 ego-browser 中可见、数据来自可验证的 HTTP/JSON/HTML，且不需要绕过验证码、登录墙、风控或付费墙，可把一次 `js()` IIFE 或 `browserFetch()` 的稳定字段映射沉淀为 adapter 候选；生成 adapter 仍按 `opencli-adapter-author` 的字段解码和 fixture 验证流程执行。
3. Adapter 验证通过且字段与网页肉眼值对齐后，才能把该 adapter 作为可靠平台来源；验证前只能标记为实验性或降级来源。
4. 若数据只靠图片、强交互、验证码、登录推荐流或不稳定风控页面获得，不做 adapter，改为请求用户提供链接、截图或复制文本。

筛选运行记录中应保留 `adapter_available` / `opencli_adapter_available`、`fallback_used` 和 adapter 验证状态，供 `game-account-skill-optimizer` 判断是否生成 `platform-opencli-adapter-gap`。

## OpenCLI adapter 复用

当平台已有通过 `opencli browser <session> verify <site>/<command> --strict-memory` 的 adapter 时，账号筛选应优先使用 adapter 命令：

1. 运行 `opencli list -f json` 或 `opencli <site> <command> -h` 确认可用命令。
2. 用 `opencli <site> <command> <input> -f json` 读取结构化字段，并把 `adapter_command` 写入运行记录。
3. 在关键推荐前或 adapter 改动后运行 `opencli browser <session> verify <site>/<command> --strict-memory`，并把 `verify_command` 写入运行记录。
4. Adapter 报错、fixture mismatch 或字段与网页不一致时，回到同一 ego-browser task space，按语义快照 → 直接 DOM/页内请求 → 截图的顺序复核；仍失败时才请求用户复制文本或改用其它平台。
5. 已验证 adapter 的运行记录应设置 `adapter_available: true`、`adapter_verified: true`；优化器据此生成复用建议，而不是 adapter 缺口建议。

已脱敏、可复用的 Pxb7/PZDS adapter 放在 `skills/game-account-toolkit/opencli-adapters/`，命令按游戏命名。明日方舟使用两平台各自的 `arknights-list` / `arknights-detail`；绝区零使用 `pxb7/zzz-detail` 和 `pzds/zzz-detail`。通过 `node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --check` 检查、`--install` 同步到 `~/.opencli`。安装脚本不能静默覆盖用户已有不同 adapter；含 cookie、token、账号状态或私有站点记忆的文件只保留在本机。

### 明日方舟双平台覆盖

- 螃蟹列表：`https://www.pxb7.com/buy/10053/1?...`，使用 `opencli pxb7 arknights-list` / `arknights-detail`。
- 盼之列表：`https://www.pzds.com/goodsList/84/6/headerSearch?...`，其中 `84` 是明日方舟 game id、`6` 是目录段；使用 `opencli pzds arknights-list` / `arknights-detail`。
- 主动找号必须两边都尝试列表读取，并对两边各自的短名单做详情复核。最终总榜可以跨平台排序，但用户可见输出必须保留两个平台清单。
- 某个平台无精确符合项时显示明确标注的近似项和覆盖缺口；不得删除该平台段，也不得把未验详情的列表卡片冒充合格推荐。
- PZDS 的 `onStandTime` 映射为 `published_at`；`verifyTime` 才映射为 `platform_verified_at`。`verifyTime` 为 null 时显示“未披露”，即使 `shotTypeName` 表示官方验号也不能反推验号时间。

### Pxb7/PZDS 绝区零详情资产角标

螃蟹和盼之的绝区零详情页可能在下方资产/验号报告区域展示角色卡片和 S 级音擎列表。角色右上角的 `x` 或 `x+y` 比标题更可靠：`x` 是影画/命座数，`+y` 是该角色对应专属音擎数量；但平台有时只显示 `x`，即使账号实际有对应专武。读取这类页面时：

- 优先复用已验证的 `opencli pxb7 zzz-detail <url> -f json` 或 `opencli pzds zzz-detail <id> -f json`。
- Adapter 应在必要时滚动到资产卡片区域，读取 DOM 中可见的角色卡片文本或角标元素，并输出浅层 `agentStatuses` 对象。
- Adapter 还应读取页面 `S级音擎` / `S级武器` 名称清单，并输出浅层 `sWEngineNames` 数组。
- 筛选流程必须把该对象标准化到 `game_assets.agent_statuses`，并记录 `agent_status_source` 或 `asset_status_source`。
- 筛选流程必须把 `sWEngineNames` 标准化到 `game_assets.s_w_engine_names` 或 `game_assets.w_engines[].name`，由游戏 skill 使用本地专武表确认归属。
- 如果只能读到标题里的 S 数量、黄数或几命描述，不能据此确认专属音擎归属；如果角色角标只有 `x` 且没有可匹配的 S 音擎名称，也应降级为 `source_status: partial` 并列为人工确认项。

### PZDS 绝区零列表路由

PZDS 详情页和列表页的数字段含义不同，不要从详情 URL 反推列表 URL。绝区零详情页通常形如 `https://www.pzds.com/goodsDetails/<listingId>/6`，其中末尾 `/6` 不能当作 `goodsList` 的游戏 ID；直接访问 `https://www.pzds.com/goodsList/6` 可能进入错误游戏或错误频道。

读取盼之绝区零列表时：

- 优先从 `https://www.pzds.com/gameList` 自然导航到绝区零，保留最终 URL。
- 若使用直达列表 URL，必须先用浏览器确认页面标题、面包屑或筛选项包含绝区零；当前已验证的绝区零列表入口是 `https://www.pzds.com/goodsList/275`。
- 如果页面标题、面包屑、筛选项或商品卡文本显示为其它游戏，例如英雄联盟，记录 `wrong_game` / `platform-pzds-zzz-list-route-mismatch`，不要把这次尝试计为 PZDS 覆盖。
- 如果正确列表页面可打开但显示空列表或“新品筹备中”，记录为空结果并降级到已知详情样本、用户提供链接、截图或复制文本；不要构造其它未验证 `goodsList/<id>` 反复重试。

### PZDS 浏览器状态健康检查

盼之页面在普通 Chrome 配置中可能被站点持久化状态污染：无痕窗口正常、普通窗口控制台报错或页面卡在加载时，优先怀疑 `pzds.com` 相关 cookie、localStorage、sessionStorage、CacheStorage、IndexedDB、service worker、WAF/埋点状态不一致，而不是直接判断站点不可用。

每次完成盼之列表或详情处理后，必须运行一次页面健康检查：

```bash
npm run pzds:health -- --json
```

健康标准：

- `https://www.pzds.com/gameList` 能打开。
- 页面标题为盼之代售相关标题。
- 正文包含当前任一欢迎文案“欢迎来到盼之代售”或“欢迎来到盼之账号”，同时包含“请选择要购买的游戏”，并至少出现一个游戏入口，例如“绝区零”“鸣潮”“明日方舟”。
- ego-browser `drainEvents()` 和页面可见状态没有新的阻断错误。
- 页面没有“验证、滑块、访问过于频繁、安全校验、人机”等阻断文本。

若健康检查失败，执行定向修复：

```bash
npm run pzds:repair -- --json
```

修复只允许清理 PZDS 站点范围的数据，不清全局浏览器缓存、不退出用户 Chrome、不删除其它站点登录态。修复后必须重新运行健康检查；仍不正常时记录 `pzds_browser_state_unhealthy`、console error、页面可见文本和降级路径，请用户提供截图、链接或复制文本。

## 性能预算与降级

平台访问必须设置明确等待预算并可提前放弃：

- 列表页/搜索页：通常 10-15 秒。
- 商品详情页：通常 15-20 秒。
- 字幕、评论、图片密集页或登录态页面：通常不超过 30 秒，除非用户明确要求深挖。

同一平台同一意图出现超时、空卡片、登录墙、验证码、`503`、详情页加载失败或无输出命令时，最多再用一种不同工具或自然导航路径复查一次。仍失败则立刻降级并记录，不要继续堆等待。

## 查询会话和清理

平台查询必须使用可追踪的 ego-browser task space，推荐名称为 `gas-<game>-<short-timestamp>`。同一用户目标的多平台查询复用这个空间和首次返回的数字 id；只有标签页需要隔离，不为每个平台重复创建空间。

进入第一条浏览器命令前，把 preflight 的 `browser_route` 写入 run artifact，并冻结 `selected_transport: ego_browser`。首次实际 heredoc 完成运行时验证，同时记录 `task_space_id`、`task_space_name` 和当前 ownership。

执行顺序：

1. 列表发现优先 `snapshotText()` 获取结构；批量字段用一次 `js()` IIFE 或同页 `browserFetch()` 拉少量页面，并立刻用可见行数、商品 id、价格和 URL 抽样复核。不要逐个打开大量详情页或高频翻页。
2. 详情只打开短名单。对每个关键候选先读语义树，再用稳定 locator 或紧凑 DOM 提取；字段敏感或语义树不完整时补截图。已验证 adapter 可作为独立交叉检查，不能替代本轮页面证据。
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
2. 结构化工具超时：回到同一 ego-browser task space，先读语义树，再用一次 DOM/页内请求或视觉复核；不要重复等待同一命令。
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
