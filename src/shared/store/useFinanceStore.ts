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
  addCategory: (name: string) => void;
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

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: defaultTransactions,
      categories: defaultCategories,
      accounts: defaultAccounts,
      addTransaction: (payload) => {
        const id = generateId();
        const row = { ...payload, id };
        set((s) => ({ transactions: [...s.transactions, row] }));
        void syncChangeIfNeeded({ entity: 'transactions', action: 'insert', row });
        return id;
      },
      updateTransaction: (id, payload) => {
        const row = { ...payload, id };
        set((s) => ({
          transactions: s.transactions.map((item) => (item.id === id ? row : item))
        }));
        void syncChangeIfNeeded({ entity: 'transactions', action: 'update', row, id });
      },
      removeTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((item) => item.id !== id) }));
        void syncChangeIfNeeded({ entity: 'transactions', action: 'delete', id });
      },
      addCategory: (name) => {
        const row = { id: generateId(), name: name.trim() };
        set((s) => ({ categories: [...s.categories, row] }));
        void syncChangeIfNeeded({ entity: 'categories', action: 'insert', row });
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
        set((s) => ({
          accounts: [...s.accounts, row]
        }));
        void syncChangeIfNeeded({ entity: 'accounts', action: 'insert', row });
      },
      updateAccountBalance: (id, balance) => {
        let updatedRow: Account | null = null;
        set((s) => ({
          accounts: s.accounts.map((item) => {
            if (item.id !== id) {
              return item;
            }
            updatedRow = { ...item, balance };
            return updatedRow;
          })
        }));
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
