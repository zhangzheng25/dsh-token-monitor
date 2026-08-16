# dsh-token-monitor

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

> 🤖 **AI 生成声明**：本项目由 AI 辅助生成，仅供学习与技术交流使用，不构成任何形式的商业保证或支持承诺。

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在 **设置 → Token 用量** 页面上原生展示你的 **token 用量与对话统计**——今日 / 近 7 天 / 近 30 天总量、近 30 天**按模型**的堆叠用量图、按模型的使用排行（固定 30 天窗口）、以及会话数统计。

![Token 用量设置页](screenshot.png)

## 功能特性

- 📊 **指标卡** — 今日 / 近 7 天 / 近 30 天的 Tokens 总量（万 / 亿单位），只显示大数字，保持清爽。
- 📊 **近 30 天模型使用情况** — 30 天堆叠柱状图：每根柱子按模型分色堆叠（当天用量最高的模型在柱底，颜色按 30 天排名固定）；图表区域铺满**灰色点阵网格背景**（每列约两列点、从上到下铺满，参考 `temp/model-usage.png`），有调用的柱子叠在点阵之上；横轴只显示**每周一**的基准日期；悬浮/点击某天弹出明细卡片（日期 / 总计 / 各模型色块行，样式参考 `temp/tooltip.png`），无任何高亮/变灰/柱上标签效果。
- 🏆 **模型使用排行** — 固定 30 天窗口：前 4 名 **2×2** 卡片（序号一行 / 模型名 + token 总数 / 提供商 + 占比右对齐，无增长与单位标签），悬停轻微放大。
- 💬 **会话统计** — 今日 / 近 7 天 / 近 30 天开启的顶层对话数（不含子代理内部会话），副文字显示对应时段的模型请求次数。
- 🔄 **自动刷新** — 页面每 30 秒轮询（带幂等重扫，数字自动修正），另有手动「刷新」与「回填历史」按钮。
- 💾 **持久化** — 数据写入 `$DSH_HOME/plugins/token-monitor/data.json`，重启不丢（按天桶保留 181 天；每个桶内按模型细分）。
- 🕘 **历史回填** — 会话日志是唯一数据源：启动 / 点击「回填历史」/ 30 秒轮询都会把窗口内全部会话用量**幂等重扫**进新桶（原子替换），把插件安装**之前**的用量也统计进来；重复运行不会重复计数，旧桶脏数据自动自愈，30 天堆叠图与模型排行立即可用。
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
│  • backfill()               ← 会话日志为唯一数据源（幂等全量重建：   │
│      sessionQuery 为 live-preferred，内存活跃会话 + 落盘日志都算，   │
│      每次把窗口内全部 assistant/message 的 usage 折叠进新桶并原子    │
│      替换，重复运行不重复计数；启动 / 点「回填历史」/ 30 秒轮询都跑） │
│      （输入 / 输出 / 缓存命中 / 缓存未命中 / 推理，按天按模型分桶，   │
│       模型归属取 message.source，覆盖 181 天窗口）                   │
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

- **唯一数据源 = 会话日志**：会话日志中 `assistant/message` 事件的 `usage` 字段（模型归属取自同事件 `message.source` 的 `provider` / `model`），经 `ctx.sessionQuery` 读取。`sessionQuery` 是 live-preferred 的——内存中的活跃会话和落盘日志都能读到，因此进行中的调用也会被统计，无需 `llm/stream` 实时钩子（旧版本同时用瀑布流实时捕获 + 日志回填，两者重叠导致同一调用被重复计数、数字虚高，v3 已移除实时路径并改为幂等全量重建）。
- **会话数**：`sessionQuery.listSessions()` 的会话头部（`cwd` / `createdAt` / `delegationDepth`）；只有顶层会话（`delegationDepth === 0`）计入对话。

## 开发

```bash
node --check src/index.js      # Host 语法检查
node --check client/bundle.js  # Client bundle 语法检查
```

Client bundle 为手工编写以匹配 `client-modules` bundle 协议，无需构建步骤。

## 许可

[MIT](./LICENSE)
