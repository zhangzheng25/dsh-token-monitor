# dsh-token-monitor

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：在 **设置 → Token 用量** 页面上原生展示你的 **token 用量与对话统计**——今日 / 近 7 天 / 近 30 天总量、GitHub 风格的 90 天提交图、以及会话数统计。

![Token 用量设置页](screenshot.png)

## 功能特性

- 📊 **指标卡** — 今日 / 近 7 天 / 近 30 天的 Tokens 总量（万 / 亿单位），只显示大数字，保持清爽。
- 📈 **GitHub 风格提交图** — 近 90 天每日用量热力图，占满整行宽度；按当日 token 量分 5 档颜色深浅，悬停查看当天明细（总量 / 输入 / 输出 / 请求数）。
- 💬 **会话统计** — 今日 / 近 7 天 / 近 30 天开启的顶层对话数（不含子代理内部会话），副文字显示对应时段的模型请求次数。
- 🔄 **自动刷新** — 页面每 30 秒轮询，另有手动「刷新」与「回填历史」按钮。
- 💾 **持久化** — 数据写入 `$DSH_HOME/plugins/token-monitor/data.json`，重启不丢（按天桶保留 91 天）。
- 🕘 **历史回填** — 启动时（及点击「回填历史」时）通过 `sessionQuery` 扫描会话日志，把插件安装**之前**的用量也统计进来。
- 🎨 **DSH 原生风格** — 亮色主题、1px 细边框卡片、8–10px 圆角、无阴影；颜色走 `--ds-*` 主题变量，跟随 DSH 深色主题。

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
│      （输入 / 输出 / 缓存命中 / 缓存未命中 / 推理）到按天桶          │
│  • backfill()               ← sessionQuery 扫描会话日志             │
│      （assistant/message 的 usage 事件）补安装前的历史              │
│  • buildSessionStats()      ← 顶层对话统计（delegationDepth === 0）│
│      （20 秒缓存）                                                 │
│  • persist()                ← 防抖写入                              │
│      $DSH_HOME/plugins/token-monitor/data.json                      │
│  • webServer.register('/token-monitor/snapshot') ← 供 Client 读取   │
│      （静态 bundle 模式）                                          │
└─────────────────────────────────────────────────────────────────────┘
                          │ fetch('/token-monitor/snapshot')
                          ▼
┌────────────────────────── Client（浏览器）─────────────────────────┐
│ client/bundle.js — 手工构建的 web bundle，符合 client-modules 协议  │
│  （window.__ModuleLoader__.load）                                  │
│  • slots.inject('settings.section') → 设置页「Token 用量」          │
│  • 指标卡 + 提交图 + 会话卡                                        │
│  • 30 秒轮询、刷新 / 回填历史按钮                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 数据来源

- **实时**：`llm/stream` 瀑布流——provider 上报的 `usage` chunk（`TokenUsage`），与 harness 自身会话统计同一口径。
- **历史**：会话日志中 `assistant/message` 事件的 `usage` 字段，经 `ctx.sessionQuery` 读取（zstd 解压由 harness 内部处理，不会唤醒会话）。
- **会话数**：`sessionQuery.listSessions()` 的会话头部（`cwd` / `createdAt` / `delegationDepth`）；只有顶层会话（`delegationDepth === 0`）计入对话。

## 开发

```bash
node --check src/index.js      # Host 语法检查
node --check client/bundle.js  # Client bundle 语法检查
```

Client bundle 为手工编写以匹配 `client-modules` bundle 协议，无需构建步骤。

## 许可

[MIT](./LICENSE)
