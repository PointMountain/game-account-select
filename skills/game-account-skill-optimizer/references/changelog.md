# Game Account Skill Optimizer Changelog

## 2026-05-17

- 初始化 `game-account-skill-optimizer`。
- 增加运行问题分类：耗时、空结果、平台覆盖、输出格式、估值、证据、风险和用户反馈。
- 增加 Wuthering Waves 77175988 筛选过程离线回归样例。
- 泛化为仓库级 self-evolving harness 优化器，不再只面向鸣潮或单个游戏 skill。
- 增加内置 Troubleshooting 流程、质量门禁识别和 `redo_required` 打回重做路径。
- 增加绝区零跨 skill 回归样例、质量门禁失败样例和优化报告评估样例。

## 2026-05-23

- 增加 ZZZ 邮箱未实名出售与社区证据刷新窗口回归样例。
- 优化器现在能识别“邮箱未实名出售应作为低找回风险加分项”和“真实买号证据 30 天窗口过长”两类问题。
- 增加社区证据缺口、社区工具降级、等待预算、备选链接和预算浮动备选的优化规则。
- 增加 OpenCLI adapter 缺口诊断：高价值平台没有现成站点命令时，建议按 `opencli-adapter-author` 生成并验证私有 adapter，而不是长期依赖一次性 DOM 抽取。
- 增加 OpenCLI adapter 复用诊断：pxb7/pzds 详情 adapter 通过 `browser verify --strict-memory` 后，优化器应建议优先复用 `opencli <site> detail`，且不再误报 adapter 缺口。
- 增加硬条件预算扩展诊断：预算内无合格账号时，应扩大到价格浮动层并返回最低满足价。
- 增加多队完整性诊断：例如 ZZZ 三虚狩要求三支独立队伍，不能把共享辅助重复计入多个核心。
