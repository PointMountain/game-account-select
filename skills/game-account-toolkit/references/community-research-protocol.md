# 社区攻略证据协议

该协议用于把 B站、YouTube、抖音、小红书、贴吧、微博、攻略站和官方公告中的版本评价，转成可维护的游戏账号估值因子。它不负责购买建议，只负责建立“当前版本什么资产真有价值”的证据快照。

## 适用场景

当用户要求筛选、估值或比较游戏账号时，只要判断依赖当前版本强度、抽卡规划、队伍生态、命座/专武价值，就必须先使用本协议，或读取最近一次已记录且仍未过期的证据快照。

真实买号筛选的默认证据有效期为 7 天。若游戏版本节奏较慢且账号资产不依赖当前强度榜，可在对应游戏 skill 中放宽到 14 天；不得继续使用 30 天作为默认有效期。跨版本、出现新角色/装备、或用户偏好依赖当前深渊/高难环境时，即使未满 7 天也应刷新。

当结论不确定时，必须先找社群答案：

- 候选账号出现本地知识未覆盖的新角色、新武器/音擎、新队伍、新皮肤高溢价或新高难环境。
- 用户明确让“看社群配对/强度/避坑”或类似要求决定排序。
- 平台标题写法和游戏设定口径不一致，例如交易标题把多个角色统称为同一标签。
- 多个候选在资产接近但风险/辅助/资源不同，排名需要当前版本配队共识支撑。

找不到足够证据时允许继续筛选，但必须把相关排序降为 `community_confidence: low|medium`，并输出人工确认项。

## 证据等级

从高到低使用：

1. 官方公告和版本更新说明：确认版本、卡池、角色名、机制变化。
2. 长视频/长文攻略：B站、YouTube 视频、专栏、Wiki/攻略站，适合提取强度、队伍、命座、专武结论。全球同步进度游戏应把 YouTube 作为可用独立社区来源。
3. 多平台高互动讨论：小红书图文、抖音话题/视频、贴吧/微博讨论，用于验证普通玩家关注点和争议点。
4. 评论区共识：只能作为辅助证据，不能单独改变评分规则。
5. 单条短帖、标题党、未列数据的观点：低置信度，只能触发人工确认或待验证项。

## 最小取证要求

写入游戏估值规则前，至少满足以下之一：

- 1 个官方/准官方版本事实 + 2 个独立社区攻略来源支持同一方向。
- 3 个独立社区来源在角色、队伍、命座/专武价值上结论一致。
- 用户明确提供账号样本和目标偏好时，至少 2 个独立来源支持该偏好的价值判断。

如果无法满足，允许继续筛选，但必须：

- 将 `community_confidence` 标为 `low`；
- 把相关角色/命座/专武列入 `missing_fields` 或 `manual_check`；
- 不得用未经证实的强度判断大幅抬高账号排名。

## 平台路由

优先使用当前环境可用工具，低频查询并记录失败原因。

### B站

适合长视频攻略、版本抽卡建议、配队实测和评论共识。

推荐流程：

1. 查询词包含游戏名、版本号、角色强度、配队、专武、命座或账号购买目标。
2. 读取搜索结果标题、作者、互动分、URL。
3. 对代表性视频读取 metadata、字幕和少量高赞评论。
4. 若字幕不可用，只能摘要标题/简介/评论，不得声称已理解完整视频内容。
5. 若结构化命令超时或无输出，立即改用浏览器 CDP 读取页面 DOM、`meta[name=description]`、合集/相关视频标题和页面可见评论；仍失败时记录 `fallback_used: browser_dom_or_metadata` 或 `failed`，不要继续等待同一命令。

### YouTube

适合全球同步进度游戏的长视频攻略、配队展示、命座/专武价值判断和英文社区共识。绝区零、鸣潮等中外版本同步或接近同步的游戏，YouTube 应与 B站一起作为优先长视频来源。

推荐流程：

