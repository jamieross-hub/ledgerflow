# LedgerFlow

> AI-native personal finance frontend for fast bookkeeping, debt tracking, repayment management, budgeting, and audit-friendly analysis.

LedgerFlow 是一个围绕 **“记得快、看得清、能追溯、可优化”** 设计的个人财务前端应用。
它强调本地优先、可审计的数据结构，以及面向真实日常使用场景的效率：
- 快速录入交易
- 智能识别与分类
- 预算执行追踪
- 负债 / 还款闭环管理
- 面向月度复盘与异常发现的可视化分析

---

## Why LedgerFlow

很多记账工具的问题不是“不能记”，而是：
- 记一笔太慢
- 复盘信息太碎
- 负债与还款是割裂的
- 预算只是静态数字，没有执行反馈
- 导入、修正、对账、追溯之间没有闭环

LedgerFlow 想做的是更偏 **工作台（workbench）** 的个人财务前端，而不是单纯的流水列表。

---

## Core Features

### 1. Transactions
- 收入 / 支出 / 预算 / 还款统一建模
- 列表筛选、排序、批量操作
- A4 打印、复制 JSON、详情抽屉
- 退款 / 冲正关联
- 异常交易提示与重点账目识别

### 2. Assistant
- 自然语言财务问答
- 上传账单 / 截图做识别与提炼
- AI 辅助分类、场景建议与消费分析
- 支持把 AI 能力接入自定义 OpenAI-compatible 接口
- 新增 **AI 信贷管家** 模式：可面向贷款 / 花呗 / 分期 / 信用账单做独立整理
- 支持将识别出的信贷结果卡片化展示，并进一步带去还款管理页预填
- 新增 **全局记忆**：支持长期偏好落库、多轮对话提炼、embedding 召回与 rerank 选优
- 提供独立记忆页，可查看、归档、停用、置顶、删除长期记忆
- 亮 / 暗主题下提供统一的渐变层次，移动端助手页继续压缩顶部、状态条与输入区密度

### 3. Repayment Management
- 负债列表 + 还款台账预览
- 最低还款 / 期供计算
- 还款记录登记与台账回写联动
- 部分还款 / 正常还款 / 超额还款识别
- 还款方式、扣款账户、期数、宽限期管理

### 4. Smart Budget
- 预算方案生成与确认
- 分类级预算跟踪
- 超预算提醒与执行反馈
- AI 建议与预算动作记录

### 5. Dashboard
- 净资产 / 本月结余总览
- 收支趋势、分类结构、净资产曲线
- 异常提醒与亮点分析
- 未来趋势预测与重点账目展示

### 6. WebDAV Attachment Support
- 账单详情支持上传附件到 WebDAV
- 可用于保存票据、截图、合同、对账单等原始凭证
- 未完成 WebDAV 配置时会明确禁用并提示

---

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **State**: Zustand
- **Testing**: Vitest + Testing Library
- **PWA**: vite-plugin-pwa
- **Deploy**: Docker + Nginx
- **Style System**: design tokens + global CSS

---

## Project Structure

```text
src/
  app/           # app bootstrapping, router, global styles, design tokens
  entities/      # domain types (transaction/account/category)
  features/      # reusable business modules
  pages/         # page-level orchestration
  shared/        # stores, libs, ui primitives, config
```

Recommended mental model:
- `entities`: what the data is
- `features`: what the product can do
- `pages`: how screens compose features
- `shared`: reusable cross-cutting pieces

---

## Getting Started

### Requirements
- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Build production bundle

```bash
npm run build
```

### Run tests

```bash
npm run test
```

### Lint

```bash
npm run lint
```

---

## Local Usage Notes

LedgerFlow 当前是前端应用，默认偏 **本地优先**：
- 本地交易数据
- 本地预算状态
- 本地偏好设置
- 可选接入 AI / WebDAV / 同步能力

这意味着你可以：
- 纯本地使用
- 只接 AI，不接 WebDAV
- 只接 WebDAV，不接 AI
- 按需启用外部能力

---

## AI Configuration

