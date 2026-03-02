# LedgerFlow

> AI-Native Personal Finance Frontend · 高性能、可审计、可扩展的个人财务管理前端

LedgerFlow 是一个以 **交易录入效率** 与 **财务洞察质量** 为核心的现代化记账应用。它支持本地优先数据管理、智能分类与识别、还款管理、预算治理，并提供面向真实使用场景的审计与追溯能力。

---

## ✨ 核心能力

- **交易管理（Transactions）**
  - 收入 / 支出 / 预算 / 还款统一建模
  - 多维筛选、批量编辑、批量打印 A4
  - 退款/冲正关联、状态流转、异常交易提示

- **AI 助手（Assistant）**
  - 自然语言问答与账务分析
  - 上传账单/截图识别并生成草稿交易
  - 智能场景提问（PC / 移动端差异化展示）

- **负债与还款管理（Repayment）**
  - 负债压力概览、健康度与策略模拟
  - AI 月收入估算 + 手动可信度标记
  - 一次上传账单后快速生成还款建议

- **智能预算（Smart Budget）**
  - 预算制定、执行追踪、异常提醒
  - 分类级预算卡片折叠 / 展开
  - 月度趋势与预算健康度分析

- **主题与可用性（UI/UX）**
  - 亮/暗主题 + 全局主题色（Accent）切换
  - 设计 Token 驱动，支持全局风格一致性
  - 桌面与移动端体验分别优化

---

## 🧱 技术架构

- **Framework**: React + TypeScript + Vite
- **State**: Zustand
- **Style System**: CSS Tokens + Global Modules
- **PWA**: vite-plugin-pwa
- **Build/Deploy**: Docker + Nginx（静态资源部署）

### 目录分层（简版）

- `src/app`：应用入口、路由、全局样式与设计 token
- `src/pages`：页面级业务编排
- `src/features`：可复用业务模块（assistant / budget / transactions / debt）
- `src/entities`：领域模型与类型定义
- `src/shared`：通用库、store、UI 组件

---

## 🚀 本地开发

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run lint
npm run test
npm run build
```

---

## 🐳 Docker 部署

### 直接运行

```bash
docker run -d --name ledgerflow -p 8080:80 34v0wphix/ledgerflow:latest
```

访问：`http://localhost:8080`

### Docker Compose

```bash
docker compose up -d
```

---

## 🔄 CI/CD（当前策略）

GitHub Actions 当前采用简化流程：

- 触发：`push main` / 手动触发
- 产物：仅构建并推送 Docker Hub `latest` 标签
- 镜像仓库：`34v0wphix/ledgerflow:latest`

---

## 🔐 数据与隐私

- 本项目为前端应用，默认本地优先存储
- 外部能力（AI / WebDAV / 同步）均通过用户配置接入
- 生产环境请结合最小权限策略管理凭证

---

## 📌 Roadmap（方向）

- 完整交易审计链路（导入→识别→修正→对账→导出）
- 更细粒度异常检测与阈值配置
- 主题系统一致性治理（彻底移除硬编码浅色样式）
- 更完善的自动化测试覆盖（核心业务 + 交互回归）

---

## License

CC BY-NC-SA 4.0
