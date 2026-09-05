# 验证边界

`npm run dev:context` 输出按文件选择的检查；`npm run dev:check` 执行。用 `--files` 在改动前规划，用 `--base <ref>` 检查提交范围；最终交付检查实际工作区，避免显式文件列表漏掉修改。

| 改动 | 验证 |
| --- | --- |
| 入口、引用、安装组合 | verify:harness：链接、入口体积、依赖闭包、开发路由测试 |
| 单游戏规则/评分/报告 | 该游戏 sample、finalizer、evaluator，加 Harness 检查 |
| 共享 skill、工具、优化器、模板、配置、未知路径 | 完整 verify:skills，包含 Harness/self-improve 回归 |
| 平台 parser、operation、矩阵、查询编排 | 上述离线门禁 + verify:live-game-skills + task-space cleanup |

CLI 的 `offline_passed` 只说明本地测试；`delivery_ready` 在存在 live 要求时保持 false。live 执行记录由维护者附到任务卡，CLI 不推断浏览器成功。

## Self-improve 反例

必须证明：只改 applied 状态被拒绝；失败/中途漂移/验证后改文件的凭据被拒绝；同一运行不重复计数；新运行复发重新打开；有补丁、正反例和通过门禁的当前凭据才接受。

`learn:verify` 固定运行仓库 `verify:skills`，不执行 raw artifact 中的 `validation_commands`。凭据保存输出哈希与本地 `log_path`，失败时读该日志定位；日志位于忽略目录且默认仅当前用户可读。未通过不能提升状态。源码范围包括 skills、scripts、docs、changelogs、CI 和根配置；任何这些文件变化都会要求重新验证。外部 ego-ops 知识变更需要独立 live 证据，不能用本仓库离线凭据代替。
