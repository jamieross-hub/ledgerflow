# LedgerFlow 前端（记账软件）

一个现代化、可维护、模块化、可测试、可部署的纯前端记账系统示例，内置 PWA 能力，并支持数据库连接配置管理（PostgreSQL / MySQL / Redis）、左侧抽屉工作台（可折叠/可拖拽宽度）与 OpenAI 兼容记账助手。

当前版本：`v0.1`

## 1. 项目介绍（GitHub）

LedgerFlow 面向“前端先行”的财务产品原型与中小团队协作场景，提供：

- 清晰分层架构，便于多人并行开发
- 可直接部署到 Railway / Docker / 静态托管
- UI 内即可配置 OpenAI 兼容网关（无需依赖 Docker 注入）
- 连接配置与安全提示完整，便于后续衔接后端

### 应用场景

- 个人日常记账：快速记录消费/收入，按分类、账户、标签进行复盘。
- 多来源账单整理：支持手工录入、CSV 导入、AI 对话识别混合记账。
- 小团队产品原型：用于前端先行验证交互、数据结构、同步策略。
- 教学与练习：适合学习 React + TypeScript + Feature-Sliced 的真实业务落地。

### 做这个软件的初衷

这个项目的核心初衷是：在“复杂业务 + 可持续迭代”之间找到平衡。很多记账 Demo 只覆盖基础 CRUD，但在真实使用中，用户更关心“录得快、查得准、能回溯、可扩展”。LedgerFlow 希望通过统一的数据模型（交易/分类/账户/标签/来源）、可测试的模块设计、以及 AI 辅助录入能力，打造一个可以长期演进的前端账本基座。

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
- AI 返回前会先获取中国互联网授时，降低“今天/昨天/本月”时间歧义
- 自动补全分类与标签（模型识别 + 本地兜底），保存后可直接在交易与标签页检索

### 关于/帮助

- 解释"前端直连数据库不安全"的原因
- 给出代理模式接口规范

### 汇率数据

- 汇率概览表：基准货币切换、货币搜索、收藏置顶、分页
- 货币换算器：双向选择、金额输入、一键交换
- 基础科学计算：支持 `+ - × ÷`、括号、`x²`、`√x`、`1/x`、`±`
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

### 交易标签

- 按标签自动聚合交易
- 标签面板可查看最近关联交易与金额
- 支持跳转到交易页并定位到具体交易详情

## 5. 最近更新（2026-02）

- 交易表格增强为 Excel 风格：列排序 + 快捷筛选 + 分页联动。
- 支持批量选择与批量删除，并保留单条详情/编辑操作。
- 交易来源模型化（手工 / 微信 / 支付宝 / AI），支持来源筛选与详情展示。
- 汇率页改为“计算器优先 + 汇率表折叠”，并补充移动端适配。
- 汇率计算器增加基础科学计算能力与错误提示。
- 标签页从占位升级为可用页面：标签聚合、交易联动、快速定位。
- 记账助手增强：
  - 文本 + 图片联合识别账单
  - 自动补全分类与标签并持久化
  - 回答前请求中国互联网时间 API，避免模型时间误导

## 6. 环境变量

参考 [.env.example](.env.example)：

```bash
# 优先直连远程后端域名；不填时默认走本地 /api 代理
# 示例：https://api.your-domain.com
VITE_API_BASE_URL=/api
VITE_REQUEST_TIMEOUT_MS=8000
VITE_LOG_LEVEL=info

# 同步接口路径（会拼接到 VITE_API_BASE_URL 后）
VITE_SYNC_LOCAL_DATA_PATH=/sync-local-data
VITE_SYNC_CHANGE_PATH=/sync-change

VITE_AI_BASE_URL=https://api.openai.com/v1
VITE_AI_API_KEY=
VITE_AI_DEFAULT_MODEL=gpt-4o-mini

# 汇率 API（默认 frankfurter.app，免费无需 key）
VITE_EXCHANGE_API_BASE=https://api.frankfurter.app
VITE_EXCHANGE_API_TIMEOUT_MS=10000
```

## 7. 本地开发

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

## 8. Docker

### 构建并运行

```bash
docker compose up --build
```

默认访问：`http://localhost:8080`

说明：

- [Dockerfile](Dockerfile) 使用多阶段构建，先 `npm run build`，再由 Nginx 托管静态站点。
- [nginx.conf](nginx.conf) 使用 `try_files` 保证 SPA 刷新路由可用。

## 9. CI/CD

已提供 GitHub Actions 工作流： [.github/workflows/ci.yml](.github/workflows/ci.yml)

包含：

