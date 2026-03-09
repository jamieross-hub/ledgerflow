# LedgerFlow v0.5.0 Release Notes

LedgerFlow v0.5.0 聚焦 **AI 信贷管理增强**，把此前“能识别信贷账单”的能力，推进到更像真正可用的信贷管理助手：不仅能识别，还能解释、确认、联动还款管理，并给出更可信的优先级分析。

## ✨ Highlights

### 1. Unified credit metrics and repayment cost modeling
- 统一年化利率 / APR / 月利率表达
- 增加总利息、预计月供、剩余利息成本、剩余总成本等关键测算字段
- 对贷款场景支持根据总还款 / 总期数反推利率与成本

### 2. Stronger AI credit assistant
- 强化贷款 / 花呗 / 分期 / 信用账单识别提示词
- 强化分析提示词，回答更聚焦“优先还什么、为什么、下一步怎么做”
- 默认回答更短，更适合多轮补充而不是一次性输出长文

### 3. Save confirmation and conflict resolution
- 新增“保存前确认态”
- 对关键字段集中校验：产品名、当前应还、剩余待还、还款日、每期金额、APR / 年化等
- 当识别结果与已有负债接近时，支持差异对比与冲突分流
- 支持更新已有负债，而不是只能重复新建

### 4. Repayment context integration
- AI 信贷助手接入还款计划、扣款账户、实际还款流水检索
- 明确区分计划中的应还与实际已还
- 增加“计划 vs 实际”差异解释与缺口提示
- 增加高频汇总问答入口：总欠款、本月总应还、已还多少、还差多少等

### 5. Debt management workflow upgrades
- 负债列表支持编辑已保存条目
- 支持更多管理动作：新增 / 编辑 / 删除 / 标记状态等
- 增加提前还款策略模拟、风险标签与解释
- 新增负债生命周期状态：进行中 / 已结清 / 已关闭 / 暂缓处理
- 已结清和暂缓项目会在总览与优先级中自动降权，避免长期使用后台账混乱

## 🧪 Validation
- `tsc --noEmit` passed
- Assistant / Repayment related tests passed

## 📌 Release scope
This release is tagged at commit `1ddfd57` and intentionally excludes the later v0.5.1 attachment-visibility work.
