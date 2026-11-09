# 验证边界

`npm run dev:context` 输出按文件选择的检查；`npm run dev:check` 执行。用 `--files` 在改动前规划，用 `--base <ref>` 检查提交范围。

| 改动 | 验证 |
| --- | --- |
| 文档、README、changelog | verify:harness：链接、入口体积、开发路由测试 |
| 游戏目录、shortlist、profile | verify:skills（含 shortlist 与 harness 一致性检查） |
| 站点 operation、parsers、query/cleanup、operations.json | verify:skills + 真实 ego-browser 运行与 task-space 清理（`live_required`） |

`verify-harness` 额外检查：仓库只有一个 skill；每个 manifest operation 都有站点知识文件且被站点索引链接；manifest 标 verified 的 operation 知识文件也必须是 verified；verified 文件带真实日期，documented/partial 不带成功日期；每个游戏目录有 index、game.json、refresh-evidence。

CLI 的 `offline_passed` 只说明本地测试；存在 live 要求时 `delivery_ready` 保持 false。live 结果由维护者记录，CLI 不推断浏览器成功。
