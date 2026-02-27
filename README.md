# LedgerFlow 🧾

一个会让你**少记错账、少心碎、少“钱去哪了”**的记账前端。

当前版本：`v0.3`

---

## 这项目是干嘛的？

一句话：

> 让你用最少操作，把“消费冲动”变成“财务清醒”。

你可以把它当成一个长得顺眼、速度很快、还能接 AI 的账本小助手。

---

## 你能用它做什么

- 记账：收入、支出、标签、分类、账户都能记
- 看趋势：本月花了多少、哪里花得最狠，一眼就懂
- AI 辅助：一句话记账、截图识别账单、智能建议
- 汇率换算：旅游党/海淘党友好
- 本地优先：数据先在你手里，不先“上天”

---

## 为什么叫 LedgerFlow

因为记账这件事，最怕两件事：

1. **麻烦**（然后你就不记了）
2. **看不懂**（然后你还是白记了）

LedgerFlow 的目标很朴素：

- 录入要快
- 展示要清楚
- 分析要有点脑子
- 页面别吓人

---

## 快速开始（本地）

```bash
npm install
npm run dev
```

浏览器打开开发地址即可开始用。

---

## 当前架构说明（v0.3）

项目采用前端分层组织，核心目录与职责如下：

- `src/app`：应用启动、路由与全局样式（`App.tsx`、`router.tsx`、tokens/global CSS）。
- `src/pages`：按路由聚合页面级功能（仪表盘、交易、AI 助手、设置等）。
- `src/features`：可复用业务功能模块（连接配置、汇率、智能预算、助手工作台等）。
- `src/entities`：领域模型与类型定义（交易、账户、分类、连接信息）。
- `src/shared`：跨模块共享能力（状态管理、API 客户端、通用工具函数与 UI 组件）。
- `src/widgets`：跨页面布局组件（当前主要是 `AppLayout`）。

### 数据流与运行方式

- **状态管理**：以 Zustand 为主，页面通过 store 获取交易、偏好、调试日志等状态。
- **数据持久化**：浏览器本地存储优先（localStorage/sessionStorage），支持导入导出与备份。
- **外部能力接入**：通过 `shared/api` 与 `features/*/api` 访问同步服务、汇率与 AI 兼容接口。
- **构建与运行**：Vite + React + TypeScript；可通过 Nginx 容器部署静态产物。

> 说明：当前仓库为前端项目，后端能力通过可配置接口接入。

## Docker 一把梭

### 直接拉镜像运行

```bash
docker run -d --name ledgerflow -p 8080:80 34v0wphix/ledgerflow:latest
```

打开：`http://localhost:8080`

### 使用 compose

默认映射：`8080 -> 80`。如需改端口，可通过环境变量覆盖：`LEDGERFLOW_PORT=18080`。

```bash
docker compose up -d
```

---

## WebDAV 跨域（CORS）与同源代理

浏览器直连 WebDAV 常见报错：`Failed to fetch` / CORS 拦截。LedgerFlow 已支持“前端同源路径 + 服务端反向代理”模式。

### 前端设置

在“数据库设置 -> WebDAV 同步”中：

- 勾选 **启用同源代理（推荐）**
- 真实 WebDAV 地址：例如 `https://dav.example.com/remote.php/dav/files/user`
- 代理入口路径：例如 `/api/webdav`

### Nginx 反向代理示例

仓库内置 [`nginx.conf`](nginx.conf) 已包含 `/api/webdav/<remote-path>` 转发逻辑。
请求会携带 `X-WebDAV-Endpoint` 头作为目标 WebDAV 基地址。

> 注意：请仅在受信任网络/服务端环境中使用该转发，并确保 WebDAV 账号权限最小化。

---

## 截图识别 / AI 功能说明（简版）

如果你配置了兼容 OpenAI 的接口，就可以体验：

- 对话记账
- 票据截图识别
- 账目智能补全

没配置也能当普通记账应用正常使用。

---

## 版本 0.3 有啥变化

- 关于页面增加 GitHub 项目主页入口
- 首页版本号改为角落轻提示，减少视觉干扰
- 更新开源协议为 CC BY-NC-SA 4.0
- 继续保持：能用、好用、尽量不折腾

---

## 温馨提示（认真版）

- AI 很努力，但不是财务顾问
- 重要数据请定期备份
- 冲动消费前，建议先喝口水再点“付款”

---

## License

CC BY-NC-SA 4.0
