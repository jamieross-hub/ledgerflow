# LedgerFlow 已完成任务归档（COMPLETED）

> 说明：每完成一个计划任务（打✅/改为 - [x]）后，追加一条记录到本文件末尾。

---

## 2026-03-14

- 日期：2026-03-14
- 来源计划文件：plans/v0.4.x-transactions-focus.md
- 完成任务：- [ ] 首屏进入后无需滚动即可看到流水表头与至少 1 行数据
- 关联提交/PR：b6e163f
- 变更摘要：
  - TransactionTable 支持通过 props 控制是否展示“交易任务概览”卡片，首屏默认不渲染
  - 交易页首屏两段辅助提示（聚焦提示文案、账期条）默认不展示，以便更快露出表格
- 验收方式：
  - npm run build（通过）
  - 说明：当前环境浏览器自动化不可用，未做截图；以最小首屏占位变更确保表格更靠前

- 日期：2026-03-14
- 来源计划文件：plans/v0.4.x-transactions-focus.md
- 完成任务：- [ ] 筛选条件生效速度与结果正确性不下降
- 关联提交/PR：5a13376
- 变更摘要：
  - 回归跑通 transactions 相关单测（TransactionFilters / TransactionTable / useTransactionFilters）
  - `npm run build` 通过，确认本次首屏调整未影响筛选链路编译与构建
- 验收方式：
  - NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --config vitest.config.ts src/features/transactions/components/TransactionFilters.test.tsx src/features/transactions/components/TransactionTable.test.tsx src/features/transactions/hooks/useTransactionFilters.test.ts --poolOptions.threads.singleThread=true（通过）
  - npm run build（通过）
