# 工具运行流程

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

发布或修改游戏查询能力后还必须运行真实全栈回归。该入口逐游戏执行已验证列表、详情、专属估值器、finalizer、质量门禁和 task-space 清理；任一游戏未找到公开账号或任一步失败，整体返回非零：

```bash
GAME_ACCOUNT_EGO_OPS_DIR=<ego-ops-skill-dir> npm run verify:live-game-skills
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
