# LedgerFlow 前端（记账软件）

一个现代化、可维护、模块化、可测试、可部署的纯前端记账系统示例，内置 PWA 能力，并支持数据库连接配置管理（PostgreSQL / MySQL / Redis）、左侧抽屉工作台（可折叠/可拖拽宽度）与 OpenAI 兼容记账助手。

当前版本：`v0.1`

## 1. 项目介绍（GitHub）

LedgerFlow 面向“前端先行”的财务产品原型与中小团队协作场景，提供：

- 清晰分层架构，便于多人并行开发
- 可直接部署到 Railway / Docker / 静态托管
- UI 内即可配置 OpenAI 兼容网关（无需依赖 Docker 注入）
- 连接配置与安全提示完整，便于后续衔接后端

## 2. 技术栈

- React + TypeScript + Vite
- 路由：React Router
- 状态管理：
  - Server State：TanStack Query
  - 本地状态：Zustand
- 表单：React Hook Form + Zod
- PWA：vite-plugin-pwa
- 测试：Vitest + Testing Library
- 工程化：ESLint + Prettier + lint-staged + Husky
- 部署：Docker + docker-compose + GitHub Actions

## 3. 架构设计（Feature-Sliced）

目录分层如下：

```text
src/
  app/                  # 应用入口、路由、全局样式
  pages/                # 页面级路由组件
  widgets/              # 跨页面复用布局组件
  features/             # 业务功能（连接配置、模式选择等）
  entities/             # 领域模型（transaction/category/account/connection）
  shared/               # 基础设施（api/config/lib/store/hooks/ui/types）
  test/                 # 测试初始化
```

设计原则：

1. 页面与业务逻辑分离：页面只做组合，核心逻辑沉淀在 `features` / `shared`。
2. 领域模型集中管理：类型定义统一放在 `entities`，避免跨模块重复定义。
3. 可替换的连接测试适配：通过 mode（mock/proxy）与 api client 解耦，便于后续接入真实后端。
4. 文件保持精简：避免把多个功能塞进同一文件。

## 4. 功能模块

### 仪表盘

- 本月收入 / 支出 / 结余
- 分类饼图占位
- 趋势图占位
- 左侧抽屉导航统一入口（仪表盘/账目/分类账户/记账助手/设置/帮助）

### 账目列表

- 搜索、类型筛选
- 本地分页
- CSV 导出

### 新增/编辑账目

- 字段：分类、账户、金额、日期、备注、标签

### 分类/账户管理

- 分类 CRUD（当前含新增/删除）
- 账户 CRUD（当前含新增/删除）

### 设置

- 主题切换
- 语言切换（zh-CN / en-US）
- PWA 安装提示
- 连接配置管理（PG/MySQL/Redis）
- 测试模式切换：
  - Mock 模式：纯前端模拟成功/失败/超时
  - 代理模式：前端调用 `/api/conn/*`（仅接口对接，不含后端实现）

### 记账助手

- 支持文字输入 + 图片输入（小票/账单截图）
- 支持 OpenAI 兼容渠道商配置（Base URL / API Key）
- 支持拉取模型列表（`GET /models`）
- 支持对话调用（`POST /chat/completions`）

### 关于/帮助

- 解释"前端直连数据库不安全"的原因
- 给出代理模式接口规范

### 汇率数据

