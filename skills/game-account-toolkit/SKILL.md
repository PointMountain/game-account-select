---
name: game-account-toolkit
description: 游戏账号筛选相关的通用工具层，负责依赖检查、ego-browser 单一 task-space 浏览器访问、OCR、结构化抽取、字段交叉验证、平台访问安全和缺失工具安装指引。涉及动态、交互式或登录态平台/社区页面时必须使用本 skill 的 ego-browser 工作流。
argument-hint: "[check|install-guide|platform|ocr|extract]"
---

# Game Account Toolkit Skill

## 作用

这是游戏账号智能筛选体系的通用工具 skill。它不做具体游戏估值，只提供跨平台、跨游戏复用的工具能力和安全边界。

主筛选 skill 和游戏专属 skill 在需要联网、浏览器、OCR、HTML 抽取、样本存储、依赖检查时，应先引用本 skill 的规则。

所有入口 skill 应优先调用 `game-account-preflight`。本 toolkit 的 `scripts/check-deps.mjs` 现在委托给 preflight，保留为兼容入口。

本 skill 还携带仓库托管的 Pxb7/PZDS OpenCLI adapter。命令按游戏命名：明日方舟同时提供 `pxb7/arknights-list`、`pxb7/arknights-detail`、`pzds/arknights-list`、`pzds/arknights-detail`；绝区零提供 `pxb7/zzz-detail` 和 `pzds/zzz-detail`。后续其它游戏应在 `opencli-adapters/games/<game>/clis/<site>/` 下新增自己的命令，避免把游戏专属解析伪装成平台通用 `detail`。用户需要平台详情结构化抽取时，先运行：

```bash
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --check
node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --install
```

安装脚本默认不覆盖用户已有不同内容；确认覆盖时再加 `--force`。

## 文件结构

```text
game-account-toolkit/
├── SKILL.md
├── references/
│   ├── community-research-protocol.md
│   ├── dependency-state-machine.md
│   ├── ego-browser-workflow.md
│   ├── game-skill-standard.md
│   ├── platform-access-policy.md
│   ├── skill-io-contract.md
│   └── shared-listing-schema.md
├── templates/
│   └── game-skill/
├── opencli-adapters/
│   ├── games/
│   │   ├── arknights/
│   │   └── zenless-zone-zero/
│   └── sites/
└── scripts/
    ├── check-deps.mjs
    ├── cleanup-query-session.mjs
    └── install-opencli-adapters.mjs
```

## 执行前状态机

每次被筛选 skill 调用前，按状态机执行：

1. 读取 `references/dependency-state-machine.md`。
2. 需要动态或登录态网页时读取 `references/ego-browser-workflow.md`。
3. 调用 `game-account-preflight`，或运行 `node skills/game-account-preflight/scripts/preflight.mjs --json` 检查本地依赖。
4. 若全部存在，继续执行。
5. 若缺少可本地安装的 npm 依赖，先说明将安装什么、安装到哪里、为什么需要，再请求用户确认。
6. 若缺少系统级依赖或浏览器设置，给出人工安装步骤，不静默安装。
7. 若目标站点需要浏览器访问，完整加载并遵循 `ego-browser`。为本轮目标创建一个短名称 task space，保存返回的数字 id，并在后续所有 heredoc 中复用；不要初始化第二套浏览器传输。

## 安全边界

- 不做全站高频抓取。
- 不绕过验证码、登录限制、风控或付费墙。
- 不自动下单、不联系卖家、不撮合交易。
- 不静默安装全局依赖。
- 不静默修改自身或其它 skill。
- 对平台自动化访问风险做显式提示。

## 工具选择

优先级：

1. 用户提供的链接、截图、文本与无需交互的已验证静态事实。
2. `ego-browser` 语义工作流：`snapshotText()` + 稳定 locator，适合列表、详情、链接、按钮和表单。
3. `ego-browser` 直接数据工作流：单次 `js()` IIFE、`browserFetch()` 或 `serverFetch()`，适合紧凑字段抽取；必须用可见文本、URL 或截图交叉验证关键值。
4. `ego-browser` 视觉工作流：截图 + 坐标/真实键盘，适合虚拟化、canvas 和语义树不完整的页面。
5. 已验证的 OpenCLI adapter 只用于结构化字段交叉验证或重复路径加速，不形成第二条浏览器路由。
6. OCR、截图解析等能力缺失时，先降级为人工截图/文本输入，再建议安装。

## 浏览器生命周期

每轮筛选只使用一个 ego-browser task space；需要多平台时在同一空间复用少量标签页，并随手关闭一次性搜索页。正常 heredoc 开头调用 `useOrCreateTaskSpace(nameOrId)`，后续优先使用首次返回的数字 id，避免名称碰撞。

每次关键导航、点击、输入或抽取后，用 `snapshotText()`、`pageInfo()`、截图或导出/读回路径验证结果。若出现“user is controlling”、inactive 或未分配错误，停止整个浏览器路径并等待用户明确确认；不得自动重试、创建新空间或夺回控制。

任务确认完成后，用独立最终 heredoc 调 `completeTaskSpace(id, { keep: false })`。只有用户明确要求保留页面、需要在该页手动操作，或结果无法用链接/文件/摘要交付时，才使用 `keep: true`；保留前关闭无关临时标签。

```bash
npm run query:cleanup -- --task-space <task-space-id-or-name> --json
npm run verify:browser-cleanup
```

## 社区攻略证据

当账号估值依赖当前版本强度、角色/装备价值、命座/专武收益或买号避坑经验时，必须读取 `references/community-research-protocol.md`。该协议负责把 B站、抖音、小红书、贴吧/微博/通用搜索等社区信号整理为证据快照，再交给游戏专属 skill 转成评分规则。

若某个平台当前工具不可用、超时或需要额外登录/授权，不要绕过限制，也不要假装已覆盖。记录失败原因，降低 `community_confidence`，并在最终推荐中标注覆盖缺口。

## 输出约定

工具层只输出结构化事实和风险，不输出最终购买建议。最终排序和推荐由 `game-account-select` 负责，游戏资产价值判断由对应游戏 skill 负责。
