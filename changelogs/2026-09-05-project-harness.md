# 项目 Harness 与可验证学习

## 改变

- AGENTS.md 作为统一短入口，CLAUDE.md 转引；开发上下文、任务卡、按范围检查使用 dev:context / dev:plan / dev:check。
- Skill 职责与脚本路径兼容，入口由 1,021 行精简到 603 行；详细估值契约、运行规则、输入输出按需读取。
- dependencies.json 维护必需依赖闭包，补齐部分安装组合遗漏的 evaluator；llms.txt 补 optimizer 索引。
- 学习队列以目标 skill / finding 聚合，运行身份去重，复发重开，支持延期、拒绝和恢复。只保存脱敏元数据与哈希。
- 固定门禁、修改前/后文件指纹和回归变化共同形成凭据；applied / verified_existing / pending 分开处理。所有游戏 finalizer 与明日方舟独立 renderer 共用检查，裸 applied 或伪造旧统计不再计为已应用。
- CI 覆盖入口、文档和 changelog 改动，完整验证包含 Harness 与学习回归。

## 验证范围

- 新增 11 个 Harness/学习行为测试，包含虚假 applied、旧统计伪造、run-only 泄漏、重复观察、复发、过期凭据、验证期间漂移、失败测试、路径与并发写保护。
- 全游戏 finalizer 增加虚假 applied 的端到端拒绝用例；已有模板生成、评分、来源、交付哈希、operation 与 cleanup 离线回归继续执行。
- 两次修复保留先失败再通过的证据；本轮用明日方舟 renderer 缺陷演练 collect → verify → apply，凭据保存在本地 `.harness/learning.json`。
- 平台 operation/parser 未改变，本轮不重复市场 live 查询。离线结果不升级平台支持声明。

## 兼容与限制

裸 applied/accepted/merged 的旧 artifact 会被保守拒绝，需重新验证或按实际情况降为 proposed / verified_existing。凭据仅对当前本地源码有效，后续源码/文档变化需要重新验证。Git 中保留可复用规则、脱敏 fixture 和本记录，运行队列不提交。

学习器聚合并验证 Agent 实现的补丁，不自动发明评分规则或绕过证据门槛。详见 [学习闭环](../skills/game-account-skill-optimizer/references/learning-loop.md)。
