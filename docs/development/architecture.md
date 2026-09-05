# 架构边界

| 层 | 所有者 | 输入 → 输出 |
| --- | --- | --- |
| 用户入口 | game-account-select | 原始需求 → 冻结画像、覆盖计划、确定性报告 |
| 游戏领域 | 四个 game-account 游戏 skill | 标准化资产 + 画像 → 独立维度、评分、置信度 |
| 运行底座 | preflight / toolkit | 环境与 operation → 事实、来源、能力缺口、精确清理 |
| 演进 | optimizer / evaluator | raw run → findings → 可复现补丁 → 验证凭据 |
| 扩展 | generator / community-updater | 新游戏 / 当前证据 → 保守规则、样例、门禁 |

开发 Harness 位于 `scripts/` 与 `docs/development/`；运行能力留在 `skills/` 内，安装 skill 后仍能找到兄弟依赖。目录与脚本路径保持兼容，按职责与按需文档分层。

## 两个闭环

运行：需求 → preflight → coverage → ego-ops/ego-browser → 领域估值 → finalizer → optimizer/evaluator → 确定性报告。

开发：运行证据 → 去重诊断 → 责任文件与失败用例 → 补丁 → 回归 → 当前文件指纹凭据 → applied → 复发重新打开。

运行质量门禁决定本轮结果能否交付；学习队列管理后续改进。推迟队列项不会让有阻塞 findings 的 raw artifact 自动通过。学习凭据也不等于游戏事实已被外部证据证实；估值变化仍需对应游戏的证据标准。

参见 [ADR-0001](../adr/0001-unified-game-skill-contract-and-verified-operations.md) 和 [ADR-0002](../adr/0002-project-harness-and-learning-receipts.md)。
