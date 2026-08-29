---
name: game-account-toolkit
description: 游戏账号筛选相关的通用工具层，负责 ego-ops 查询治理、ego-browser 单一 task-space 访问、OCR、结构化抽取、字段交叉验证和平台安全。涉及任何动态、交互式或登录态平台/社区页面时，必须走 ego-ops + ego-browser 唯一链路。
argument-hint: "[check|install-guide|platform|ocr|extract]"
---

# Game Account Toolkit Skill

## 作用

这是游戏账号智能筛选体系的通用工具 skill。它不做具体游戏估值，只提供跨平台、跨游戏复用的工具能力和安全边界。

主筛选 skill 和游戏专属 skill 在需要联网、浏览器、OCR、HTML 抽取、样本存储、依赖检查时，应先引用本 skill 的规则。

所有入口 skill 应优先调用 `game-account-preflight`。本 toolkit 的 `scripts/check-deps.mjs` 现在委托给 preflight，保留为兼容入口。

本 skill 携带只读 operation 执行目录。`ego-ops` 负责先验知识和验证治理，`ego-browser` 负责实时执行，仓库 runner 负责把已验证页面事实整理成稳定字段：

```bash
npm run query:ego -- --operation pzds/arknights-list --task-space <run-id> --min-price 800 --max-price 1200 --json
npm run query:ego -- --operation generic/semantic-search --task-space <run-id> --url <public-page-url> --expected <page-signal> --json
```

一次多平台筛选传 `--task-space-disposition keep` 复用同一空间，父流程完成后统一调用 `query:cleanup`。

## 文件结构

```text
game-account-toolkit/
├── SKILL.md
├── references/
│   ├── community-research-protocol.md
│   ├── dependency-state-machine.md
│   ├── ego-browser-workflow.md
│   ├── ego-ops-query-contract.md
│   ├── game-skill-standard.md
│   ├── operation-support-matrix.json
│   ├── platform-access-policy.md
│   ├── skill-io-contract.md
│   └── shared-listing-schema.md
├── templates/
│   └── game-skill/
├── ego-operations/
│   ├── manifest.json
│   └── operation parsers and browser scripts
└── scripts/
    ├── check-deps.mjs
    ├── cleanup-query-session.mjs
    ├── evaluate-listings.mjs
    ├── finalize-game-evaluation.mjs
    └── run-ego-operation.mjs
```

## 执行前状态机

每次被筛选 skill 调用前，按状态机执行：

1. 读取 `references/dependency-state-machine.md`。
2. 需要动态或登录态网页时先读取 `references/operation-support-matrix.json` 与 `references/ego-ops-query-contract.md`，再读取 `references/ego-browser-workflow.md`。
3. 调用 `game-account-preflight`，或运行 `node skills/game-account-preflight/scripts/preflight.mjs --json` 检查本地依赖。
4. 若全部存在，继续执行。
5. 若缺少可本地安装的 npm 依赖，先说明将安装什么、安装到哪里、为什么需要，再请求用户确认。
6. 若缺少系统级依赖或浏览器设置，给出人工安装步骤，不静默安装。
7. 若目标站点需要浏览器访问，先检查矩阵中的 game/platform/mode capability。`verified` 且外部 `ego-ops` operation 知识仍有效时才能直接执行；`unsupported` 必须记录覆盖缺口并 fail closed。manifest 中的 `exploration_only` 解析器不是正常能力，只有维护者在 `ego-ops` 受控探索中显式传 `--allow-exploration` 才能运行，并须完成 operation 回写、矩阵升级、离线验证和真实 smoke 后才能发布。
8. 完整加载 `ego-ops`、本机经验、目标站点 operation 和 `ego-browser`。为本轮目标创建一个短名称 task space，保存返回的数字 id，并在后续所有操作中复用。

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
2. ego-ops 已验证 operation：复核入口、权限、对象和成功标准后复用。
3. 正常筛选遇到 operation 缺失、矩阵未支持或知识失效时 fail closed，记录 coverage gap 并降级到用户材料。
4. 维护者显式 `--allow-exploration` 时才进入 ego-ops 低风险只读探索；探索结果不能直接用于真实推荐。
5. 已验证 operation 内部可用 `ego-browser` 语义/直接数据或必要视觉工作流；关键值用页面身份、URL 或可见文字交叉验证。
6. OCR、截图解析等能力缺失时，降级为人工截图/文本输入。

支持矩阵必须与 operation manifest 完全一致：

```bash
node skills/game-account-toolkit/scripts/validate-operation-support-matrix.mjs
```

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