- 汇率概览表：基准货币切换、货币搜索、收藏置顶、分页
- 货币换算器：双向选择、金额输入、一键交换
- 公共 API 集成（默认 [frankfurter.app](https://frankfurter.app)，免费无需 key）
- localStorage 缓存（6h TTL）+ 离线回退
- 手动刷新 + 缓存状态指示
- 可通过环境变量覆盖 API 地址与超时

### 账户预设模板

- 7 种账户类型：现金 / 借记卡 / 储蓄卡 / 信用卡 / 虚拟账户 / 负债 / 应收
- 14 个内置预设（支付宝、微信、各大银行等）
- 预设快捷添加 Picker（一键创建）
- 手动添加支持类型选择
- 账户列表展示类型标签
- 兼容旧数据（type 字段可选）

### 交易标签（占位）

- 标签管理页面已预留路由，功能开发中

## 5. 环境变量

参考 [.env.example](.env.example)：

```bash
VITE_API_BASE_URL=/api
VITE_REQUEST_TIMEOUT_MS=8000
VITE_LOG_LEVEL=info

VITE_AI_BASE_URL=https://api.openai.com/v1
VITE_AI_API_KEY=
VITE_AI_DEFAULT_MODEL=gpt-4o-mini

# 汇率 API（默认 frankfurter.app，免费无需 key）
VITE_EXCHANGE_API_BASE=https://api.frankfurter.app
VITE_EXCHANGE_API_TIMEOUT_MS=10000
```

## 6. 本地开发

> 当前执行环境缺少 Node/npm，未能在本环境直接跑通命令；代码与脚本已完整生成。

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
npm run dev
```

### 运行测试

```bash
npm run test
```

### 代码检查

```bash
npm run lint
```

### 构建产物

```bash
npm run build
```

## 7. Docker

### 构建并运行

```bash
docker compose up --build
```

默认访问：`http://localhost:8080`

说明：

- [Dockerfile](Dockerfile) 使用多阶段构建，先 `npm run build`，再由 Nginx 托管静态站点。
- [nginx.conf](nginx.conf) 使用 `try_files` 保证 SPA 刷新路由可用。

## 8. CI/CD

已提供 GitHub Actions 工作流： [.github/workflows/ci.yml](.github/workflows/ci.yml)

包含：

1. 安装依赖
2. Lint
3. Test
4. Build
5. 上传 dist 产物

后续可扩展为自动部署到静态托管平台（如 GitHub Pages / Netlify / Vercel / OSS + CDN）。

## 9. 连接配置与安全策略

连接配置支持：

- 添加、编辑、删除、启用/禁用
- 表单校验：必填、端口范围、连接池参数、连接串协议与格式
- 测试连接按钮：加载态、超时、成功/失败提示、日志展开

安全策略：

- 明确提示前端无法安全保存 DB 凭证
- 生产场景建议必须走代理模式

代理接口规范（前端已对接）：

- `POST /api/conn/test`
- `POST /api/conn/save`
- `GET /api/conn/list`
- `DELETE /api/conn/:id`

## 10. 测试覆盖

已包含至少以下测试：

1. 连接配置表单校验（[src/features/connection-config/ui/connectionFormSchema.test.ts](src/features/connection-config/ui/connectionFormSchema.test.ts)）
2. 测试连接按钮流程（[src/features/connection-config/ui/ConnectionTestButton.test.tsx](src/features/connection-config/ui/ConnectionTestButton.test.tsx)）
3. 关键页面渲染（[src/pages/dashboard/DashboardPage.test.tsx](src/pages/dashboard/DashboardPage.test.tsx)）
4. EmptyState 组件（[src/shared/ui/EmptyState.test.tsx](src/shared/ui/EmptyState.test.tsx)）
5. 交易筛选 URL 序列化（[src/features/transactions/hooks/useTransactionFilters.test.ts](src/features/transactions/hooks/useTransactionFilters.test.ts)）
6. 交易详情 Drawer（[src/features/transactions/components/TransactionDetailDrawer.test.tsx](src/features/transactions/components/TransactionDetailDrawer.test.tsx)）
7. 汇率缓存逻辑（[src/features/exchange/model/cache.test.ts](src/features/exchange/model/cache.test.ts)）
8. 货币换算器（[src/features/exchange/ui/ExchangeConverter.test.tsx](src/features/exchange/ui/ExchangeConverter.test.tsx)）
9. 账户预设 Picker（[src/features/accounts/ui/AccountPresetPicker.test.tsx](src/features/accounts/ui/AccountPresetPicker.test.tsx)）

## 11. 关键设计决策

1. 选择 Feature-Sliced 而非把逻辑散落在 pages：降低耦合，利于多人协作。
2. 连接测试分为 mock/proxy：
   - mock 适合纯前端阶段开发与演示；
   - proxy 保持未来接入后端时的接口兼容。
3. 连接配置本地持久化：使用 localStorage 快速落地，无后端也可完成完整交互链路。
4. PWA 默认离线缓存静态资源：提升首屏体验与安装能力。

## 12. 后续扩展建议

1. 接入真实后端时，把连接配置加密后存储（KMS/Secret Manager），前端只传最小必要字段。
2. 为代理接口增加鉴权、限流、审计日志、连接测试白名单。
3. 为仪表盘引入图表库并对接真实分析 API。
4. 增加 i18n 方案（如 i18next）与多主题设计 token 体系。
5. 把本地 store 逐步迁移为“离线优先 + 同步策略”（例如 IndexedDB + sync queue）。

## 13. 脚本清单

见 [package.json](package.json)：

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm run test`
- `npm run test:watch`