应用支持接入 OpenAI-compatible 接口用于：
- 助手问答
- 交易识别与分类
- 预算建议
- 财务趋势分析
- 还款建议生成

通常需要配置：
- Base URL
- API Key
- Model

如果未配置 AI，基础记账、预算、交易管理等本地能力仍可使用。

---

## WebDAV Configuration

LedgerFlow 目前支持通过 WebDAV 做两类能力：
1. 备份上传 / 下载
2. 账单详情附件上传

### Current WebDAV Rules
- 仅允许合法 HTTPS 地址
- 拒绝 localhost / 内网地址
- 可走同源代理路径（例如 `/api/webdav`）
- 未配置完成时，附件上传入口会禁用或提示不可用

### Typical Use Cases
- 保存票据截图
- 归档对账单
- 关联合同或还款证明
- 保留可追溯原始附件

---

## Docker Deployment

### Docker Compose

```bash
docker compose up -d
```

默认配置见：`docker-compose.yml`

### Docker Run

```bash
docker run -d --name ledgerflow -p 8080:80 34v0wphix/ledgerflow:latest
```

访问：

```text
http://localhost:8080
```

### Build image manually

```bash
docker build -t ledgerflow:local .
```

---

## CI / Delivery

当前 GitHub Actions 主要负责：
- `push main` 时构建镜像
- 推送 Docker Hub latest 标签
- 支持手动触发 workflow

工作流文件：
- `.github/workflows/ci.yml`

---

## Current Product Focus

当前阶段优先级不是继续堆深功能，而是：
1. UI 美观度提升
2. 页面视觉统一
3. 图表 / 卡片 / 状态反馈的专业感提升
4. 文本溢出、布局拥挤、局部毛刺治理
5. 移动端 AI 助手的小屏输入、顶部和反馈链路继续收紧

也就是说，LedgerFlow 当前重点是把“能用”继续推进到“更稳、更顺眼、更像成品”。

---

## Development Principles

这个仓库当前比较明确的方向包括：
- 先保证日常使用效率
- 再补强分析与洞察
- 所有重要流程尽量可追溯
- 新增功能尽量形成闭环，而不是孤立入口
- UI 修改优先考虑统一性，而不是局部堆 patch

---

## Example Workflows

### Quick bookkeeping
1. 打开 Transactions
2. 快速新增一笔交易
3. 如有需要，进入详情抽屉进一步修正
4. 在 Dashboard 看本月趋势与重点账目

### Debt / repayment workflow
1. 在 Repayment Management 创建负债
2. 配置期数、还款方式、还款日、扣款账户
3. 登记一笔实际还款
4. 自动回写余额 / 期数 / 记录方式
5. 在最近还款记录与台账预览中复核

### AI credit workflow
1. 打开 Assistant，切换到 **AI 信贷管家**
2. 输入贷款 / 花呗 / 分期问题，或上传账单截图
3. 查看识别后的结构化信贷卡片
4. 点击 **带去还款管理**
5. 在还款管理页核对预填信息后保存

### Attachment workflow
1. 打开账单详情
2. 点击“插入附件 / 上传附件”
3. 上传到 WebDAV
4. 在交易详情中保留附件元信息和远程路径

---

## Repository Documentation

目前仓库文档重点包括：
- `README.md`：项目介绍、安装、开发、部署
- `.github/workflows/ci.yml`：CI 构建与镜像推送
- `plans/`：产品迭代与阶段任务计划
- `RELEASE_NOTES_v0.4.2.md`：版本说明

如果后续继续补全，建议优先增加：
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`
- `docs/` 目录（部署、AI 配置、WebDAV 配置、数据模型）

---

## Roadmap

- Dashboard / Smart Budget 视觉统一化
- 全站视觉规范收敛
- 响应式与窄屏观感治理
- Transactions 聚焦流水工作流
- 导入链路三段式闭环
- 语义召回可观测性第二阶段
- 服务端安全收口联动

---

## License

This repository is released under **CC BY-NC-SA 4.0**.
See:
- `LICENSE`
- `LICENSES/CC-BY-NC-SA-4.0.md`
