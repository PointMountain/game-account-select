# Ego-browser 数据获取工作流

## 目标

在 ego-ops 任务卡和 operation 约束下，用一个隔离 task space 完成平台与社区页面的观察、操作、结构化抽取、交叉验证和清理。效率来自复用空间与标签、批量提取和及时停止；准确性来自页面身份验证、最小记录边界和双证据读回。

## 1. 从已验证 operation 创建并冻结 task space

正常筛选只能通过仓库 operation runner 启动；它会校验 manifest、support matrix 和 ego-ops 知识后，在同一 task space 内执行 ego-browser：

```bash
npm run query:ego -- --operation <platform>/<game>-list --input '<json>' --task-space gas-<game>-<timestamp> --json
```

保存返回的数字 id。后续同一用户目标继续传同一个 `--task-space`；多平台不创建独立空间。矩阵单元缺失、operation 漂移或知识未验证时立即 fail closed，记录 coverage gap 并改用用户材料。

维护者探索也必须经由 operation runner 显式执行 `npm run query:ego -- --operation <manifest-candidate> --allow-exploration ...`，不能绕过 runner 直接调用 ego-browser。探索结果在完成知识回写、矩阵升级、离线回归和 live smoke 前，不能进入真实推荐。

## 2. 先验证页面身份

在提取前同时检查：

- `pageInfo().url` 与 title。
- `snapshotText()` 是否包含目标游戏、平台面包屑或关键筛选项。
- 页面是否出现登录、验证码、访问频率、安全校验、错误游戏或空结果信号。

页面身份不对时，本次尝试记为 `wrong_game` / `blocked` / `login_required`，不进入字段抽取。

## 3. 选择工作流

### 语义工作流

普通列表、详情、链接、按钮和表单先使用 `snapshotText()`，动作优先使用最新的 `@N` 或稳定 `loc=...`。每次 snapshot 会刷新 refs；长期复用 locator 或显式 CSS，不能依赖旧 ref。

### 直接数据工作流

需要批量字段时，在一次 `js(String.raw\`(() => { ... })()\`)` 中完成遍历、去重、标准化与返回；页面内请求用 `browserFetch()`，只有不需要登录态时才考虑 `serverFetch()`。

不要把多步 DOM 逻辑拆成许多 `js()` 调用。单次 IIFE 减少往返和页面重渲染造成的行错位。

### 视觉工作流

虚拟化列表、canvas、富编辑器或语义树不完整时，用截图定位，再以坐标、真实鼠标和键盘操作。动作后再次截图或走导出/读回路径验证。

## 4. 列表抽取准确性门禁

每条记录先锚定唯一详情链接，再取最小记录边界：

1. 从 `a[href*="goodsDetails"]` 或站点等价详情链接开始。
2. 若 `link.innerText` 已包含标题、价格和风险标签，直接使用链接文本。
3. 需要父容器时，选择不包含其它详情链接的最小祖先；不要用宽泛的 `[class*="goods"]` / `[class*="item"]`，它可能命中整张列表。
4. 从 URL 解析 `listing_id`，以 URL/id 去重。
5. 价格、标题、区服、绑定和资源从同一最小边界读取，禁止把相邻卡片文本拼到当前记录。

返回后必须满足：

- `listing_id` 唯一数等于记录数。
- 每条 URL 都能在最新语义快照或页面链接集合中找到。
- 每条价格能在同一记录文本中回读。
- 抽样至少 3 条；任一字段错位就收紧选择器并重跑，不得把整页文本包装成多条成功记录。

## 5. 详情与关键字段复核

- 只打开短名单详情，避免大量标签和高频访问。
- 详情页 URL/id 必须与列表记录一致。
- 角色/装备/资源/绑定事实同时保留来源状态；标题摘要不能替代资产卡片或验号报告。
- 关键推荐字段至少由两类证据确认：语义文本 + DOM、DOM + 截图、页面实时观察 + ego-ops operation 检查点，或页面 + 用户确认。

## 6. 操作后验证

导航、点击、输入、加载更多和页内请求后，用以下至少一种方式读回：

- `snapshotText()` 检查目标文本、行数或状态。
- `pageInfo()` 检查 URL/title/viewport。
- `captureScreenshot()` 检查视觉状态。
- `js()` 返回独立计数、唯一 id 和字段一致性。

`cliLog()` 是 heredoc 的唯一结果输出。宿主包装器若需要解析 JSON，应兼容输出落在 stdout 或 stderr；不要因只读一个流把成功误判为失败。

## 7. 控制权硬停止

遇到 `user is controlling`、inactive 或未分配状态：

- 立即停止整个浏览器路径。
- 不重试、不创建新空间、不自动 `takeOverTaskSpace`。
- 告诉用户 task space 和待完成动作。
- 用户明确确认继续后，才按 ego-browser 规则 takeover/claim，并选择确切标签页。

## 8. 完成与清理

确认数据与最终结果已交付后，在独立最终 heredoc 中完成空间：

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

只有用户明确要保留页面、需要手动操作，或结果无法用链接/文件/摘要交付时使用 `keep: true`。若 ownership 不再是 `agent`，立即停止并等待用户确认，不能利用 `keep: false` 的强制行为认领或关闭用户空间。清理报告写入 `cleanup_reports`，并要求 `done: true`、`ego_task_spaces_remaining: []`。