1. 安装依赖
2. Lint
3. Test
4. Build
5. 上传 dist 产物

后续可扩展为自动部署到静态托管平台（如 GitHub Pages / Netlify / Vercel / OSS + CDN）。

## 10. 连接配置与安全策略

连接配置支持：

- 添加、编辑、删除、启用/禁用
- 表单校验：必填、端口范围、连接池参数、连接串协议与格式
- 测试连接按钮：加载态、超时、成功/失败提示、日志展开

### PostgreSQL（IP 访问）可直接填写参数

在 [`ConnectionConfigForm.tsx`](src/features/connection-config/ui/ConnectionConfigForm.tsx) 里可直接按下列值填写：

- 类型：`PostgreSQL`
- Host：`<你的 PG 服务器 IP>`（示例：`10.20.30.40`）
- Port：`5432`
- 数据库名：`ledgerflow`
- 用户名：`ledgerflow_app`
- 密码：`<数据库密码>`
- TLS/SSL：
  - 内网自建 PG：通常先关闭（`tls.enabled=false`）
  - 云厂商 PG（RDS/Cloud SQL 等）：建议开启（`tls.enabled=true`）
- 校验证书（`rejectUnauthorized`）：
  - 有 CA 证书时：`true` 并填写 `CA 证书`
  - 暂无 CA 证书测试阶段：`false`
- 超时：`8000 ~ 15000 ms`

连接串示例（可直接粘贴到“连接串”输入框）：

```text
postgres://ledgerflow_app:YourPassword@10.20.30.40:5432/ledgerflow
```

启用 SSL 的连接串示例：

```text
postgres://ledgerflow_app:YourPassword@10.20.30.40:5432/ledgerflow?sslmode=require
```

安全策略：

- 明确提示前端无法安全保存 DB 凭证
- 前端采用兼容模式：优先直连后端 HTTP API，未配置远端时回退本地 `/api` 代理

代理接口规范（前端已对接）：

- `POST /conn/test`
- `POST /conn/save`
- `GET /conn/list`
- `DELETE /conn/:id`
- `POST /sync-local-data`：将本地交易/账户/分类批量同步到 PostgreSQL
- `POST /sync-change`：数据库已配置后，前端每次新增/编辑/删除触发增量写入

前端兼容策略（用于降低 HTTP 405/404 概率）：

- 手动同步会按候选路径重试：`/sync-local-data` → `/conn/sync-local-data` → `/sync/local-data`
- 增量同步会按候选路径重试：`/sync-change` → `/conn/sync-change` → `/sync/change`
- 每个候选路径会尝试 `POST`，若返回 405 再回退尝试 `PUT`
- 若全部返回 404/405，会提示“同步接口不可用（HTTP 404/405）”，需检查后端路由或通过环境变量覆盖路径

同步接口建议契约：

1) `POST /api/sync-local-data`

```json
{
  "source": "manual",
  "strategy": "upsert",
  "data": {
    "transactions": [],
    "accounts": [],
    "categories": []
  }
}
```

返回：

```json
{
  "ok": true,
  "message": "同步完成",
  "synced": 42,
  "detail": "upsert 完成"
}
```

2) `POST /api/sync-change`

```json
{
  "entity": "transactions",
  "action": "insert",
  "row": {},
  "id": "optional-id",
  "happenedAt": "2026-02-07T08:00:00.000Z"
}
```

返回：

```json
{
  "ok": true,
  "message": "增量同步完成",
  "detail": "optional"
}
```

## 11. 测试覆盖

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

## 12. 关键设计决策

1. 选择 Feature-Sliced 而非把逻辑散落在 pages：降低耦合，利于多人协作。
2. 连接测试分为 mock/proxy：
   - mock 适合纯前端阶段开发与演示；
   - proxy 保持未来接入后端时的接口兼容。
3. 连接配置本地持久化：使用 localStorage 快速落地，无后端也可完成完整交互链路。
4. PWA 默认离线缓存静态资源：提升首屏体验与安装能力。

## 13. 后续扩展建议

1. 接入真实后端时，把连接配置加密后存储（KMS/Secret Manager），前端只传最小必要字段。
2. 为代理接口增加鉴权、限流、审计日志、连接测试白名单。
3. 为仪表盘引入图表库并对接真实分析 API。
4. 增加 i18n 方案（如 i18next）与多主题设计 token 体系。
5. 把本地 store 逐步迁移为“离线优先 + 同步策略”（例如 IndexedDB + sync queue）。

## 14. 脚本清单

见 [package.json](package.json)：

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm run test`
- `npm run test:watch`
