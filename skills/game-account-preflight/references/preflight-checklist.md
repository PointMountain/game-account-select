# 执行前准备检查清单

updated_at: 2026-08-29

## 必需检查

- Node.js 22+：运行本仓库 ESM 脚本。
- git：分支、diff 和提交工作流。
- gh：远端 PR、CI 和仓库配置。
- 配套 skills：toolkit、selector、游戏 skill 与 evaluator 的入口文件存在。

## 条件检查

- ego-ops：所有动态查询的任务卡、站点 operation、授权边界、结果验证和成功后知识写回层。
- ego-browser：所有动态、交互式或登录态网页的唯一浏览器传输。显式使用时不提前执行命令、版本或连接探针；首次真实操作验证运行时。
- OCR：只有当账号资产只在图片中时需要。

## 自动安装策略

当前仓库没有 package manager 依赖，preflight 默认不执行自动安装。

允许未来扩展的自动动作：

- 安装仓库内声明的本地 npm 依赖。
- 创建临时输出目录。

禁止静默自动动作：

- 全局安装未声明的软件或系统包。
- 在失败、页面临时异常或未完成验证时更新 ego-ops 的 `last_verified`。
- 修改浏览器或系统设置。
- 安装或删除 Codex skills。
- 写入用户 shell profile。

## 浏览器执行与降级

- 浏览器需要时冻结 `selected_transport: ego_browser`，复用一个命名 task space；不要并行初始化别的浏览器栈。
- 普通页面先用 `snapshotText()` 获取语义结构；列表/详情的紧凑字段用一次 `js()` IIFE 或 `browserFetch()` 提取，并用页面文本、URL 或截图复核。
- 富交互、虚拟化或 canvas 页面先截图并用坐标/真实键盘操作； substantial write 前先做小探针并读回。
- 首次实际操作若报告命令缺失或环境缺失，读取 ego-browser 的 `references/install.md` 后恢复原任务。
- 用户控制、inactive 或未分配状态必须暂停等待确认；不能自动夺回控制。
- 页面不可读时依次尝试 ego-ops 已验证 operation、低风险只读探索、ego-browser 视觉工作流，再降级为官方来源或用户链接/截图/文本；每次都记录覆盖缺口。

## 其它降级

- 缺 ego-ops：停止动态查询并安装或链接该 skill；不能绕过治理层直接换其它查询软件。
- 缺目标站点 operation：允许在明确只读任务卡下探索；成功后才生成脱敏 operation，失败不写回。
- 缺 OCR：让用户复制文本或手动转写关键资产。
