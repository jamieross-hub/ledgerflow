import type { SubscriptionItem } from '../../../entities/subscription/types';
import type { Category } from '../../../entities/category/types';
import type { Account } from '../../../entities/account/types';
import type { TransactionItem } from '../../../entities/transaction/types';
import type { DebtItem, RepaymentRecord } from '../../debt/model/debtMetrics';
import {
  calculateDebtHealthScore,
  calculateDebtSummary
} from '../../debt/model/debtMetrics';
import { summarizeTransactions } from '../../../shared/lib/transactionMetrics';

export type FinancialAnalysisRangeKey = 'month' | '30d' | '90d';

export type FinancialAnalysisRangeOption = {
  key: FinancialAnalysisRangeKey;
  label: string;
  days: number | null;
};

export type FinancialAnalysisMetric = {
  label: string;
  value: number;
  tone?: 'income' | 'expense' | 'neutral';
  help?: string;
};

export type FinancialAnalysisAction = {
  label: string;
  to: string;
};

export type FinancialAnalysisHabitInsight = {
  title: string;
  detail: string;
  tone?: 'default' | 'warning' | 'success';
};

export type FinancialAnalysisAvoidableSpendingSignal = {
  title: string;
  detail: string;
  amount: number;
  count: number;
  tone?: 'default' | 'warning';
};

export type FinancialAnalysisConsumerProfile = {
  archetype: string;
  summary: string;
  traits: string[];
  disclaimer: string;
};

export type FinancialAnalysisResult = {
  range: FinancialAnalysisRangeOption;
  sampleDays: number;
  transactionCount: number;
  hasEnoughData: boolean;
  summaryLine: string;
  confidenceNote: string;
  metrics: FinancialAnalysisMetric[];
  trendDeltaPct: number | null;
  previous: {
    topCategoryName: string;
    topCategoryAmount: number;
    topCategoryShare: number;
    categoryRows: Array<{
      name: string;
      amount: number;
      share: number;
    }>;
    recentAverageDailyExpense: number;
    abnormalExpense: TransactionItem | null;
    insight: string;
    actions: FinancialAnalysisAction[];
  };
  present: {
    fixedExpenseAmount: number;
    fixedExpenseRatio: number;
    subscriptionMonthlyCost: number;
    debtPressureRatio: number;
    debtHealthScore: number;
    disposableIncome: number;
    insight: string;
    actions: FinancialAnalysisAction[];
  };
  future: {
    projectedMonthlyBalance: number;
    suggestedBuffer: number;
    dueSoonSubscriptionCount: number;
    dueSoonRepaymentCount: number;
    insight: string;
    actions: FinancialAnalysisAction[];
  };
  behavior: {
    habits: FinancialAnalysisHabitInsight[];
    avoidableSignals: FinancialAnalysisAvoidableSpendingSignal[];
    consumerProfile: FinancialAnalysisConsumerProfile;
  };
};

const DAY = 24 * 60 * 60 * 1000;

export const FINANCIAL_ANALYSIS_RANGE_OPTIONS: FinancialAnalysisRangeOption[] = [
  { key: 'month', label: '本月', days: null },
  { key: '30d', label: '近30天', days: 30 },
  { key: '90d', label: '近90天', days: 90 }
];

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

function normalizeAmount(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 1000) / 10;
}

function getRangeStart(range: FinancialAnalysisRangeOption): Date {
  if (range.key === 'month') {
    return startOfMonth();
  }
  const today = startOfToday();
  return addDays(today, -((range.days || 1) - 1));
}

function getPreviousRange(range: FinancialAnalysisRangeOption): { start: Date; end: Date } {
  const start = getRangeStart(range);
  if (range.key === 'month') {
    const previousMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return {
      start: previousMonth,
      end: new Date(start.getTime() - DAY)
    };
  }
  const days = range.days || 30;
  return {
    start: addDays(start, -days),
    end: addDays(start, -1)
  };
}

