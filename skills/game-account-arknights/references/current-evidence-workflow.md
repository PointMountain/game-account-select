# 当前证据与字段核验

## 查询前：将知识缺口变为取证任务

记录开始时间，默认25分钟内交付；社区调研最多8分钟，列表、详情和图片复核使用余量。时间不足时缩小已核实推荐数量，保留覆盖缺口。维修和离线回归可在当前会话交付后继续。

```bash
node skills/game-account-toolkit/scripts/plan-community-refresh.mjs --request '<本轮画像>' --evidence skills/game-account-arknights/references/community-evidence.json --knowledge skills/game-account-arknights/references/operator-value-map.json --out .harness/refresh-plan.json
```

Agent 执行清单中的任务，动态页仍经 ego-ops / ego-browser，同一查询复用一个 task space。找到来源后读取正文、字幕或清晰图表；记录作者、原始发布日期、读取日期、玩法、版本及练度条件。搜索结果卡片只用于发现。遇见知识表外干员，带着该名字定向补查；相同来源失败一次就改独立来源。

`community-evidence.json` 是可执行知识，Markdown是审阅副本。结构见 [社区更新流程](../../game-account-community-updater/references/update-workflow.md)。只有同玩法、同版本、7天内两位独立作者支持且无冲突的主张覆盖运行时数值；修改快照日期不延长来源发布日期。官方/PRTS获取名单只说明获取事实，不证明强度。旧分值可发现候选，但不能单独证明主推荐。

三个玩法分别计算并输出 `context_scores`。请求多个玩法时保留各项，综合实战维度取最低项，避免一个模式掩盖另一个模式的缺口。非主线模式使用该模式的 combat_value；主线保持 combat/story 组合。个人偏好只改变 run-only 权重。

## 查询中：按主张检查账号

价格和商品编号必须可追溯。硬条件、必须有的干员、实际用于推荐的核心精二、正向计分的专精/模组及资源必须对应本账号证据。与本轮判断无关的未知字段不阻塞；未知练度不加分。

字段证据保存 listing_id、source_url、observed_at、method、value 和 source_field/source_value（结构化提取）或原文/图片区域。结构化字段值不是逐字引文。仅卖家宣称、错账号、超过24小时、相互矛盾的证据不能满足门槛。全联动/全限定还须当前参考名单和逐名账号证据。

```bash
node skills/game-account-arknights/scripts/read-account-images.mjs --input .harness/detail.json --out .harness/images --limit 4
```

读输出 `image-evidence.json`，查看原图并确认干员名字及对应标记。将确认结果写成 `{ "reviews": [...] }`，字段只支持 `operators.<姓名>.present|elite|mastery|module`。每项带图片URL、SHA256、normalized region `[left,top,width,height]`、读取时间和所见原文。OCR坐标辅助定位，不是视觉确认；看不清就保持未知。传给 runner 的 `--field-reviews` 保留冲突，不静默覆盖平台值。

runner 保存 `<out>.checkpoint.json`；中断后相同画像及参数使用 `--resume`，成功读取15分钟内复用原观察时间，单操作最多两次尝试。时限耗尽后使用已保存事实交付。用户接管状态不能自动恢复，确认归还后开始新的查询；旧 checkpoint 保留审计。

## 交付后：执行改进

runner 自动 collect 并生成 `<out>.repair-plan.json`，负责本轮的 Agent 读取并实施；脚本本身不启动模型或后台修复。遵循 [学习闭环](../../game-account-skill-optimizer/references/learning-loop.md)，先复现，再补丁；固定原测试，新增正反例，比较同批候选后 verify/apply。资料仍不足则 deferred，不能虚报规则已经提高准确率。

真实验收保留3–5个账号的编号、价格、关键字段、三种测试画像的排序和理由。用户对事实/理由/次序的反馈单独保存于 `.harness/`；确认后才生成脱敏回归，测试画像不变为日常购买偏好。
