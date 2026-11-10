# 安装与独立使用

需要 Node.js 22+。通过远端仓库安装 Skill 时还需要 Git 2.25+；`gh` 仅用于项目开发与 PR，不是找号运行时依赖。在线查询和社区刷新需要以下三项，选择同一个 Agent 和安装范围（项目或用户）：

```bash
npx skills add https://github.com/PointMountain/game-account-select --skill game-account-select --copy
npx skills add https://github.com/wangjs-jacky/jacky-skills/tree/main/harness/ego-ops --skill ego-ops --copy
npx skills add https://github.com/citrolabs/ego-lite --skill ego-browser --copy
```

安装并首次打开 [ego lite](https://lite.ego.app/)，由用户完成初始化；它提供 `ego-browser` 命令，也可能已为 Agent 安装 `ego-browser` Skill。可用 `ego-browser skill` 读取与当前浏览器版本匹配的指南。浏览器支持范围和各系统安装步骤以 [ego lite 官方说明](https://github.com/citrolabs/ego-lite/blob/main/skills/ego-browser/references/install.md)为准。

这些命令从远端安装并复制 Skill，不依赖临时源码目录。需要更新时，在对应的项目或用户范围运行 `npx skills update`；先备份安装后自行维护的经验，以免被更新覆盖。

在新会话中，从宿主提供的路径找到本 `SKILL.md` 所在目录。以下是 macOS/Linux 上 **Codex 项目级安装** 的示例；其他 Agent 或用户级安装应使用其实际 Skill 目录：

```bash
export GAME_ACCOUNT_SKILL_DIR="$PWD/.agents/skills/game-account-select"
node "$GAME_ACCOUNT_SKILL_DIR/scripts/preflight.mjs" --browser --json
node "$GAME_ACCOUNT_SKILL_DIR/scripts/verify.mjs"
```

该变量只在当前 shell 会话生效；Agent 在新进程中执行时应重新设置，或直接使用已确认的绝对路径。

PowerShell 项目级示例：

```powershell
$env:GAME_ACCOUNT_SKILL_DIR = Join-Path (Get-Location) '.agents/skills/game-account-select'
node "$env:GAME_ACCOUNT_SKILL_DIR/scripts/preflight.mjs" --browser --json
node "$env:GAME_ACCOUNT_SKILL_DIR/scripts/verify.mjs"
```

预检搜索当前目录及祖先的 `.agents/skills`、`.codex/skills`、`.claude/skills`，以及已安装 Skill 的同级目录、用户目录和配置的 `CODEX_HOME/skills`。宿主使用其他目录时，可将其 Skill 根目录加入 `GAME_ACCOUNT_EXTRA_SKILL_DIRS`（多个目录按系统 PATH 分隔符分隔）。`--browser` 要求两个依赖 Skill 可读取且 `ego-browser` 可执行文件在 PATH 上；它不启动浏览器，首次真实操作仍需验证连接。未指定 `--browser` 时只检查离线运行环境。`--strict` 还会要求可选的 Git 和 `gh`。

`verify.mjs` 检查已安装 Skill 的链接、operation 状态和游戏数据结构，不代表真实站点已验证。仓库开发仍运行 `npm run dev:check` 和 `npm run verify:skills`。如果 Skill 只读、校验失败或缺少依赖，说明限制，不声称经验已写回或查询成功。

运行数据放在用户指定的私有目录；仓库中的 `.harness/` 已忽略，其他工作目录需先确认忽略规则，或使用系统临时目录。不要把用户原话、画像或商品原始响应写入共享 Skill 知识。
