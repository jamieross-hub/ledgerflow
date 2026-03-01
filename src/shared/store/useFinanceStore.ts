import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import {
  TransactionAdjustmentKind,
  TransactionItem,
  TransactionType
} from '../../entities/transaction/types';
import { syncChangeIfNeeded } from '../lib/dataSync';
import { generateId } from '../lib/id';
import { getSignedAmount } from '../lib/transactionMetrics';

interface CategoryLearningRule {
  id: string;
  token: string;
  type: TransactionType;
  categoryId: string;
  hitCount: number;
  createdAt: string;
  lastAppliedAt: string;
}

interface CategoryLearningEvent {
  id: string;
  createdAt: string;
  type: TransactionType;
  fromCategoryId: string;
  toCategoryId: string;
  tokens: string[];
  ruleIds: string[];
}

interface CategoryLearningInput {
  type: TransactionType;
  note: string;
  merchantOrderNo?: string;
  orderNo?: string;
}

interface FinanceState {
  hasHydrated: boolean;
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  categoryLearningRules: CategoryLearningRule[];
  categoryLearningEvents: CategoryLearningEvent[];
  addTransaction: (payload: Omit<TransactionItem, 'id'>) => string;
  updateTransaction: (id: string, payload: Omit<TransactionItem, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addCategory: (
    name: string,
    options?: { kind?: Category['kind']; color?: string; icon?: string }
  ) => string;
  updateCategory: (id: string, payload: Partial<Omit<Category, 'id'>>) => void;
  reorderCategories: (orderedIds: string[]) => void;
  removeCategory: (id: string) => void;
  addAccount: (name: string, type?: Account['type'], initialBalance?: number) => string;
  updateAccountBalance: (id: string, balance: number) => void;
  removeAccount: (id: string) => void;
  clearAllAccountBills: () => void;
  suggestCategoryByLearning: (input: CategoryLearningInput) => {
    categoryId: string;
    confidence: number;
    token: string;
  } | null;
  recordCategoryCorrection: (
    input: CategoryLearningInput & { fromCategoryId: string; toCategoryId: string }
  ) => void;
  undoLatestCategoryLearning: () => boolean;
  replaceAllData: (payload: {
    transactions: TransactionItem[];
    categories: Category[];
    accounts: Account[];
  }) => void;
}

const defaultCategories: Category[] = [
  // 生活大类（衣食住行）
  { id: 'cat-food', name: '餐饮', kind: 'expense', icon: '🍜', color: '#f97316', sortOrder: 1 },
  {
    id: 'cat-clothing',
    name: '衣物穿搭',
    kind: 'expense',
    icon: '👕',
    color: '#ec4899',
    sortOrder: 2
  },
  { id: 'cat-housing', name: '住房', kind: 'expense', icon: '🏠', color: '#8b5cf6', sortOrder: 3 },
  {
    id: 'cat-utilities',
    name: '水电燃气',
    kind: 'expense',
    icon: '💡',
    color: '#22c55e',
    sortOrder: 4
  },
  {
    id: 'cat-transport',
    name: '交通',
    kind: 'expense',
    icon: '🚇',
    color: '#06b6d4',
    sortOrder: 5
  },

  // 高频日常
  {
    id: 'cat-shopping',
    name: '购物日用',
    kind: 'expense',
    icon: '🛍️',
    color: '#ef4444',
    sortOrder: 6
  },
  {
    id: 'cat-communication',
    name: '通讯网络',
    kind: 'expense',
    icon: '📶',
    color: '#0ea5e9',
    sortOrder: 7
  },
  {
    id: 'cat-health',
    name: '医疗健康',
    kind: 'expense',
    icon: '🩺',
    color: '#14b8a6',
    sortOrder: 8
  },
  {
    id: 'cat-education',
    name: '教育学习',
    kind: 'expense',
    icon: '📚',
    color: '#6366f1',
    sortOrder: 9
  },
  {
    id: 'cat-entertainment',
    name: '娱乐社交',
    kind: 'expense',
    icon: '🎮',
    color: '#a855f7',
    sortOrder: 10
  },
  { id: 'cat-travel', name: '旅行', kind: 'expense', icon: '🧳', color: '#f59e0b', sortOrder: 11 },
  {
    id: 'cat-gift',
    name: '人情往来',
    kind: 'expense',
    icon: '🎁',
    color: '#e11d48',
    sortOrder: 12
  },

  // 金融/收入
  { id: 'cat-salary', name: '工资', kind: 'income', icon: '💰', color: '#16a34a', sortOrder: 13 },
  { id: 'cat-bonus', name: '奖金', kind: 'income', icon: '🎉', color: '#22c55e', sortOrder: 14 },
  {
    id: 'cat-invest-income',
    name: '理财收益',
    kind: 'income',
    icon: '📈',
    color: '#15803d',
    sortOrder: 15
  },
  {
    id: 'cat-refund',
    name: '退款返现',
    kind: 'income',
    icon: '💸',
    color: '#10b981',
    sortOrder: 16
  },
  {
    id: 'cat-insurance',
    name: '保险',
    kind: 'expense',
    icon: '🛡️',
    color: '#0284c7',
    sortOrder: 17
  },
  { id: 'cat-tax', name: '税费', kind: 'expense', icon: '🧾', color: '#7c3aed', sortOrder: 18 },
  { id: 'cat-loan', name: '还款', kind: 'expense', icon: '🏦', color: '#475569', sortOrder: 19 },

  // 兜底
  { id: 'cat-other', name: '其他', kind: 'expense', icon: '📦', color: '#6b7280', sortOrder: 20 }
];

const defaultAccounts: Account[] = [
  { id: 'acc-cash', name: '现金', initialBalance: 0, balance: 0 },
  { id: 'acc-card', name: '银行卡', initialBalance: 0, balance: 0 }
];

const defaultTransactions: TransactionItem[] = [];
const defaultCategoryLearningRules: CategoryLearningRule[] = [];
const defaultCategoryLearningEvents: CategoryLearningEvent[] = [];

const REFUND_HINT_PATTERN = /(退款|退回|退货|冲正)/i;

function normalizeCategoryName(raw: string): string {
  return String(raw || '')
    .replace(/[\u00A0\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAdjustmentKind(
  tx: TransactionItem,
  categoryName: string
): TransactionAdjustmentKind {
  if (
    tx.adjustmentKind === 'normal' ||
    tx.adjustmentKind === 'refund' ||
    tx.adjustmentKind === 'reversal'
  ) {
    return tx.adjustmentKind;
  }

  const note = String(tx.note || '');
  if (
    tx.status === 'refunded' ||
    REFUND_HINT_PATTERN.test(categoryName) ||
    REFUND_HINT_PATTERN.test(note)
  ) {
    return 'refund';
  }

  return 'normal';
}

function normalizeTransactionSemantic(
  tx: TransactionItem,
  categoryName: string,
  fallbackCategoryId?: string
): TransactionItem {
  const nextCategoryId = tx.categoryId || fallbackCategoryId || tx.categoryId;
  const adjustmentKind = normalizeAdjustmentKind(tx, categoryName);
  const nextType =
    adjustmentKind === 'normal' ? tx.type : tx.type === 'income' ? 'expense' : tx.type;

  return {
    ...tx,
    type: nextType,
    categoryId: nextCategoryId,
    adjustmentKind
  };
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
  const categoryNameById = new Map(mergedCategories.map((item) => [item.id, item.name]));
  const nextTransactions = transactions.map((tx) => {
    const remappedCategoryId = categoryIdAlias.get(tx.categoryId);
    const resolvedCategoryId =
      remappedCategoryId ||
      (tx.categoryId && mergedCategories.some((category) => category.id === tx.categoryId)
        ? tx.categoryId
        : fallbackCategoryId || tx.categoryId);

    const categoryName = categoryNameById.get(resolvedCategoryId) || '';

    return normalizeTransactionSemantic(
      { ...tx, categoryId: resolvedCategoryId },
      categoryName,
      fallbackCategoryId
    );
  });

  return {
    categories: mergedCategories,
    transactions: nextTransactions
  };
}

function normalizeLearningText(raw: string): string {
  return String(raw || '')
    .trim()
    .toLocaleLowerCase('zh-CN');
}

function buildLearningTokens(input: CategoryLearningInput): string[] {
  const tokens: string[] = [];
  const merchant = normalizeLearningText(input.merchantOrderNo || '');
  const order = normalizeLearningText(input.orderNo || '');
  const note = normalizeLearningText(input.note || '');

  if (merchant) tokens.push(`merchant:${merchant}`);
  if (order) tokens.push(`order:${order}`);

  if (note) {
    const words = note
      .split(/[\s,，。!！?？;；:：()（）【】{}"'“”‘’/\\|+-]+|\[|\]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
      .slice(0, 6);
    words.forEach((word) => tokens.push(`kw:${word}`));
  }

  return Array.from(new Set(tokens)).slice(0, 8);
}

function getTokenWeight(token: string): number {
  if (token.startsWith('merchant:')) return 5;
  if (token.startsWith('order:')) return 4;
  return 2;
}

function computeAccountBalances(accounts: Account[], transactions: TransactionItem[]): Account[] {
  return accounts.map((account) => {
    const base = Number(account.initialBalance ?? 0);
    const safeBase = Number.isFinite(base) ? base : 0;
    const delta = transactions.reduce((sum, item) => {
      if (item.accountId !== account.id) {
        return sum;
      }
      return sum + getSignedAmount(item);
    }, 0);

    return {
      ...account,
      balance: safeBase + delta
    };
  });
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      transactions: defaultTransactions,
      categories: defaultCategories,
      accounts: defaultAccounts,
      categoryLearningRules: defaultCategoryLearningRules,
      categoryLearningEvents: defaultCategoryLearningEvents,
      addTransaction: (payload) => {
        const id = generateId();
        const row = {
          ...payload,
          adjustmentKind: payload.adjustmentKind || 'normal',
          id
        };
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
        const row = {
          ...payload,
          adjustmentKind: payload.adjustmentKind || 'normal',
          id
        };
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
      addCategory: (name, options) => {
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

          insertedRow = {
            id: generateId(),
            name: normalizedName,
            kind: options?.kind,
            color: options?.color,
            icon: options?.icon,
            sortOrder: s.categories.length + 1
          };
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
      updateCategory: (id, payload) => {
        let updatedRow: Category | null = null;
        set((s) => {
          const categories = s.categories.map((item) => {
            if (item.id !== id) {
              return item;
            }
            updatedRow = { ...item, ...payload };
            return updatedRow;
          });
          return { categories };
        });
        if (updatedRow) {
          void syncChangeIfNeeded({ entity: 'categories', action: 'update', row: updatedRow, id });
        }
      },
      reorderCategories: (orderedIds) => {
        set((s) => {
          const orderMap = new Map(orderedIds.map((categoryId, index) => [categoryId, index + 1]));
          const categories = s.categories.map((item) => ({
            ...item,
            sortOrder: orderMap.get(item.id) ?? item.sortOrder ?? s.categories.length + 1
          }));
          return { categories };
        });
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
              return sum + getSignedAmount(tx);
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
      suggestCategoryByLearning: (input) => {
        const tokens = buildLearningTokens(input);
        if (tokens.length === 0) return null;

        const { categoryLearningRules, categories } = get();
        const validCategoryIds = new Set(categories.map((item) => item.id));
        const scoreByCategory = new Map<string, { score: number; token: string }>();

        categoryLearningRules.forEach((rule) => {
          if (rule.type !== input.type) return;
          if (!validCategoryIds.has(rule.categoryId)) return;
          if (!tokens.includes(rule.token)) return;
          const weight = getTokenWeight(rule.token) * Math.max(1, rule.hitCount);
          const current = scoreByCategory.get(rule.categoryId);
          if (!current || current.score < weight) {
            scoreByCategory.set(rule.categoryId, { score: weight, token: rule.token });
            return;
          }
          scoreByCategory.set(rule.categoryId, {
            score: current.score + weight,
            token: current.token
          });
        });

        const sorted = Array.from(scoreByCategory.entries()).sort(
          (a, b) => b[1].score - a[1].score
        );
        if (sorted.length === 0) return null;

        const [categoryId, top] = sorted[0];
        const secondScore = sorted[1]?.[1].score ?? 0;
        const confidence = Math.min(1, top.score / Math.max(1, top.score + secondScore));

        return {
          categoryId,
          confidence,
          token: top.token
        };
      },
      recordCategoryCorrection: (input) => {
        if (input.fromCategoryId === input.toCategoryId) return;

        const tokens = buildLearningTokens(input);
        if (tokens.length === 0) return;

        const now = new Date().toISOString();
        set((s) => {
          const nextRules = s.categoryLearningRules.slice();
          const touchedRuleIds: string[] = [];

          tokens.forEach((token) => {
            const idx = nextRules.findIndex(
              (rule) =>
                rule.token === token &&
                rule.type === input.type &&
                rule.categoryId === input.toCategoryId
            );
            if (idx >= 0) {
              const updated = {
                ...nextRules[idx],
                hitCount: nextRules[idx].hitCount + 1,
                lastAppliedAt: now
              };
              nextRules[idx] = updated;
              touchedRuleIds.push(updated.id);
              return;
            }

            const inserted: CategoryLearningRule = {
              id: generateId(),
              token,
              type: input.type,
              categoryId: input.toCategoryId,
              hitCount: 1,
              createdAt: now,
              lastAppliedAt: now
            };
            nextRules.push(inserted);
            touchedRuleIds.push(inserted.id);
          });

          const nextEvents = [
            ...s.categoryLearningEvents,
            {
              id: generateId(),
              createdAt: now,
              type: input.type,
              fromCategoryId: input.fromCategoryId,
              toCategoryId: input.toCategoryId,
              tokens,
              ruleIds: touchedRuleIds
            }
          ].slice(-30);

          return {
            categoryLearningRules: nextRules,
            categoryLearningEvents: nextEvents
          };
        });
      },
      undoLatestCategoryLearning: () => {
        let success = false;
        set((s) => {
          const latest = s.categoryLearningEvents[s.categoryLearningEvents.length - 1];
          if (!latest) return s;
          success = true;

          const nextRules = s.categoryLearningRules
            .map((rule) => {
              if (!latest.ruleIds.includes(rule.id)) return rule;
              const nextHit = rule.hitCount - 1;
              return { ...rule, hitCount: nextHit };
            })
            .filter((rule) => rule.hitCount > 0);

          return {
            categoryLearningRules: nextRules,
            categoryLearningEvents: s.categoryLearningEvents.slice(0, -1)
          };
        });
        return success;
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
      version: 3,
      onRehydrateStorage: () => () => {
        useFinanceStore.setState({ hasHydrated: true });
      },
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
          hasHydrated: true,
          categories: compacted.categories,
          transactions: compacted.transactions,
          accounts: computeAccountBalances(
            Array.isArray(incoming.accounts) ? incoming.accounts : currentState.accounts,
            compacted.transactions
          ),
          categoryLearningRules: Array.isArray(
            (incoming as Partial<FinanceState>).categoryLearningRules
          )
            ? (incoming as Partial<FinanceState>).categoryLearningRules || []
            : currentState.categoryLearningRules,
          categoryLearningEvents: Array.isArray(
            (incoming as Partial<FinanceState>).categoryLearningEvents
          )
            ? (incoming as Partial<FinanceState>).categoryLearningEvents || []
            : currentState.categoryLearningEvents
        };
      }
    }
  )
);
