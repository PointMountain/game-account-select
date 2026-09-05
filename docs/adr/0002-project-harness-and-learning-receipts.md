# ADR-0002: Project Harness and evidence-bound learning

- Status: Accepted
- Date: 2026-09-05

## Context

运行层已有质量门禁，但开发入口只有外部跟踪与领域文档指针。部分安装组合缺少 evaluator，skill 入口同时装载运行与维护细节；finalizer 根据候选状态字符串计算 applied，无法证明真实补丁。

## Decision

AGENTS.md 为唯一开发入口，CLAUDE.md 转引它。CLI 按改动路径生成上下文、任务卡和验证计划，CI 执行同一离线门禁。Skill 名称与脚本路径兼容，详细分支通过 references 按需读取；required 依赖由一个 JSON 契约维护。

Optimizer 增加本地学习队列：重新分析 raw artifact，以目标 skill / finding ID 聚合，以运行身份去重。保存观测哈希、修改前指纹、状态历史和当前验证凭据，不复制卖家/用户内容。固定仓库门禁执行成功、责任文件与回归发生变化、验证期间及之后源码未漂移，才允许记录 applied。Finalizer/optimizer 共享这一检查；单写 applied/accepted/merged 均不构成证据。

## Consequences

- 队列写入加锁并原子替换；复发重开，失败验证保持 proposed。
- 本地凭据是维护证据，不是密码学认证或真实平台证明；拥有仓库写权限的人仍能改变测试本身，需实际审查正反例。
- 旧 artifact 没有凭据的 applied 声明会被拒绝，需重新验证或改为 proposed / verified_existing 并重新 finalizer。
- `.harness/` 不提交；在另一 checkout 打开 artifact 时若没有凭据，会保守计为 pending。可复用脱敏 fixture、ADR 和 changelog 进入 Git。
- 任一验证范围内文件变化都使凭据过期；这是主动保守选择。已支持平台、评分规则与公开脚本接口保持原有边界。