function isInRange(dateText: string, start: Date, end?: Date): boolean {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startValue = start.getTime();
  const endValue = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : Number.POSITIVE_INFINITY;
  return value >= startValue && value <= endValue;
}

function isExpenseLike(tx: TransactionItem): boolean {
  return tx.type === 'expense' || tx.type === 'budget' || tx.type === 'repayment';
}

function isAnalysisExpenseLike(tx: TransactionItem, categories: Category[]): boolean {
  if (tx.adjustmentKind) {
    return false;
  }

  if (isExpenseLike(tx)) {
    return true;
  }

  return categories.find((item) => item.id === tx.categoryId)?.kind === 'expense';
}

function getCategoryName(categoryId: string, categories: Category[]): string {
  return categories.find((item) => item.id === categoryId)?.name || '未分类';
}

function calculateCategoryRows(rows: TransactionItem[], categories: Category[]) {
  const expenseRows = rows.filter((item) => isAnalysisExpenseLike(item, categories));
  const total = expenseRows.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const grouped = expenseRows.reduce<Record<string, number>>((acc, item) => {
    const key = getCategoryName(item.categoryId, categories);
    acc[key] = (acc[key] || 0) + Math.max(0, Number(item.amount) || 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, amount]) => ({
      name,
      amount: normalizeAmount(amount),
      share: total > 0 ? amount / total : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function calculateAverageDailyExpense(rows: TransactionItem[], sampleDays: number, categories: Category[]): number {
  if (sampleDays <= 0) {
    return 0;
  }
  const total = rows
    .filter((item) => isAnalysisExpenseLike(item, categories))
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  return normalizeAmount(total / sampleDays);
}

function findAbnormalExpense(rows: TransactionItem[], categories: Category[]): TransactionItem | null {
  const expenseRows = rows.filter((item) => isAnalysisExpenseLike(item, categories));
  if (expenseRows.length < 3) {
    return null;
  }
  const average =
    expenseRows.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0) /
    expenseRows.length;
  return (
    expenseRows
      .filter((item) => Number(item.amount) >= average * 1.8)
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null
  );
}

function calculateMonthlySubscriptionCost(subscriptions: SubscriptionItem[]): number {
  return normalizeAmount(
    subscriptions
      .filter((item) => item.status !== 'expired')
      .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0)
  );
}

function calculateDueSoonSubscriptions(subscriptions: SubscriptionItem[]): number {
  const today = startOfToday();
  const deadline = addDays(today, 14);
  return subscriptions.filter((item) => {
    const target = item.renewalDate || item.expireDate;
    return Boolean(target) && isInRange(String(target), today, deadline);
  }).length;
}

function calculateDueSoonRepayments(debts: DebtItem[]): number {
  const today = new Date();
  const todayDay = today.getDate();
  return debts.filter((item) => {
    if (item.status && item.status !== 'active') {
      return false;
    }
    const repaymentDay = Number(item.repaymentDay || item.billDay || 0);
    return repaymentDay > 0 && repaymentDay >= todayDay && repaymentDay - todayDay <= 10;
  }).length;
}

function calculateProjectedMonthlyBalance(rows: TransactionItem[], range: FinancialAnalysisRangeOption): number {
  const summary = summarizeTransactions(rows);
  if (range.key === 'month') {
    const today = new Date();
    const elapsedDays = Math.max(1, today.getDate());
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return normalizeAmount((summary.netTotal / elapsedDays) * daysInMonth);
  }
  const days = range.days || 30;
  return normalizeAmount((summary.netTotal / days) * 30);
}

function calculateSuggestedBuffer(monthlyExpense: number, debtMinimumPayment: number): number {
  return normalizeAmount(monthlyExpense * 0.1 + debtMinimumPayment * 0.5);
}

function calcTrendDelta(current: number, previous: number): number | null {
  if (previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function buildSummaryLine(net: number, fixedRatio: number, debtPressureRatio: number): string {
  const netText = net >= 0 ? '当前仍有结余' : '当前已出现净流出';
  const fixedText = fixedRatio >= 0.45 ? '固定支出占比偏高' : '固定支出仍在可控范围';
  const debtText = debtPressureRatio >= 0.3 ? '近期还款压力需要重点关注' : '近期债务压力相对可控';
  return `${netText}，${fixedText}，${debtText}。`;
}

function buildConfidenceNote(transactionCount: number, sampleDays: number): string {
  if (transactionCount === 0) {
    return '当前没有可用于分析的交易数据，请先记录几笔流水。';
  }
  if (sampleDays < 7 || transactionCount < 5) {
    return '当前样本较少，以下结论仅适合作为轻量参考。';
  }
  if (transactionCount < 15) {
    return '当前样本量中等，结论可用于趋势判断，但仍建议持续记录。';
  }
  return '当前分析基于本地已记录账目，趋势判断相对稳定。';
}

function isPotentiallyAvoidableCategory(name: string): boolean {
  return /(餐饮|外卖|咖啡|奶茶|饮品|零食|娱乐|购物|打车|出行|游戏|会员|订阅)/i.test(name);
}

function isPotentiallyAvoidableNote(note: string): boolean {
  return /(外卖|奶茶|咖啡|饮料|零食|宵夜|下午茶|电影|游戏|网购|打车|会员|续费)/i.test(note);
}

function buildHabitInsights(rows: TransactionItem[], categories: Category[]): FinancialAnalysisHabitInsight[] {
  const expenseRows = rows.filter((item) => isAnalysisExpenseLike(item, categories));
  if (expenseRows.length === 0) {
    return [
      {
        title: '行为样本不足',
        detail: '当前分析周期内真实消费记录较少，先连续补齐几笔支出后再判断习惯。',
        tone: 'warning'
      }
    ];
  }

  const insights: FinancialAnalysisHabitInsight[] = [];
  const totalExpense = expenseRows.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const categoryRows = calculateCategoryRows(expenseRows, categories);
  const topCategory = categoryRows[0];
  if (topCategory && topCategory.share >= 0.35) {
    insights.push({
      title: `${topCategory.name}支出较集中`,
      detail: `${topCategory.name}占当前支出约 ${toPercent(topCategory.share)}%，说明你的消费重心比较稳定，也意味着这一类最值得优先优化。`,
      tone: topCategory.share >= 0.5 ? 'warning' : 'default'
    });
  }

  const smallExpenseRows = expenseRows.filter((item) => Number(item.amount) > 0 && Number(item.amount) <= 50);
  const smallExpenseAmount = smallExpenseRows.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  if (smallExpenseRows.length >= 3 && smallExpenseAmount / Math.max(totalExpense, 1) >= 0.18) {
    insights.push({
      title: '高频小额支出偏多',
      detail: `当前周期内有 ${smallExpenseRows.length} 笔 50 元以内消费，累计 ${normalizeAmount(smallExpenseAmount).toFixed(2)} 元，这类“顺手花掉”的支出容易侵蚀结余。`,
      tone: 'warning'
    });
  }

  const weekendRows = expenseRows.filter((item) => {
    const day = new Date(item.date).getDay();
    return day === 0 || day === 6;
  });
  const weekendAmount = weekendRows.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const weekendShare = weekendAmount / Math.max(totalExpense, 1);
  if (weekendRows.length >= 2 && weekendShare >= 0.3) {
    insights.push({
      title: '周末消费更活跃',
      detail: `周末支出占比约 ${toPercent(weekendShare)}%，你的消费更容易在休息日放大，适合提前设一个周末上限。`,
      tone: weekendShare >= 0.45 ? 'warning' : 'default'
    });
  }

  const repeatedMap = expenseRows.reduce<Record<string, { count: number; amount: number }>>((acc, item) => {
    const categoryName = getCategoryName(item.categoryId, categories);
    const key = `${categoryName}::${(item.note || '').trim() || '未备注'}`;
    acc[key] = acc[key] || { count: 0, amount: 0 };
    acc[key].count += 1;
    acc[key].amount += Math.max(0, Number(item.amount) || 0);
    return acc;
  }, {});
  const repeatedEntry = Object.entries(repeatedMap)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount)[0];
  if (repeatedEntry && repeatedEntry.count >= 3) {
    const [categoryName, note] = repeatedEntry.key.split('::');
    insights.push({
      title: '存在明显的重复消费场景',
      detail: `${categoryName}下“${note}”出现了 ${repeatedEntry.count} 次，说明你的消费不是随机波动，而是有固定触发场景。`,
      tone: 'default'
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: '消费节奏整体分散',
      detail: '当前没有出现特别强的单一习惯，说明你的消费更像多场景混合驱动，后续可继续观察 2~4 周确认。',
      tone: 'success'
    });
  }

  return insights.slice(0, 3);
}

function buildAvoidableSignals(
  rows: TransactionItem[],
  categories: Category[]
): FinancialAnalysisAvoidableSpendingSignal[] {
  const expenseRows = rows.filter((item) => isAnalysisExpenseLike(item, categories));
  const grouped = expenseRows.reduce<Record<string, { title: string; amount: number; count: number }>>((acc, item) => {
    const categoryName = getCategoryName(item.categoryId, categories);
    const note = item.note || '未备注';
    const matched = isPotentiallyAvoidableCategory(categoryName) || isPotentiallyAvoidableNote(note);
    if (!matched) {
      return acc;
    }
    const key = categoryName;
    acc[key] = acc[key] || {
      title: `${categoryName}里可能有可压缩支出`,
      amount: 0,
      count: 0
    };
    acc[key].amount += Math.max(0, Number(item.amount) || 0);
    acc[key].count += 1;
    return acc;
  }, {});

  const signals: FinancialAnalysisAvoidableSpendingSignal[] = Object.values(grouped)
    .map((item) => ({
      ...item,
      amount: normalizeAmount(item.amount),
      detail:
        item.count >= 3
          ? `当前周期共 ${item.count} 笔，累计 ${normalizeAmount(item.amount).toFixed(2)} 元，建议先区分“必要场景”与“即时满足型消费”。`
          : `当前周期累计 ${normalizeAmount(item.amount).toFixed(2)} 元，建议回看是否存在更便宜替代方案或可合并购买。`,
      tone: (item.amount >= 200 || item.count >= 4 ? 'warning' : 'default') as
        | 'default'
        | 'warning'
    }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .slice(0, 3);

  if (signals.length > 0) {
    return signals;
  }

  const highestSingle = [...expenseRows]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .find((item) => Number(item.amount) > 0);
  if (!highestSingle) {
    return [];
  }

  return [
    {
      title: '当前未识别出明显非必要消费簇',
      detail: `最大单笔支出是“${highestSingle.note || '未备注'}”，金额 ${normalizeAmount(Number(highestSingle.amount) || 0).toFixed(2)} 元。当前更像结构性支出，而不是高频可砍项。`,
      amount: normalizeAmount(Number(highestSingle.amount) || 0),
      count: 1,
      tone: 'default'
    }
  ];
}

function buildConsumerProfile(
  rows: TransactionItem[],
  categories: Category[],
  fixedExpenseRatio: number,
  savingsRate: number
): FinancialAnalysisConsumerProfile {
  const expenseRows = rows.filter((item) => isAnalysisExpenseLike(item, categories));
  const categoryRows = calculateCategoryRows(expenseRows, categories);
  const topCategory = categoryRows[0];
  const avoidableAmount = buildAvoidableSignals(rows, categories).reduce((sum, item) => sum + item.amount, 0);

  if (fixedExpenseRatio >= 0.35 && savingsRate >= 0.1) {
    return {
      archetype: '规划型消费者',
      summary: '你的支出更像先安排结构，再处理弹性消费，整体带有先保底后花钱的倾向。',
      traits: ['重视确定性', '愿意先覆盖固定成本', '消费决策偏稳健'],
      disclaimer: '该画像只基于当前账本行为特征推测，不等同于真实人格结论。'
    };
  }

  if (topCategory && /(餐饮|居住|日用|买菜)/.test(topCategory.name)) {
    return {
      archetype: '舒适优先型消费者',
      summary: `你更愿意把钱花在“让生活顺一点”的场景上，当前最明显的是${topCategory.name}。`,
      traits: ['看重日常体验', '对生活便利度敏感', '容易为熟悉场景持续付费'],
      disclaimer: '该画像只基于当前账本行为特征推测，不等同于真实人格结论。'
    };
  }

  if (avoidableAmount >= 300) {
    return {
      archetype: '即时反馈型消费者',
      summary: '你的部分消费更容易被当下体验、便利和情绪奖励驱动，做预算时需要重点防止“顺手就买”。',
      traits: ['重视即时满足', '容易被便利性触发', '适合设置小额上限'],
      disclaimer: '该画像只基于当前账本行为特征推测，不等同于真实人格结论。'
    };
  }

  return {
    archetype: '平衡观察型消费者',
    summary: '当前消费没有出现极端偏向，说明你的支出同时受必要开销与临时决策共同影响。',
    traits: ['消费场景较分散', '可塑性较高', '适合继续观察趋势后再定策略'],
    disclaimer: '该画像只基于当前账本行为特征推测，不等同于真实人格结论。'
  };
}

export function analyzeFinancialOverview(input: {
  range: FinancialAnalysisRangeOption;
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  subscriptions: SubscriptionItem[];
  debts: DebtItem[];
  repaymentRecords: RepaymentRecord[];
  monthlyIncome: number;
}): FinancialAnalysisResult {
  const start = getRangeStart(input.range);
  const today = startOfToday();
  const previousRange = getPreviousRange(input.range);

  const rangeTransactions = input.transactions.filter((item) => isInRange(item.date, start, today));
  const previousTransactions = input.transactions.filter((item) =>
    isInRange(item.date, previousRange.start, previousRange.end)
  );

  const summary = summarizeTransactions(rangeTransactions);
  const previousSummary = summarizeTransactions(previousTransactions);
  const sampleDays =
    input.range.key === 'month'
      ? Math.max(1, new Date().getDate())
      : Math.max(1, input.range.days || 30);
  const currentCategoryRows = calculateCategoryRows(rangeTransactions, input.categories);
  const currentTopCategory = currentCategoryRows[0] || { name: '未分类', amount: 0, share: 0 };
  const currentAbnormalExpense = findAbnormalExpense(rangeTransactions, input.categories);
  const subscriptionMonthlyCost = calculateMonthlySubscriptionCost(input.subscriptions);
  const debtSummary = calculateDebtSummary(input.debts, input.monthlyIncome);
  const debtHealthScore = calculateDebtHealthScore(debtSummary, input.monthlyIncome);
  const fixedExpenseAmount = normalizeAmount(subscriptionMonthlyCost + debtSummary.totalMinimumPayment);
  const fixedExpenseRatio = summary.expenseTotal > 0 ? fixedExpenseAmount / summary.expenseTotal : 0;
  const disposableIncome = normalizeAmount(summary.netTotal - fixedExpenseAmount);
  const projectedMonthlyBalance = calculateProjectedMonthlyBalance(rangeTransactions, input.range);
  const suggestedBuffer = calculateSuggestedBuffer(summary.expenseTotal, debtSummary.totalMinimumPayment);
  const trendDeltaPct = calcTrendDelta(summary.expenseTotal, previousSummary.expenseTotal);
  const dueSoonSubscriptionCount = calculateDueSoonSubscriptions(input.subscriptions);
  const dueSoonRepaymentCount = calculateDueSoonRepayments(input.debts);
  const activeAccounts = input.accounts.filter((item) => Number(item.balance ?? item.initialBalance ?? 0) > 0).length;
  const repaymentRecordsInRange = input.repaymentRecords.filter((item) => isInRange(item.paidAt, start, today));
  const savingsRate = summary.incomeTotal > 0 ? summary.netTotal / summary.incomeTotal : 0;
  const hasEnoughData = rangeTransactions.length >= 3;
  const habits = buildHabitInsights(rangeTransactions, input.categories);
  const avoidableSignals = buildAvoidableSignals(rangeTransactions, input.categories);
  const consumerProfile = buildConsumerProfile(
    rangeTransactions,
    input.categories,
    fixedExpenseRatio,
    savingsRate
  );

  return {
    range: input.range,
    sampleDays,
    transactionCount: rangeTransactions.length,
    hasEnoughData,
    summaryLine: buildSummaryLine(summary.netTotal, fixedExpenseRatio, debtSummary.pressureRatio),
    confidenceNote: buildConfidenceNote(rangeTransactions.length, sampleDays),
    metrics: [
      {
        label: '收入',
        value: normalizeAmount(summary.incomeTotal),
        tone: 'income'
      },
      {
        label: '支出',
        value: normalizeAmount(summary.expenseTotal),
        tone: 'expense'
      },
      {
        label: '净结余',
        value: normalizeAmount(summary.netTotal),
        tone: summary.netTotal >= 0 ? 'income' : 'expense'
      },
      {
        label: '储蓄率',
        value: toPercent(savingsRate),
        tone: 'neutral',
        help: '百分比'
      }
    ],
    trendDeltaPct,
    previous: {
      topCategoryName: currentTopCategory.name,
      topCategoryAmount: currentTopCategory.amount,
      topCategoryShare: currentTopCategory.share,
      categoryRows: currentCategoryRows,
      recentAverageDailyExpense: calculateAverageDailyExpense(rangeTransactions, sampleDays, input.categories),
      abnormalExpense: currentAbnormalExpense,
      insight:
        currentTopCategory.amount > 0
          ? `${currentTopCategory.name}是当前分析周期支出最高的分类，占比约 ${toPercent(currentTopCategory.share)}%。${
              currentAbnormalExpense
                ? `另外发现一笔偏大的支出：${currentAbnormalExpense.note || '未备注'}。`
                : '当前分析周期未发现特别突兀的单笔异常。'
            }`
          : '当前分析周期还没有足够的支出分类样本，先补齐几笔消费后再看复盘结果。',
      actions: [
        { label: '查看异常流水', to: '/transactions' },
        { label: '回到首页对比趋势', to: '/' }
      ]
    },
    present: {
      fixedExpenseAmount,
      fixedExpenseRatio,
      subscriptionMonthlyCost,
      debtPressureRatio: debtSummary.pressureRatio,
      debtHealthScore,
      disposableIncome,
      insight:
        summary.expenseTotal > 0
          ? `固定成本约占当前支出的 ${toPercent(fixedExpenseRatio)}%，当前活跃资产账户 ${activeAccounts} 个，本阶段已记录还款 ${repaymentRecordsInRange.length} 笔。`
          : '当前支出样本较少，暂时更适合先建立连续记账基线。',
      actions: [
        { label: '去制定预算', to: '/smart-budget' },
        { label: '检查订阅项', to: '/subscriptions' }
      ]
    },
    future: {
      projectedMonthlyBalance,
      suggestedBuffer,
      dueSoonSubscriptionCount,
      dueSoonRepaymentCount,
      insight:
        projectedMonthlyBalance >= 0
          ? `如果延续当前节奏，预计下个自然月仍有机会保持正结余，建议至少预留 ${suggestedBuffer.toFixed(2)} 元缓冲。`
          : `如果延续当前节奏，下个自然月可能继续承压，建议优先给近期固定扣款和还款预留 ${suggestedBuffer.toFixed(2)} 元缓冲。`,
      actions: [
        { label: '查看还款管理', to: '/repayment-management' },
        { label: '管理固定成本', to: '/subscriptions' }
      ]
    },
    behavior: {
      habits,
      avoidableSignals,
      consumerProfile
    }
  };
}
