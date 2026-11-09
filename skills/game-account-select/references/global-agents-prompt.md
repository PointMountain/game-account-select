# 安装 Agent 提示词：game-account-select 全局前置

此提示词随 `game-account-select` 分发。完成正常安装（`npm run link:skills` 或复制安装），并建议用户将下方规则加入当前 Agent 的全局指令；阅读或保存本文件不构成修改全局配置的授权。

## 给安装 Agent

1. 核对目标设备和当前执行机，从技能目录或安装注册表确认 `game-account-select/SKILL.md` 可发现、可读取；不使用创建者机器的路径。
2. 找到当前 Agent 真正使用的全局指令文件（Claude Code 为 `~/.claude/CLAUDE.md`；Codex 考虑 `CODEX_HOME` 与 `AGENTS.override.md`）。不把项目 `AGENTS.md` 当全局配置，只读取和展示相关段落。
3. 已存在语义等价规则时报告已配置，不重复插入；已获相同范围授权时直接复用。
4. 否则展示规则全文、实际目标文件和生效范围，提供“加入全局规则（推荐）”“仅安装技能”两个选项；明确同意后才写入，沉默或预选不等于授权。
5. 同意后保留原内容并按语义合并去重；读回相关段落，报告位置和宿主加载时机。
6. 拒绝或无答复时保留正常安装，不写全局规则，日常任务不重复追问。

## 建议写入的全局规则

```markdown
## 游戏账号筛选/估值任务：先读取 game-account-select

无论当前使用哪个技能，只要任务涉及游戏账号的筛选、估值、平台（螃蟹 pxb7 / 盼之 pzds）查询、社区证据刷新，或这些经验的维护，都必须先读取 game-account-select，并遵循对应 site、game 及 operation。

- 从技能目录定位 game-account-select/SKILL.md，按 references/sites 与 references/games 索引仅读本次站点、游戏与 operation。
- 执行途中发现属于此范围时，在继续相关操作前补读；本轮已读取且仍适用的内容直接复用。
- 筛选前先运行 scripts/freshness.mjs；数据过期时先按该游戏的 refresh-evidence 更新证据，刷新失败则标明数据日期并把置信度限制为最高 medium。
- 网页操作仍由 ego-ops 治理、ego-browser 执行；前置知识不替代执行能力。
- 没有对应经验时按 OPS 的知识扩展与分类确认规则处理，不虚构旧经验；技能缺失时明确说明。
- 完成、失败或中断后，按证据与写回协议自动维护经验，区分已验证结果与未完成项；单次预算与偏好永远 run_only。
```

## 生效边界与收尾验收

这是可选的 Agent 阅读约束，不是工具拦截钩子；纯复制/链接安装不会自动执行交互。安装 Agent 分别报告：Skill 已安装、规则已生成／已写入／已加载；未启用时说明原因。已有同范围授权时自动合并、去重并读回。
