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
└── scripts/
    └── check-deps.mjs
```

## 执行前状态机

每次被筛选 skill 调用前，按状态机执行：

1. 读取 `references/dependency-state-machine.md`。
2. 调用 `game-account-preflight`，或运行 `node skills/game-account-preflight/scripts/preflight.mjs --json` 检查本地依赖。
3. 若全部存在，继续执行。
4. 若缺少可本地安装的 npm 依赖，先说明将安装什么、安装到哪里、为什么需要，再请求用户确认。
5. 若缺少系统级依赖或浏览器设置，给出人工安装步骤，不静默安装。
6. 若目标站点需要浏览器访问，必须加载并遵循 `web-access` skill。

## 安全边界

- 不做全站高频抓取。
- 不绕过验证码、登录限制、风控或付费墙。
- 不自动下单、不联系卖家、不撮合交易。
- 不静默安装全局依赖。
- 不静默修改自身或其它 skill。
- 对平台自动化访问风险做显式提示。

## 工具选择

优先级：

1. 已有 Claude Code 工具：Read、Write、WebFetch、WebSearch、Bash。
2. 已安装 skill：`web-access` 用于浏览器/CDP。
3. 本 skill 的 `scripts/check-deps.mjs` 做本地依赖检查。
4. OCR、截图解析等能力缺失时，先降级为人工截图/文本输入，再建议安装。

## 社区攻略证据

当账号估值依赖当前版本强度、角色/装备价值、命座/专武收益或买号避坑经验时，必须读取 `references/community-research-protocol.md`。该协议负责把 B站、抖音、小红书、贴吧/微博/通用搜索等社区信号整理为证据快照，再交给游戏专属 skill 转成评分规则。

若某个平台当前工具不可用、超时或需要额外登录/授权，不要绕过限制，也不要假装已覆盖。记录失败原因，降低 `community_confidence`，并在最终推荐中标注覆盖缺口。

## 输出约定

工具层只输出结构化事实和风险，不输出最终购买建议。最终排序和推荐由 `game-account-select` 负责，游戏资产价值判断由对应游戏 skill 负责。
