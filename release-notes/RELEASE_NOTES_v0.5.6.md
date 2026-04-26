# LedgerFlow v0.5.6 Release Notes

LedgerFlow v0.5.6 聚焦 **把当前主线真正收口并发布**。这一版不是再开新坑，而是把已经进入主线的页面拆分、财务分析页、测试与发版文档一并补齐，让 0.5.6 成为一版能稳定交付的整理版。

## ✨ Highlights

### 1. 当前主线 P0 全部收口
- `DashboardPage` 继续沿既有 feature 组件拆分推进，趋势图、分类构成、AI 洞察与模块管理已经稳定落在页面外部组件域
- `TransactionsPage` 保持筛选、批量操作、表格、打印/PDF/分享工具分层，页面层职责进一步收敛
- `AssistantPage` 把信贷识别解析与 Markdown 渲染逻辑正式收口到 `features/assistant`，避免页面继续堆解析细节

### 2. 财务分析页面完成 P0 交付
- 独立路由 `/financial-analysis` 已形成“过去 / 现在 / 未来”三段式分析结构
- 页面可直接跳往交易页、预算页、还款管理页与 AI 助手继续处理
- 本地分析逻辑与页面测试继续补强，不依赖远端服务即可给出可解释结论

### 3. 页面域样式与测试基线继续整理
- `assistant.css` 正式接入样式入口，页面域样式收口继续从 `global.css` 迁出
- 新增信贷解析 parser 测试，补上分期日期递增的本地时区问题
- Vitest 超时基线调整到更符合当前 UI/集成测试体量的值，避免慢机环境误判超时

### 4. 0.5.6 发版资料同步完成
- 前端版本号已更新为 `0.5.6`
- 当前主线计划状态、已完成汇总、release notes、release checklist 与 GitHub Release 草稿同步更新
- 计划目录归档兼容文件与引用路径已补齐，避免历史计划链接失效

## 🧪 Validation
- `NODE_OPTIONS=--max-old-space-size=8192 npm test`
- `npm run build`

## 📌 Release scope
This release includes current-mainline page modularization completion, Financial Analysis P0 completion, assistant parsing/render extraction, smart budget onboarding polish from the same worktree, planning archive cleanup, and the final v0.5.6 release/documentation sync.
