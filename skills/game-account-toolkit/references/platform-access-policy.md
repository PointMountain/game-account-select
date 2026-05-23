# 平台访问策略

## 原则

平台公开可见不等于允许自动化采集。账号筛选助手应采用用户触发、低频、保守、可解释的访问方式。

## 允许的访问方式

- 用户明确要求查询某个游戏/预算范围时，访问少量列表页。
- 用户提供商品链接时，读取对应详情页。
- 用户提供截图或文本时，从用户输入中抽取字段。
- 使用浏览器 CDP 读取用户可见页面，但不绕过登录、验证码、风控或付费墙。

## 推荐平台顺序

平台顺序的机器可读来源是 `references/platform-priority.json`。用户没有指定平台时，按该文件的 `default_order` 做低频候选发现：

- 用户提供的链接、截图或复制文本。
- 螃蟹账号代售：`https://www.pxb7.com/`。
- 盼之代售：`https://www.pzds.com/`。
- 交易猫。
- 淘手游。
- 闲鱼。

螃蟹和盼之是账号代售场景的重要来源，应优先纳入覆盖判断。若当前没有可用 adapter 或页面受限，不要绕过限制；记录“未覆盖/不可读”的具体原因，并让用户提供链接或截图。

闲鱼常见问题是登录推荐页、空商品卡片、验证码和搜索无输出。遇到这些信号时应快速降级，不要把时间耗在重复等待上。

## OpenCLI adapter 缺口

当目标平台没有现成 `opencli <site>` 命令，但该平台会反复用于账号筛选时，先判断是否值得生成 adapter：

1. 运行 `opencli list -f yaml` 和 `opencli <site> -h` 确认没有可复用站点命令或命令能力不足。
2. 若页面在浏览器中可见、数据来自可验证的 HTTP/JSON/HTML，且不需要绕过验证码、登录墙、风控或付费墙，可按 `opencli-adapter-author` 走 adapter 化：`opencli browser analyze <url>`、`opencli browser init <site>/<command>`、字段解码、`opencli browser verify <site>/<command> --write-fixture`。
3. Adapter 验证通过且字段与网页肉眼值对齐后，才能把该 adapter 作为可靠平台来源；验证前只能标记为实验性或降级来源。
4. 若数据只靠图片、强交互、验证码、登录推荐流或不稳定风控页面获得，不做 adapter，改为请求用户提供链接、截图或复制文本。

筛选运行记录中应保留 `adapter_available` / `opencli_adapter_available`、`fallback_used` 和 adapter 验证状态，供 `game-account-skill-optimizer` 判断是否生成 `platform-opencli-adapter-gap`。

## OpenCLI adapter 复用

当平台已有通过 `opencli browser <session> verify <site>/<command> --strict-memory` 的 adapter 时，账号筛选应优先使用 adapter 命令：

1. 运行 `opencli list -f json` 或 `opencli <site> <command> -h` 确认可用命令。
2. 用 `opencli <site> <command> <input> -f json` 读取结构化字段，并把 `adapter_command` 写入运行记录。
3. 在关键推荐前或 adapter 改动后运行 `opencli browser <session> verify <site>/<command> --strict-memory`，并把 `verify_command` 写入运行记录。
4. 只有 adapter 报错、fixture mismatch、字段缺失或网页肉眼值不一致时，才降级到 `browser state/eval`、截图、用户复制文本或其它平台。
5. 已验证 adapter 的运行记录应设置 `adapter_available: true`、`adapter_verified: true`；优化器据此生成复用建议，而不是 adapter 缺口建议。

已脱敏、可复用的 Pxb7/PZDS adapter 放在 `skills/game-account-toolkit/opencli-adapters/`，命令按游戏命名，例如绝区零使用 `pxb7/zzz-detail` 和 `pzds/zzz-detail`。通过 `node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --check` 检查、`--install` 同步到 `~/.opencli`。安装脚本不能静默覆盖用户已有不同 adapter；含 cookie、token、账号状态或私有站点记忆的文件只保留在本机。

### Pxb7/PZDS 绝区零详情资产角标

螃蟹和盼之的绝区零详情页可能在下方资产/验号报告区域展示角色卡片。角色右上角的 `x` 或 `x+y` 比标题更可靠：`x` 是影画/命座数，`+y` 是该角色对应专属音擎数量。读取这类页面时：

- 优先复用已验证的 `opencli pxb7 zzz-detail <url> -f json` 或 `opencli pzds zzz-detail <id> -f json`。
- Adapter 应在必要时滚动到资产卡片区域，读取 DOM 中可见的角色卡片文本或角标元素，并输出浅层 `agentStatuses` 对象。
- 筛选流程必须把该对象标准化到 `game_assets.agent_statuses`，并记录 `agent_status_source` 或 `asset_status_source`。
- 如果只能读到标题里的 S 数量、黄数或几命描述，不能据此确认专属音擎归属；应降级为 `source_status: partial` 并列为人工确认项。

## 性能预算与降级

平台访问必须设置明确等待预算并可提前放弃：

- 列表页/搜索页：通常 10-15 秒。
- 商品详情页：通常 15-20 秒。
- 字幕、评论、图片密集页或登录态页面：通常不超过 30 秒，除非用户明确要求深挖。

同一平台同一意图出现超时、空卡片、登录墙、验证码、`503`、详情页加载失败或无输出命令时，最多再用一种不同工具或自然导航路径复查一次。仍失败则立刻降级并记录，不要继续堆等待。

推荐降级顺序：

1. 公开详情页不可读但列表卡片可读：保留列表卡片字段，标记 `source_status: partial` 和 `fallback_used: list_card`。
2. 结构化工具超时：改用浏览器 CDP 读取 DOM/可见文本/页面 metadata。
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
2. 尝试用户提供链接。
3. 请求用户提供截图或复制文本。
4. 标记该平台当前不可用。

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
