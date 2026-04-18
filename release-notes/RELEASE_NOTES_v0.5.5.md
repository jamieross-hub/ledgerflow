# LedgerFlow v0.5.5 Release Notes

LedgerFlow v0.5.5 聚焦 **财务分析页面首版落地、页面结构持续收口，以及计划与发版流程整理**。这一版的重点不是继续堆很多零散功能，而是把产品从“持续补功能”进一步推进到“页面职责更清楚、分析入口更明确、版本维护更规范”的状态。

## ✨ Highlights

### 1. Financial Analysis 独立页面首版
- 新增独立的“财务分析”页面骨架，承接“过去 / 现在 / 未来”三段式分析思路
- 为后续从首页分担分析内容打下结构基础，避免继续把 Dashboard 堆成超大综合页
- 页面定位为“分析与解释”中枢，而不是新的记账入口或管理页替代品

### 2. 核心页面继续拆分与结构收口
- 延续近期对大页面的拆分工作，继续收口交易页、首页与助手页的复杂职责
- 已落地的页面级样式文件与组件抽取结果继续进入主线，为后续维护降低回归风险
- 架构方向从“临时修补”转向“持续模块化”

### 3. Dashboard / 分类结构 / 趋势区体验打磨
- 持续修复分类结构区错位、横向溢出、图表悬停跳动等问题
- 收紧首页欢迎区与辅助模块占位，让首屏更聚焦主要信息
- 对首页翻译缺失、卡片留白、图表交互细节做进一步修复

### 4. WebDAV 与恢复体验补强
- 修复 WebDAV 恢复列表中备份文件时间标签异常问题
- 让备份恢复路径更可理解，减少用户在版本化恢复列表中的辨认成本

### 5. 计划目录与发版流程规范化
- 将 `plans/` 根目录收敛为单一主线计划维护方式
- 新增 `plans/当前主线计划.md`，统一维护当前未完成事项、页面规范流程与发版流程
- 重写 `plans/README.md` 与 `plans/VERSIONS.md`，让计划入口更清楚
- 清理已完成计划文件，避免计划目录继续堆积历史噪音

## 🧪 Validation
- `npm run build`
- 发布前建议补一轮关键页面手工回归：Dashboard / Transactions / Assistant / Financial Analysis
- 如涉及 Docker 发布，同步确认镜像构建与推送

## 📌 Release scope
This release includes the first Financial Analysis page foundation, continued page modularization work, dashboard and chart polish, WebDAV restore list fixes, and a full cleanup of planning/release process documentation.
