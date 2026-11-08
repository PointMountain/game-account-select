# 分类与操作范围

## 分类决策

- 状态：已确认（2026-11-09）。依据：用户要求整库只保留一个以账号筛选为核心的 skill，按“交易网站 + 游戏”积累经验；评分改为轻量的通用筛选脚本；元工具并入或删除。
- 服务范围：在交易网站上主动筛选游戏账号，包括需求画像、列表/详情查询、筛选排序、交付，以及为筛选服务的社区证据刷新。
- 两个分类主键：
  - `site`（[sites/](sites/index.md)）：与站点有关的事实，如域名、URL 规则、限流、时间字段含义，以及各游戏在该站的列表/详情 operation（`<game>-list` / `<game>-detail`）。
  - `game`（[games/](games/index.md)）：与站点无关的游戏知识，如要看哪些资产、常见坑、风险词、社区证据和 refresh-evidence operation。
- 归类规则：只在某个站点成立的事实归 site；换一个站点仍成立的归 game；“某游戏在某站怎么读”的归 site operation，并在 game index 里链接。跨站跨游戏的流程归 [workflow](workflow.md)。
- 别名：螃蟹 → pxb7；盼之 → pzds；游戏别名写在 game.json 的 `aliases`。
- 实例：单次 run、商品、用户画像放在 `.harness/`（ignored），不进入共享经验。
- 超出范围：购买、付款、联系卖家；与账号筛选无关的通用浏览器经验（归 ego-ops）。

## 首批 operations

| 归属 | operation | 状态 |
| --- | --- | --- |
| pxb7 / pzds | arknights-, zzz-, wuthering-waves-, neverness-to-everness- × list/detail（16 个） | verified 2026-11-09 |
| 每个 game | refresh-evidence | partial |
| workflow | 新增游戏或站点 | documented |

状态以 operation 文件为准。

## 扩展策略

在已确认的两个主键下，Agent 可以自动新增游戏目录、站点目录和同类 operation，也可以自动补别名、修正步骤和证据。改变分类轴、拆并既有归属或扩大服务范围之前，先请用户确认。

## 证据策略与领域约束

- 状态：`documented`（整理或推断的）、`partial`（有部分运行证据）、`verified`（真实执行满足全部成功标准，填实际日期）。站点 operation 只有 verified 才能用于真实查询；历史文件没有 status 的，按 verified 处理。
- 动态页面只经 ego-ops 治理、ego-browser 执行。
- 用户预算、偏好、权重、区服、风险容忍度永远是 run_only。
- 强度/配队结论需要两位独立作者、原始发布日期在 7 天内；获取类型等客观事实以官方或 Wiki 为准。