1. 查询词包含英文游戏名、角色英文名、team、build、signature weapon、dupe / mindscape / resonance、account value 等关键词。
2. 读取搜索结果标题、频道、发布时间、观看量、URL 和简介。
3. 优先读取章节、字幕、简介、置顶评论和少量高赞评论；字幕不可用时，只能把标题/简介/章节/评论作为中低置信证据。
4. 若结构化工具不可用，改用浏览器 CDP、页面 metadata、公开字幕接口、Jina/WebFetch/curl 或通用搜索摘要；仍失败时记录 `fallback_used` 和失败原因。
5. 不得把单条英文视频标题直接升级成硬规则；应与 B站、小红书、攻略站或官方资料交叉确认。

### 小红书

适合图文攻略、入坑建议、买号避坑和普通玩家偏好。

推荐流程：

1. 查询角色强度、账号购买、专武、资源、绑定风险。
2. 读取笔记正文和互动数。
3. 用评论补充争议点，但不要把单条评论升级为规则。
4. 若搜索或详情工具超时，改用浏览器 CDP 读取搜索结果卡片、标题、作者、互动数和可见正文；若登录墙、验证码或空卡片阻断，记录失败并改用 B站、贴吧/微博、通用搜索、官方公告或攻略站交叉验证。

### 抖音

适合短视频话题热度和大众讨论，但当前工具不一定支持通用公开搜索。

推荐流程：

1. 若可用，优先读取话题、公开视频列表和热门评论。
2. 若当前工具只支持创作者/话题接口或访问失败，记录“抖音覆盖不可用/有限”，不要阻塞筛选。
3. 不得因为抖音不可用而伪造短视频共识。

### 贴吧、微博、知乎、通用搜索

作为补充来源，用于发现争议、找回风险、账号交易风险和版本讨论。

### 工具降级与性能预算

社区取证必须低频、可中断，并记录每次尝试：

- `tool`：opencli、browser_cdp、web_fetch、jina、curl、search_engine、user_provided_text 等。
- `wait_budget_ms`：搜索/列表通常 10000-15000，字幕/评论/详情通常 15000-20000；除非用户明确要求深入，不要让单条命令超过 30000。
- `duration_ms`、`status`、`result_count`、`error_text`。
- `fallback_used`：例如 `browser_dom`、`page_metadata`、`guide_site`、`official_source`、`user_screenshot`。

同一来源同一意图超时一次后，不要换词反复追打；先换工具或换独立来源。只有标题、卡片或元数据时，结论必须标为低到中置信。

## 证据快照字段

游戏 skill 的证据快照建议使用：

```yaml
community_evidence:
  game: string
  version_context: string
  updated_at: YYYY-MM-DD
  max_age_for_live_purchase_days: number
  source_coverage:
    bilibili: available|limited|failed|not_checked
    youtube: available|limited|failed|not_checked
    douyin: available|limited|failed|not_checked
    xiaohongshu: available|limited|failed|not_checked
    other: string[]
  query_log:
    - source: string
      tool: string
      query: string
      status: success|failed|timeout|limited
      duration_ms: number | null
      wait_budget_ms: number | null
      fallback_used: string | null
      notes: string
  consensus:
    high_value_assets: string[]
    medium_value_assets: string[]
    low_value_or_trap_assets: string[]
    key_teams: string[]
    signature_weapon_notes: string[]
    duplicate_notes: string[]
    account_risk_notes: string[]
  limitations: string[]
```

## 转成评分规则

只把稳定共识转成硬规则：

- 多来源一致认为核心的限定角色、关键队伍、关键专武，可以加高权重。
- 只有泛泛“强”“好用”的评价，最多中权重。
- 只有讨论热度但缺少实战/攻略支撑，最多低权重。
- 常驻、可歪、过时或只靠高命堆数的资产，不得因为数量高直接进高权重。
- 任何账号描述缺少角色命座、专武、资源或绑定状态时，必须降置信度。

## 输出要求

筛选结果必须说明：

- 本次使用了哪份证据快照或哪些社区来源。
- 哪些账号资产命中了社区共识。
- 哪些账号资产只是数量堆叠或常驻/弱势高命。
- 哪些结论因为平台不可用、字幕缺失、样本少而需要人工确认。
