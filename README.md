# dsh-token-monitor

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在 **设置 → Token 用量** 页面上原生展示你的 **token 用量与对话统计**——今日 / 近 7 天 / 近 30 天总量、近 30 天**按模型**的堆叠用量图、按模型的使用排行（今天 / 7 天 / 30 天可切换）、以及会话数统计。

![Token 用量设置页](screenshot.png)

## 功能特性

- 📊 **指标卡** — 今日 / 近 7 天 / 近 30 天的 Tokens 总量（万 / 亿单位），只显示大数字，保持清爽。
- 📊 **近 30 天模型使用情况** — 30 天堆叠柱状图：每根柱子按模型分色堆叠（当天用量最高的模型在柱底，颜色按 30 天排名固定）；图表区域铺满**灰色点阵网格背景**（每列约两列点、从上到下铺满，参考 `temp/model-usage.png`），有调用的柱子叠在点阵之上；横轴只显示**每周一**的基准日期；悬浮/点击某天弹出明细卡片（日期 / 总计 / 各模型色块行，样式参考 `temp/tooltip.png`），无任何高亮/变灰/柱上标签效果。
- 🏆 **模型使用排行** — 固定 30 天窗口：前 4 名 **2×2** 卡片（排名 / 色块 / 模型名 / 供应商 / 使用 token，无增长率与单位标签），悬停轻微放大。
- 💬 **会话统计** — 今日 / 近 7 天 / 近 30 天开启的顶层对话数（不含子代理内部会话），副文字显示对应时段的模型请求次数。
- 🔄 **自动刷新** — 页面每 30 秒轮询，另有手动「刷新」与「回填历史」按钮。
- 💾 **持久化** — 数据写入 `$DSH_HOME/plugins/token-monitor/data.json`，重启不丢（按天桶保留 181 天；每个桶内按模型细分）。
- 🕘 **历史回填** — 启动时（及点击「回填历史」时）通过 `sessionQuery` 扫描会话日志，把插件安装**之前**的用量也统计进来；升级时自动丢弃旧桶并全量重扫一次，让 30 天堆叠图与模型排行立即可用。
- 🎨 **DSH 原生风格** — 亮色主题、1px 细边框卡片、8–10px 圆角、无阴影；颜色走 `--dsw-alias-*` 主题变量，跟随 DSH 深色主题。

## 安装

从本仓库安装：

```bash
dsh plugin --profile web add github:zhangzheng25/dsh-token-monitor
```

或从本地目录安装：

```bash
dsh plugin --profile web add E:\path\to\dsh-token-monitor
```

`dsh plugin` 会在 profile 目录中转发给 pnpm 安装，并自动调和 `dsh.profile.bundles`；包内 `dsh.bundle.patch`（`cordis.patch.yml`）把插件行插入宿主组合，`dsh.client.platform: "web"` 让 web 外壳加载 `client/bundle.js`。

**安装后重启 DSH**，打开 设置 → Token 用量 即可看到页面。

## 架构

```
┌────────────────────────── Host（Node.js）──────────────────────────┐
│ src/index.js                                                       │
│  • ctx.on('llm/stream', …)  ← 瀑布流：实时捕获每次模型调用的用量    │
│      （输入 / 输出 / 缓存命中 / 缓存未命中 / 推理，按天按模型分桶） │
│  • backfill()               ← sessionQuery 扫描会话日志             │
│      （assistant/message 的 usage + message.source 补安装前历史，   │
│       按模型归属；schema 升级时全量重扫一次，覆盖 181 天窗口）      │
│  • buildSessionStats()      ← 顶层对话统计（delegationDepth === 0）│
│      （20 秒缓存）                                                 │
│  • persist()                ← 防抖写入（schema v3：按天按模型分桶， │
│      保留 181 天）                                                │
│      $DSH_HOME/plugins/token-monitor/data.json                      │
│  • webServer.register('/token-monitor/snapshot') ← 供 Client 读取   │
│      （静态 bundle 模式，含 modelRank 三档聚合 + modelDaily30）       │
└─────────────────────────────────────────────────────────────────────┘
                          │ fetch('/token-monitor/snapshot')
                          ▼
┌────────────────────────── Client（浏览器）─────────────────────────┐
│ client/bundle.js — 手工构建的 web bundle，符合 client-modules 协议  │
│  （window.__ModuleLoader__.load）                                  │
│  • slots.inject('settings.section') → 设置页「Token 用量」          │
│  • 指标卡 + 会话卡 + 30 天模型堆叠图 + 模型使用排行                  │
│  • 30 秒轮询、刷新 / 回填历史按钮                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 数据来源

- **实时**：`llm/stream` 瀑布流——provider 上报的 `usage` chunk（`TokenUsage`），模型归属取自请求 options 的 `provider` / `model`，与 harness 自身会话统计同一口径。
- **历史**：会话日志中 `assistant/message` 事件的 `usage` 字段，模型归属取自同事件 `message.source`（`provider` / `model`），经 `ctx.sessionQuery` 读取（zstd 解压由 harness 内部处理，不会唤醒会话）。
- **会话数**：`sessionQuery.listSessions()` 的会话头部（`cwd` / `createdAt` / `delegationDepth`）；只有顶层会话（`delegationDepth === 0`）计入对话。

## 开发

```bash
node --check src/index.js      # Host 语法检查
node --check client/bundle.js  # Client bundle 语法检查
```

Client bundle 为手工编写以匹配 `client-modules` bundle 协议，无需构建步骤。

## 许可

[MIT](./LICENSE)
