---
name: game-account-toolkit
description: 游戏账号筛选相关的通用工具层，负责依赖检查、浏览器访问、OCR、结构化抽取、平台访问安全和缺失工具安装指引。供 game-account-select 与各游戏估值 skill 引用。
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
2. 调用 `game-account-preflight`，或运行 `node skills/game-account-preflight/scripts/preflight.mjs --json` 检查本地依赖。
3. 若全部存在，继续执行。
4. 若缺少可本地安装的 npm 依赖，先说明将安装什么、安装到哪里、为什么需要，再请求用户确认。
5. 若缺少系统级依赖或浏览器设置，给出人工安装步骤，不静默安装。
6. 若目标站点需要浏览器访问，优先加载并遵循 `chrome-use`，先执行 `chrome-use skills get core --full`；其扩展 relay 不可用时，再加载 `web-access` 走 CDP 兜底。

## 安全边界

- 不做全站高频抓取。
- 不绕过验证码、登录限制、风控或付费墙。
- 不自动下单、不联系卖家、不撮合交易。
- 不静默安装全局依赖。
- 不静默修改自身或其它 skill。
- 对平台自动化访问风险做显式提示。

## 工具选择

优先级：

1. 已验证的 OpenCLI adapter 或静态读取能力。
2. `chrome-use` 扩展 relay，用命名 session 复用真实 Chrome；本机实测不会触发 remote-debugging 授权弹窗。
3. `web-access` + CDP 作为浏览器兜底。
4. 本 skill 的 `scripts/check-deps.mjs` 做本地依赖检查。
5. OCR、截图解析等能力缺失时，先降级为人工截图/文本输入，再建议安装。

## 浏览器生命周期

OpenCLI adapter 的 `--keep-tab false` 只释放 lease；OpenCLI Browser Bridge 会把最后一个自动化标签改成 `about:blank` 作为复用占位符，并保留容器窗口。因此“命令结束”不等于“窗口已清理”。

筛选执行器应在第一次浏览器命令前同时捕获 target 基线和（macOS）Chrome 窗口 ID 基线，登记本轮新 target，并在成功、报错、`SIGINT`、`SIGTERM` 和进程退出路径统一调用 `scripts/cleanup-query-session.mjs`。清理器默认不按平台 URL 批量关用户标签；它关闭显式 `--target`、显式会话，以及配合 `--baseline --close-new-query-targets` 识别出的本轮平台页/空白占位符。若 Chrome 在关闭最后一个 target 后又生成新的空白占位标签，清理器还会关闭“本轮新建且全部标签均为查询页或 about:blank”的独立窗口；运行前窗口、混合用户窗口和无关新窗口始终保留。

明日方舟的 `run-dual-platform-selection.mjs` 已内置这套生命周期。手工浏览器测试需要使用命名 session，并在结束时传入实际 target；不要把 `opencli browser <session> close` 当成完整清理。

```bash
node skills/game-account-toolkit/scripts/cleanup-query-session.mjs --capture-baseline /tmp/gas-browser-baseline.json --json
# 运行本轮查询或验证，并记录返回的 target id
node skills/game-account-toolkit/scripts/cleanup-query-session.mjs --baseline /tmp/gas-browser-baseline.json --close-new-query-targets --target <owned-target-id> --json
npm run verify:browser-cleanup
```

## 社区攻略证据

当账号估值依赖当前版本强度、角色/装备价值、命座/专武收益或买号避坑经验时，必须读取 `references/community-research-protocol.md`。该协议负责把 B站、抖音、小红书、贴吧/微博/通用搜索等社区信号整理为证据快照，再交给游戏专属 skill 转成评分规则。

若某个平台当前工具不可用、超时或需要额外登录/授权，不要绕过限制，也不要假装已覆盖。记录失败原因，降低 `community_confidence`，并在最终推荐中标注覆盖缺口。

## 输出约定

工具层只输出结构化事实和风险，不输出最终购买建议。最终排序和推荐由 `game-account-select` 负责，游戏资产价值判断由对应游戏 skill 负责。
