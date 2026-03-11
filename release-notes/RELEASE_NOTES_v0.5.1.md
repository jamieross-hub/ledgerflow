# LedgerFlow v0.5.1 Release Notes

LedgerFlow v0.5.1 聚焦 **交易可见性、远程数据库配置能力与账单分享体验**，把此前偏“能用”的流水与设置能力，推进到更接近日常长期使用的产品状态：看得更清楚、追踪更方便、连接外部存储更明确、分享也更自然。

## ✨ Highlights

### 1. Transaction visibility upgrades
- 交易列表支持直接显示附件标志，进入详情前就能识别是否有原始凭证
- 交易详情支持显示最后修改时间，增强补录、修正、AI 变更后的可追溯性
- 列表、详情与时间线信息更统一，减少“点进去才知道”的信息断层

### 2. Remote MySQL connection setup
- 新增远程 MySQL 连接配置入口
- 支持录入 host、port、username、password、database 等连接字段
- 提供基础连接测试与更明确的错误反馈
- 对“本地模式 / 远程数据库模式”的边界进行了梳理，为后续更完整的数据接入打基础

### 3. Bill sharing first release
- 新增账单分享入口：
  - 交易详情页可直接分享
  - 列表右键菜单可分享
  - 移动端滑动操作可分享
- 提供三类分享模板：
  - 完整
  - 脱敏
  - 摘要
- 支持复制分享文案，并可控制是否包含账户、备注、附件提示等信息

### 4. Dashboard and mobile polish
- 修复 dashboard 结构溢出问题
- 对移动端 dashboard 卡片间距、图表高度和模块布局进行了收紧
- 缓解移动端页面中大块空白区域问题，提升小屏可读性与信息密度

### 5. Delivery and deployment improvements
- 优化 Dockerfile：
  - `npm install` 改为 `npm ci`
  - 利用 package-lock 与构建缓存提升构建速度
  - 跳过 Docker 构建中不必要的 husky 安装
- Docker 多架构镜像已发布：
  - `34v0wphix/ledgerflow:latest`
  - `34v0wphix/ledgerflow:v0.5.1`
- README 补充在线测试 Demo：
  - https://ledgerflow.up.railway.app

## 🧪 Validation
- `npm run build` passed
- Transaction detail / table related tests passed
- Docker multi-arch image build and push verified

## 📌 Release scope
This release includes attachment visibility, updated timestamps, remote MySQL config entry, the first bill sharing workflow, mobile dashboard whitespace fixes, and Docker delivery optimizations.
