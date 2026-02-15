import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import { TransactionItem } from '../../entities/transaction/types';
import { syncChangeIfNeeded } from '../lib/dataSync';
import { generateId } from '../lib/id';

interface FinanceState {
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  addTransaction: (payload: Omit<TransactionItem, 'id'>) => string;
  updateTransaction: (id: string, payload: Omit<TransactionItem, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addCategory: (name: string) => string;
  removeCategory: (id: string) => void;
  addAccount: (name: string, type?: Account['type'], initialBalance?: number) => string;
  updateAccountBalance: (id: string, balance: number) => void;
  removeAccount: (id: string) => void;
  clearAllAccountBills: () => void;
  replaceAllData: (payload: {
    transactions: TransactionItem[];
    categories: Category[];
    accounts: Account[];
  }) => void;
}

const defaultCategories: Category[] = [
  // 生活大类（衣食住行）
  { id: 'cat-food', name: '餐饮' },
  { id: 'cat-clothing', name: '衣物穿搭' },
  { id: 'cat-housing', name: '住房' },
  { id: 'cat-utilities', name: '水电燃气' },
  { id: 'cat-transport', name: '交通' },

  // 高频日常
  { id: 'cat-shopping', name: '购物日用' },
  { id: 'cat-communication', name: '通讯网络' },
  { id: 'cat-health', name: '医疗健康' },
  { id: 'cat-education', name: '教育学习' },
  { id: 'cat-entertainment', name: '娱乐社交' },
  { id: 'cat-travel', name: '旅行' },
  { id: 'cat-gift', name: '人情往来' },

  // 金融/收入
  { id: 'cat-salary', name: '工资' },
  { id: 'cat-bonus', name: '奖金' },
  { id: 'cat-invest-income', name: '理财收益' },
  { id: 'cat-refund', name: '退款返现' },
  { id: 'cat-insurance', name: '保险' },
  { id: 'cat-tax', name: '税费' },
  { id: 'cat-loan', name: '还款' },

  // 兜底
  { id: 'cat-other', name: '其他' }
];

const defaultAccounts: Account[] = [
  { id: 'acc-cash', name: '现金', initialBalance: 0, balance: 0 },
  { id: 'acc-card', name: '银行卡', initialBalance: 0, balance: 0 }
];

const defaultTransactions: TransactionItem[] = [];

function normalizeCategoryName(raw: string): string {
  return String(raw || '')
    .replace(/[\u00A0\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryNameKey(raw: string): string {
  return normalizeCategoryName(raw).toLocaleLowerCase('zh-CN');
}

function sanitizeCategoriesAndTransactions(
  categories: Category[],
  transactions: TransactionItem[]
): {
  categories: Category[];
  transactions: TransactionItem[];
} {
  const mergedCategories: Category[] = [];
  const canonicalByKey = new Map<string, Category>();
  const categoryIdAlias = new Map<string, string>();

  categories.forEach((item) => {
    const normalizedName = normalizeCategoryName(item.name);
    if (!normalizedName) {
      return;
    }
    const key = categoryNameKey(normalizedName);
    const found = canonicalByKey.get(key);
    if (found) {
      categoryIdAlias.set(item.id, found.id);
      return;
    }
    const normalizedRow = { ...item, name: normalizedName };
    canonicalByKey.set(key, normalizedRow);
    mergedCategories.push(normalizedRow);
  });

  const fallbackCategoryId = mergedCategories[0]?.id;
  const nextTransactions = transactions.map((tx) => {
    const remappedCategoryId = categoryIdAlias.get(tx.categoryId);
    if (remappedCategoryId) {
      return { ...tx, categoryId: remappedCategoryId };
    }
    if (tx.categoryId && mergedCategories.some((category) => category.id === tx.categoryId)) {
      return tx;
    }
    if (fallbackCategoryId) {
      return { ...tx, categoryId: fallbackCategoryId };
    }
    return tx;
  });

  return {
    categories: mergedCategories,
    transactions: nextTransactions
  };
}

function computeAccountBalances(accounts: Account[], transactions: TransactionItem[]): Account[] {
  return accounts.map((account) => {
    const base = Number(account.initialBalance ?? 0);
    const safeBase = Number.isFinite(base) ? base : 0;
    const delta = transactions.reduce((sum, item) => {
      if (item.accountId !== account.id) {
        return sum;
      }
      const amount = Number(item.amount);
      if (!Number.isFinite(amount)) {
        return sum;
      }
      return item.type === 'income' ? sum + amount : sum - amount;
    }, 0);

    return {
      ...account,
      balance: safeBase + delta
    };
  });
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: defaultTransactions,
      categories: defaultCategories,
      accounts: defaultAccounts,
      addTransaction: (payload) => {
        const id = generateId();
        const row = { ...payload, id };
        set((s) => {
          const transactions = [...s.transactions, row];
          return {
            transactions,
            accounts: computeAccountBalances(s.accounts, transactions)
          };
        });
        void syncChangeIfNeeded({ entity: 'transactions', action: 'insert', row });
        return id;
      },
      updateTransaction: (id, payload) => {
        const row = { ...payload, id };
        set((s) => {
          const transactions = s.transactions.map((item) => (item.id === id ? row : item));
          return {
            transactions,
            accounts: computeAccountBalances(s.accounts, transactions)
          };
        });
        void syncChangeIfNeeded({ entity: 'transactions', action: 'update', row, id });
      },
      removeTransaction: (id) => {
        set((s) => {
          const transactions = s.transactions.filter((item) => item.id !== id);
          return {
            transactions,
            accounts: computeAccountBalances(s.accounts, transactions)
          };
        });
        void syncChangeIfNeeded({ entity: 'transactions', action: 'delete', id });
      },
      addCategory: (name) => {
        const normalizedName = normalizeCategoryName(name);
        if (!normalizedName) {
          return defaultCategories[0]?.id || 'cat-unknown';
        }

        let insertedRow: Category | null = null;
        let resolvedId = defaultCategories[0]?.id || 'cat-unknown';

        set((s) => {
          const key = categoryNameKey(normalizedName);
          const existing = s.categories.find((item) => categoryNameKey(item.name) === key);
          if (existing) {
            resolvedId = existing.id;
            return s;
          }

          insertedRow = { id: generateId(), name: normalizedName };
          resolvedId = insertedRow.id;
          const compacted = sanitizeCategoriesAndTransactions(
            [...s.categories, insertedRow],
            s.transactions
          );
          return {
            categories: compacted.categories,
            transactions: compacted.transactions
          };
        });

        if (insertedRow) {
          void syncChangeIfNeeded({ entity: 'categories', action: 'insert', row: insertedRow });
        }

        return resolvedId;
      },
      removeCategory: (id) => {
        set((s) => ({ categories: s.categories.filter((item) => item.id !== id) }));
        void syncChangeIfNeeded({ entity: 'categories', action: 'delete', id });
      },
      addAccount: (name, type, initialBalance = 0) => {
        const row = {
          id: generateId(),
          name: name.trim(),
          type,
          initialBalance,
          balance: initialBalance
        };
        set((s) => {
          const accounts = computeAccountBalances([...s.accounts, row], s.transactions);
          return { accounts };
        });
        void syncChangeIfNeeded({ entity: 'accounts', action: 'insert', row });
        return row.id;
      },
      updateAccountBalance: (id, balance) => {
        let updatedRow: Account | null = null;
        set((s) => {
          const transactions = s.transactions;
          const accounts = s.accounts.map((item) => {
            if (item.id !== id) {
              return item;
            }

            const txDelta = transactions.reduce((sum, tx) => {
              if (tx.accountId !== id) {
                return sum;
              }
              const amount = Number(tx.amount);
              if (!Number.isFinite(amount)) {
                return sum;
              }
              return tx.type === 'income' ? sum + amount : sum - amount;
            }, 0);

            const nextInitial = balance - txDelta;
            updatedRow = {
              ...item,
              initialBalance: nextInitial,
              balance
            };
            return updatedRow;
          });

          return {
            accounts: computeAccountBalances(accounts, transactions)
          };
        });
        if (updatedRow) {
          void syncChangeIfNeeded({ entity: 'accounts', action: 'update', row: updatedRow, id });
        }
      },
      removeAccount: (id) => {
        set((s) => ({ accounts: s.accounts.filter((item) => item.id !== id) }));
        void syncChangeIfNeeded({ entity: 'accounts', action: 'delete', id });
      },
      clearAllAccountBills: () => {
        set((s) => ({
          transactions: [],
          accounts: computeAccountBalances(s.accounts, [])
        }));
      },
      replaceAllData: (payload) => {
        const incomingCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const incomingTransactions = Array.isArray(payload.transactions)
          ? payload.transactions
          : [];
        const incomingAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        const compacted = sanitizeCategoriesAndTransactions(
          incomingCategories,
          incomingTransactions
        );
        set(() => ({
          categories: compacted.categories,
          transactions: compacted.transactions,
          accounts: computeAccountBalances(incomingAccounts, compacted.transactions)
        }));
      }
    }),
    {
      name: 'ledgerflow-finance',
      version: 2,
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<FinanceState>) || {};
        const categories = Array.isArray(incoming.categories)
          ? incoming.categories
          : currentState.categories;
        const transactions = Array.isArray(incoming.transactions)
          ? incoming.transactions
          : currentState.transactions;
        const compacted = sanitizeCategoriesAndTransactions(categories, transactions);

        return {
          ...currentState,
          ...incoming,
          categories: compacted.categories,
          transactions: compacted.transactions,
          accounts: computeAccountBalances(
            Array.isArray(incoming.accounts) ? incoming.accounts : currentState.accounts,
            compacted.transactions
          )
        };
      }
    }
  )
);
