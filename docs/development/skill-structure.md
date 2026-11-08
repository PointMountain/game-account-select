# Skill 结构与使用

仓库只维护一个 skill：`skills/game-account-select/`。用户找号、比价、看单个账号都从它进入。

```text
skills/game-account-select/
  SKILL.md                     入口：画像 → 覆盖 → 查询 → 初筛 → 交付 → 写回
  scripts/                     profile / preflight / query / cleanup / shortlist / parsers
  references/
    operations.json            operation 清单（query.mjs 的执行入口）
    sites/<site>/              站点共享事实 + operations/<game>-list|detail.md
    games/<game>/              看什么、常见坑、game.json、evidence、refresh-evidence
    workflow.md ops-model.md knowledge-schema.md global-agents-prompt.md
  tests/                       离线回归与 fixtures
```

入口以 100 行为上限；按条件分支的细节放 references，可执行事实放 scripts / tests。

## 新增游戏或站点

1. 游戏：建 `references/games/<game>/`（`index.md`、`game.json`、`evidence.md`、`operations/refresh-evidence.md`），在 `games/index.md` 登记。`game.json` 的名字必须对照真实列表资产名核对，未核对的写进 `name_mapping_checked.unverified`。
2. 站点 × 游戏：在 `sites/<site>/operations/` 新建 `status: documented` 的操作文件，同步 `sites/<site>/index.md` 与 `operations.json`；真实跑通后才改 `verified` 并填 `last_verified`。
3. 运行 `npm run verify:skills`；`verify-harness` 会检查 manifest ↔ 知识文件 ↔ 索引一致性。

```bash
npm run list:skills
npm run dev:context -- --files skills/game-account-select/references/games/arknights/game.json
npm run shortlist -- --profile /tmp/profile.json --listings /tmp/pxb7.json /tmp/pzds.json --markdown
```

本地 symlink 安装（`npm run link:skills`）从当前 checkout 读取；复制安装需要重新安装才能获得改动。
