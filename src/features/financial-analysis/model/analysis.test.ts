import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionItem } from '../../../entities/transaction/types';
import { analyzeFinancialOverview } from './analysis';

describe('analyzeFinancialOverview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('在消费样本不足时返回明确的门槛说明', () => {
    const categories: Category[] = [
      { id: 'cat-food', name: '餐饮', kind: 'expense', color: '#f97316', icon: '🍜', sortOrder: 1 },
      { id: 'cat-salary', name: '工资', kind: 'income', color: '#16a34a', icon: '💵', sortOrder: 2 }
    ];
    const accounts: Account[] = [
      { id: 'acc-cash', name: '现金', type: 'cash', initialBalance: 100, balance: 60, sortOrder: 1 },
      { id: 'acc-bank', name: '银行卡', type: 'debit', initialBalance: 1000, balance: 5200, sortOrder: 2 }
    ];
    const transactions: TransactionItem[] = [
      {
        id: 'tx-exp-1',
        date: '2026-04-21',
        type: 'expense',
        categoryId: 'cat-food',
        accountId: 'acc-cash',
        amount: 18,
        note: '早餐',
        tags: []
      },
      {
        id: 'tx-exp-2',
        date: '2026-04-20',
        type: 'expense',
        categoryId: 'cat-food',
        accountId: 'acc-cash',
        amount: 22,
        note: '午餐',
        tags: []
      },
      {
        id: 'tx-income-1',
        date: '2026-04-19',
        type: 'income',
        categoryId: 'cat-salary',
        accountId: 'acc-bank',
        amount: 4200,
        note: '工资',
        tags: []
      }
    ];

    const result = analyzeFinancialOverview({
      range: { key: '30d', label: '近 30 天', days: 30 },
      transactions,
      categories,
      accounts,
      subscriptions: [],
      debts: [],
      repaymentRecords: [],
      monthlyIncome: 8000
    });

    expect(result.behavior.habits).toHaveLength(1);
    expect(result.behavior.habits[0]?.title).toBe('行为样本不足');
    expect(result.behavior.habits[0]?.detail).toContain('至少记录 3 笔支出');
    expect(result.behavior.habits[0]?.detail).toContain('覆盖 7 天并累计 5 笔以上交易');
  });
});
