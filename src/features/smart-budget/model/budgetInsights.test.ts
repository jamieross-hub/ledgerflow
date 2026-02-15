import { describe, expect, it } from 'vitest';
import { buildBudgetTrackingRows, formatMonthKey, getRecentMonthOptions } from './budgetInsights';
import { BudgetRecommendation } from './budgetPlanner';

const recommendation: BudgetRecommendation = {
  monthlyIncome: 10000,
  monthlyFixedExpense: 3000,
  disposableIncome: 7000,
  savingsAmount: 2000,
  flexibleBudget: 5000,
  categoryBudgets: [
    { category: '固定支出', amount: 3000, ratio: 0.3 },
    { category: '储蓄/投资', amount: 2000, ratio: 0.2 },
    { category: '餐饮', amount: 2000, ratio: 0.2 },
    { category: '交通', amount: 1200, ratio: 0.12 },
    { category: '娱乐社交', amount: 1800, ratio: 0.18 }
  ]
};

describe('budgetInsights', () => {
  it('returns recent month options sorted by desc', () => {
    const options = getRecentMonthOptions(
      [
        {
          id: '1',
          type: 'expense',
          categoryId: 'food',
          accountId: 'cash',
          amount: 100,
          date: '2025-01-02',
          note: '',
          tags: []
        }
      ],
      3,
      new Date('2025-02-15')
    );

    expect(options.map((item) => item.key)).toEqual(['2025-02', '2025-01', '2024-12']);
  });

  it('builds tracking rows and marks overspent categories', () => {
    const monthKey = formatMonthKey(new Date('2025-02-08'));
    const rows = buildBudgetTrackingRows({
      recommendation,
      categories: [
        { id: 'food', name: '餐饮' },
        { id: 'traffic', name: '交通' },
        { id: 'fun', name: '娱乐社交' }
      ],
      transactions: [
        {
          id: '1',
          type: 'expense',
          categoryId: 'food',
          accountId: 'cash',
          amount: 2100,
          date: '2025-02-01',
          note: '',
          tags: []
        },
        {
          id: '2',
          type: 'expense',
          categoryId: 'traffic',
          accountId: 'cash',
          amount: 300,
          date: '2025-02-03',
          note: '',
          tags: []
        }
      ],
      monthKey
    });

    expect(rows[0]).toMatchObject({
      category: '餐饮',
      budgetAmount: 2000,
      spentAmount: 2100,
      isOverspent: true
    });
    expect(rows.find((item) => item.category === '娱乐社交')).toMatchObject({
      spentAmount: 0,
      isOverspent: false
    });
  });
});
