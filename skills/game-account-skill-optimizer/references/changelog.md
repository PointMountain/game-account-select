# Game Account Skill Optimizer Changelog

## 2026-05-17

- 初始化 `game-account-skill-optimizer`。
- 增加运行问题分类：耗时、空结果、平台覆盖、输出格式、估值、证据、风险和用户反馈。
- 增加 Wuthering Waves 77175988 筛选过程离线回归样例。
- 泛化为仓库级 self-evolving harness 优化器，不再只面向鸣潮或单个游戏 skill。
- 增加内置 Troubleshooting 流程、质量门禁识别和 `redo_required` 打回重做路径。
- 增加绝区零跨 skill 回归样例、质量门禁失败样例和优化报告评估样例。

## 2026-05-23

- 增加绝区零三虚狩配队纠偏识别：optimizer 现在会把南宫/狼/苍角、耀嘉音/琉音、卢西娅/橘福福、直伤电、异放/妄想天使、2+1/1+1/0+1 等反馈归入估值和独立队伍规则更新。
- 增加薇薇安紊乱队关键词识别，用于把额外队伍加分反馈路由到 ZZZ 估值规则和验证样例。
- 增加 ZZZ 邮箱未实名出售与社区证据刷新窗口回归样例。
- 优化器现在能识别“邮箱未实名出售应作为低找回风险加分项”和“真实买号证据 30 天窗口过长”两类问题。
- 增加社区证据缺口、社区工具降级、等待预算、备选链接和预算浮动备选的优化规则。
- 增加 OpenCLI adapter 缺口诊断：高价值平台没有现成站点命令时，建议按 `opencli-adapter-author` 生成并验证私有 adapter，而不是长期依赖一次性 DOM 抽取。
- 增加 OpenCLI adapter 复用诊断：pxb7/pzds 详情 adapter 通过 `browser verify --strict-memory` 后，优化器应建议优先复用 `opencli <site> detail`，且不再误报 adapter 缺口。
- 增加 ZZZ 详情页资产角标诊断：verified pxb7/pzds zzz-detail adapter 推荐结果必须保留 `agentStatuses`，避免只靠标题猜影画和专属音擎。
- 增加 ZZZ 专武名称清单诊断：当角色角标只有 `x` 时，verified pxb7/pzds zzz-detail 结果必须保留 `sWEngineNames`，供本地专武表交叉确认。
- 增加硬条件预算扩展诊断：预算内无合格账号时，应扩大到价格浮动层并返回最低满足价。
- 增加多队完整性诊断：例如 ZZZ 三虚狩要求三支独立队伍，不能把共享辅助重复计入多个核心。
- 增加 PZDS 绝区零列表错路由诊断：详情页 `goodsDetails/<id>/6` 的末尾 `/6` 不能当作列表 `goodsList/6`，错路由或 wrong-game 页面会触发 `platform-pzds-zzz-list-route-mismatch`。

## 2026-05-24

- 根据人工复盘补充 ZZZ 性价比优化信号：虚狩 `2+1` 优先级高于耀嘉音/耀佳音 `1+1`，耀嘉音 `0+0` 可用，非虚狩角色通常 `0+1` 优先于 `1+0`，妄想天使三小只最好都有专武且南宫羽专武优先，琉音是特殊机制辅助。
- 要求把用户确认的高性价比账号形态写入验证样例，并加入耀嘉音 `1+1` 但整体投入较弱的反例，避免再次把单一舒适度信号当硬条件。
- 社区证据路由加入 YouTube：全球同步进度游戏需要把 YouTube 作为 B站之外的独立长视频来源，缺失时应记录未覆盖或降置信度。

## 2026-05-28

- 增加浏览器查询清理诊断：执行记录缺少 `query_session_id`、缺少 `cleanup_reports`，或清理后仍有本轮 OpenCLI/CDP/平台详情进程时，输出 `runtime-browser-session-cleanup-missing`。
- 工具层新增 `query:cleanup`，用于关闭查询 session/target 并审计残留进程；选择器状态机要求最终答复前运行清理。
- 平台访问策略补充 PXB/PZDS 查询操作：列表预筛复用一个受控 session，详情只对短名单运行 verified adapter，避免多开 Chrome 分组和空窗口。
