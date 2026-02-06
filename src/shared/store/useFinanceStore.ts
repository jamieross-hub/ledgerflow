import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import { TransactionItem } from '../../entities/transaction/types';
import { generateId } from '../lib/id';

interface FinanceState {
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  addTransaction: (payload: Omit<TransactionItem, 'id'>) => void;
  updateTransaction: (id: string, payload: Omit<TransactionItem, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (id: string) => void;
  addAccount: (name: string) => void;
  removeAccount: (id: string) => void;
}

const defaultCategories: Category[] = [
  { id: 'cat-food', name: '餐饮' },
  { id: 'cat-salary', name: '工资' },
  { id: 'cat-transport', name: '交通' }
];

const defaultAccounts: Account[] = [
  { id: 'acc-cash', name: '现金' },
  { id: 'acc-card', name: '银行卡' }
];

const defaultTransactions: TransactionItem[] = [];

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: defaultTransactions,
      categories: defaultCategories,
      accounts: defaultAccounts,
      addTransaction: (payload) =>
        set((s) => ({ transactions: [...s.transactions, { ...payload, id: generateId() }] })),
      updateTransaction: (id, payload) =>
        set((s) => ({
          transactions: s.transactions.map((item) => (item.id === id ? { ...payload, id } : item))
        })),
      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((item) => item.id !== id) })),
      addCategory: (name) =>
        set((s) => ({ categories: [...s.categories, { id: generateId(), name: name.trim() }] })),
      removeCategory: (id) =>
        set((s) => ({ categories: s.categories.filter((item) => item.id !== id) })),
      addAccount: (name) =>
        set((s) => ({ accounts: [...s.accounts, { id: generateId(), name: name.trim() }] })),
      removeAccount: (id) =>
        set((s) => ({ accounts: s.accounts.filter((item) => item.id !== id) }))
    }),
    { name: 'ledgerflow-finance' }
  )
);
