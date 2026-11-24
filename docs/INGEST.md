# 批量迁移接口 · INGEST

给「使用者的 Agent」用：把某个项目的全部信息按下面这份 JSON 丢进来，
项目Git 负责**标准化、去重、落盘**，然后自动长成提交图。

## 三种调用方式

| 方式 | 用法 | 适用 |
|---|---|---|
| **命令行** | `node tools/ingest.js batch.json [--dry-run]` | Agent 有文件系统权限 |
| **标准输入** | `cat batch.json \| node tools/ingest.js -` | Agent 直接管道 |
| **应用内 IPC** | `window.api.ingest({ batch, dryRun })` | Agent 驱动应用时 |

`--dry-run` 只返回统计，不写盘，建议 Agent **先 dry-run 再正式导入**。

## JSON 结构

```json
{
  "project": { "id": "p_demo", "name": "示例 · 课程设计" },
  "nodes": [
    {
      "key": "a",                       // 批内引用用，可省略
      "type": "方案",                    // 方案/决策/复盘/资料/数据/代码/产出（也接受英文）
      "title": "先做单机版验证想法",
      "summary": "一句话摘要",
      "date": "2026-03-02",             // 也接受 2026/3/2、2026年3月2日
      "status": "有效",                  // 有效/已放弃/已取代/草稿
      "branch": "main",                 // 非 main 即为分支（feat/xxx）
      "parents": ["a"],                 // 父节点：key 或 id
      "tag": "v1.0",                    // 可选：里程碑
      "source": {
        "file": "冲突用例.md",
        "locator": { "kind": "text", "start": 0, "end": 20 },
        "excerpt": "原文片段"
      },
      "extra": { "理由": "为什么这么定" }
    }
  ],
  "edges": [{ "from": "d", "to": "b", "kind": "attach" }]
}
```

### 字段规则

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 没有 title 的条目会被跳过并给警告 |
| `type` | 否 | 中文或英文都行；默认 `doc` |
| `date` | 否 | 缺失用当天 |
| `status` | 否 | 缺失 `active`；**“已放弃”会画成带 × 的终止分支** |
| `branch` | 否 | 默认 `main`（主线）；`feat/lan` 这类会自动分叉 |
| `parents` | 否 | 不写就没有上游，图上会从行首开始 |
| `source` | 否 | 有 `source` 才能“点开原文”；没有的话详情显示“无原文” |

### 标准化做了什么

1. **类型归一**：`决策/决定/decision` → `decision`
2. **状态归一**：`已放弃/放弃/废弃` → `abandoned`
3. **日期归一**：`2026/3/2`、`2026年3月2日` → `2026-03-02`
4. **引用归一**：`parents` 支持批内 `key`、真实 `id`、或标题
5. **去重**：同项目 + 同标题 + 同日期 → 跳过（`skipped`）
6. **自动补边**：每个 `parent` 自动生成一条 `derived` 边
7. **落盘前备份**：写 `data/state.before-ingest.json`

## 返回

```json
{
  "project": { "id": "p_demo", "name": "示例 · 课程设计" },
  "warnings": [],
  "created": 5, "updated": 0, "skipped": 0, "edges": 4,
  "dryRun": false
}
```

## 给 Agent 的建议流程

```
1. 读项目材料 → 抽成 nodes（决定、方案、复盘、走错的路）
2. 用 parents 串出先后关系；走不通的标 status=已放弃 + branch=feat/xxx
3. dry-run，看 warnings
4. 没有硬伤 → 正式导入
5. 打开应用，切到该项目，图就出来了
```

## 注意事项

- **id 稳定**：给了 `id` 就用你的；没给则按 `项目_标题` 生成，重复导入不会重复建条目；
- **不要编造 source**：没有原文就别写 `source`，否则点开是空文件；
- **分支名有意义**：`feat/hid`、`feat/pcb` 这样的名字会显示在图上，方便人读。
