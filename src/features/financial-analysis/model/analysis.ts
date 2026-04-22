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

function getCategoryName(categoryId: string, categories: Category[]): string {
  return categories.find((item) => item.id === categoryId)?.name || '未分类';
}

function calculateCategoryRows(rows: TransactionItem[], categories: Category[]) {
  const expenseRows = rows.filter((item) => isExpenseLike(item) && !item.adjustmentKind);
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

function calculateAverageDailyExpense(rows: TransactionItem[], sampleDays: number): number {
  if (sampleDays <= 0) {
    return 0;
  }
  const total = rows
    .filter((item) => isExpenseLike(item) && !item.adjustmentKind)
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  return normalizeAmount(total / sampleDays);
}

function findAbnormalExpense(rows: TransactionItem[]): TransactionItem | null {
  const expenseRows = rows.filter((item) => item.type === 'expense' && !item.adjustmentKind);
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
  const currentAbnormalExpense = findAbnormalExpense(rangeTransactions);
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
      recentAverageDailyExpense: calculateAverageDailyExpense(rangeTransactions, sampleDays),
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
    }
  };
}
