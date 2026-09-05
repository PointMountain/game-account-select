# README 分区插画、项目状态与架构

## 改变

- 为 Project Status、安装、找号、单号评估、候选比较、报告、游戏支持和项目架构新增八张二次元宽幅插画，中英文共用。
- 项目头像由圆形底板构图改为满版方形，薄荷色背景覆盖四角，保留同一看板娘形象。
- 参考 AIRI 的项目状态组织方式，加入本仓库 CI、最近提交、Issues 实时徽章，以及当前能力清单、更新记录和项目动态入口。
- 新增中英文 Mermaid 架构图，展示 selector、preflight/toolkit、外部浏览器、四个游戏技能、finalizer、optimizer/evaluator 和扩展技能之间的关系；补充用户材料入口和补证返回路径。
- 图片提示词与参考来源保存到 assets/README.md、assets/readme-art-prompts.json；分区图片保持约 3:1，头像保持 1:1。

## 验证

- 已核对版本、11 个技能、四款游戏和平台表；架构与当前技能入口、架构文档及 finalizer 实现一致。
- 中英文各 28 个链接、15 处图片引用与 6 个提问示例检查通过；10 个 PNG 可读取，尺寸比例符合用途。
- 中文桌面与 390 px 窄屏、英文桌面与 390 px 深色窄屏均通过：每页 15 张图片加载、9 个 Mermaid 节点渲染、4 项能力勾选、锚点跳转和两个折叠区点击检查。
- 已逐张查看新增插画和满版头像；状态模块实图显示本仓库 CI、最近提交及 Issues，使用场景与架构分区的排版检查通过。
- 交付使用 dev:check（含完整 verify:skills）与 git diff --check；结果保存在本地 .harness/readme-illustrated/dev-check.log。

本轮变更集中在文档与视觉素材。浏览器预览、检查结果和草稿存放在本地 .harness/readme-illustrated/。
