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
  addAccount: (name: string, type?: Account['type'], initialBalance?: number) => void;
  updateAccountBalance: (id: string, balance: number) => void;
  removeAccount: (id: string) => void;
}

const defaultCategories: Category[] = [
  { id: 'cat-food', name: '餐饮' },
  { id: 'cat-salary', name: '工资' },
  { id: 'cat-transport', name: '交通' }
];

const defaultAccounts: Account[] = [
  { id: 'acc-cash', name: '现金', initialBalance: 0, balance: 0 },
  { id: 'acc-card', name: '银行卡', initialBalance: 0, balance: 0 }
];

const defaultTransactions: TransactionItem[] = [];

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
        const row = { id: generateId(), name: name.trim() };
        set((s) => ({ categories: [...s.categories, row] }));
        void syncChangeIfNeeded({ entity: 'categories', action: 'insert', row });
        return row.id;
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
      }
    }),
    { name: 'ledgerflow-finance' }
  )
);
