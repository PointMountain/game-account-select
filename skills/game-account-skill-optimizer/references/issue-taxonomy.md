# Skill 优化问题分类

updated_at: 2026-05-17

## 分类

## 自动补丁边界

`autopatch_safe: true` 只适合流程文档、平台顺序、输出格式和运行记录字段这类低风险改动。估值权重、社区 meta、高价值角色分层、平台解析器实现、质量门禁豁免和风险扣分默认 `autopatch_safe: false`，除非用户明确要求实现并且验证脚本覆盖对应误判。

### troubleshooting

执行失败、工具报错、依赖缺失或流程卡住。Troubleshooting 是所有分类之前的第一步：先定位失败阶段，再决定改哪个 skill。

常见信号：

- `errors`、`exceptions`、`tool_failures`、`blocked_steps` 非空。
- 预检查缺必需依赖。
- 脚本异常退出。
- 优化器无法判断目标 skill 或目标文件。

建议：

- 先补运行证据和复现命令。
- 区分是环境问题、平台访问问题、规则问题还是输出契约问题。
- 不要用估值权重变化掩盖工具失败。

### runtime

执行耗时、无响应、重复等待、没有及时切换路径。

常见信号：

- `status: timeout`
- `duration_ms` 超过 30000
- 同一平台同一意图重复失败
- 命令无输出但进程长期运行

建议：

- 给该平台设置等待预算。
- 失败后进入降级路径，不反复重试。
- 把失败原因写入数据来源限制。

### empty_result

平台返回空结果、登录提示、验证页面或无法读取候选。

常见信号：

- `result_count: 0`
- `login_required`
- `blocked`
- `verification`
- 页面只有“登录后推荐”而没有商品卡片

建议：

- 标记平台当前不可用或需要用户登录/截图。
- 改用用户提供链接、公开详情页或其它平台。

### platform_coverage

用户目标市场的主流平台没有被纳入搜索顺序。

当前中国账号交易平台优先级以 `game-account-toolkit/references/platform-priority.json` 为准。核心含义：

- 用户指定平台或链接优先。
- 螃蟹账号代售：`https://www.pxb7.com/`
- 盼之代售：`https://www.pzds.com/`
- 交易猫。
- 淘手游。
- 闲鱼仅作为补充，且经常受登录、推荐流和风控影响。

建议：

- 更新平台访问策略和主筛选状态机。
- 不要声明已覆盖没有实际读取的平台。

### output_format

机器可读标签直接出现在用户主文案中，导致回复不自然。

常见信号：

- 最终回复包含 `<game_account_evaluation>`
- 最终回复包含 `<recommendations>` 且没有自然语言摘要
- JSON 过长且没有解释

建议：

- 用户可见部分先给推荐结论、理由、风险和人工确认项。
- 机器标签只在调试、日志或用户明确要求结构化输出时展示。

### valuation

估值规则漏掉关键游戏理解或过度依赖单一字段。该分类适用于所有游戏 skill，不只适用于鸣潮。

常见信号：

- 只看命座、专武或总稀有度。
- 忽略热门配队、主 C 是否带专武、队伍角色关系。
- 忽略绝区零专属音擎/队伍/邦布，明日方舟专精/模组/限定联动，异环弧盘/觉醒等游戏特有资产。
- 用户反馈某个队伍或角色价值判断错误。

建议：

- 更新对应游戏的 `valuation-rules.md`、知识表和验证样例。
- 新增验证样例，确保相同误判不复发。

### evidence

社区证据过期、覆盖不足或无法支撑规则升级。

常见信号：

- `community_confidence: low|medium`
- `rule_update_suggestion` 非空
- 新角色或新队伍未出现在快照中

建议：

- 调用 `game-account-community-updater` 或按社区调研协议刷新证据。
- 在刷新前不要把单次观察升级为硬规则。

### risk

绑定、找回、验号、实名、平台保障没有被充分处理。

常见信号：

- missing fields 中包含绑定、PS5、TAP、Wegame、找回包赔、官方验号。
- 最终推荐没有置顶交易风险。

建议：

- 提高缺失字段扣分。
- 输出人工确认清单。

### user_feedback

用户明确指出偏好、平台、规则或输出体验不符合预期。

建议：

- 用户反馈可作为优化触发器，但规则写入仍需证据和验证。
- 若用户明确要求实现优化，可在当前工作流中修改文件并运行测试。

### quality_gate

生成器或优化器产出的 skill 未通过 `game-account-skill-evaluator`。

常见信号：

- evaluator 输出 `passed: false`。
- evaluator 输出 `redo_required: true`。
- `score` 低于 `threshold`。
- 阻塞问题包含缺文件、缺验证样例、缺风险规则、缺证据或优化器自身回归样例失败。

建议：

- 不要继续把该 skill 用于真实推荐。
- 把 evaluator 的阻塞问题转成优化器 finding，定位到目标 skill 的 `SKILL.md`、`references/`、`scripts/` 和 `test-fixtures/`。
- 修完后重新运行目标验证脚本和 evaluator；仍低分则继续打回重做。
