import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrencyFixed2 } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import {
  getAccountDisplayIcon,
  getAccountTypeLabel
} from '../../features/accounts/model/accountTypes';
import type { AccountType } from '../../features/accounts/model/accountTypes';

function normalizeNameInput(raw: string) {
  return raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

function isValidName(name: string) {
  return name.length >= 1 && name.length <= 24;
}

export function CategoriesAccountsPage() {
  const navigate = useNavigate();
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const updateAccountBalance = useFinanceStore((s) => s.updateAccountBalance);
  const removeAccount = useFinanceStore((s) => s.removeAccount);

  const [categoryName, setCategoryName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [accountInitialBalance, setAccountInitialBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [pendingDeleteAccountId, setPendingDeleteAccountId] = useState<string | null>(null);
  const [editingBalances, setEditingBalances] = useState<Record<string, string>>({});
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [accountError, setAccountError] = useState('');

  const CATEGORY_COLLAPSE_THRESHOLD = 3;
  const TAG_COLLAPSE_THRESHOLD = 3;
  const ACCOUNT_COLLAPSE_THRESHOLD = 8;

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, []);

  function submitCategory(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeNameInput(categoryName);
    if (!isValidName(normalized)) {
      setCategoryError('分类名称需为 1-24 个字符，且不能包含 < 或 >。');
      return;
    }
    addCategory(normalized);
    setCategoryName('');
    setCategoryError('');
  }

  function submitAccount(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeNameInput(accountName);
    if (!isValidName(normalized)) {
      setAccountError('账户名称需为 1-24 个字符，且不能包含 < 或 >。');
      return;
    }
    if (!accountType) {
      setAccountError('请选择账户类型后再添加账户。');
      return;
    }
    const initialBalance = Number(accountInitialBalance || '0');
    addAccount(normalized, accountType, Number.isFinite(initialBalance) ? initialBalance : 0);
    setAccountName('');
    setAccountType('');
    setAccountInitialBalance('0');
    setAccountError('');
  }

  const pendingDeleteLinkedCount = pendingDeleteAccountId
    ? transactions.filter((item) => item.accountId === pendingDeleteAccountId).length
    : 0;

  const tagGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    transactions.forEach((tx) => {
      tx.tags.forEach((raw) => {
        const label = String(raw || '').trim();
        if (!label) {
          return;
        }
        const key = label.toLowerCase();
        const found = map.get(key);
        if (found) {
          found.count += 1;
          return;
        }
        map.set(key, { key, label, count: 1 });
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, 'zh-CN');
    });
  }, [transactions]);

  const displayCategories = useMemo(
    () => (showAllCategories ? categories : categories.slice(0, CATEGORY_COLLAPSE_THRESHOLD)),
    [categories, showAllCategories]
  );

  const categoryUsageMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((tx) => {
      const prev = map.get(tx.categoryId) || 0;
      map.set(tx.categoryId, prev + 1);
    });
    return map;
  }, [transactions]);

  const displayTags = useMemo(
    () => (showAllTags ? tagGroups : tagGroups.slice(0, TAG_COLLAPSE_THRESHOLD)),
    [tagGroups, showAllTags]
  );

  const displayAccounts = useMemo(
    () => (showAllAccounts ? accounts : accounts.slice(0, ACCOUNT_COLLAPSE_THRESHOLD)),
    [accounts, showAllAccounts]
  );

  const hiddenCategoryCount = Math.max(0, categories.length - displayCategories.length);
  const hiddenTagCount = Math.max(0, tagGroups.length - displayTags.length);
  const hiddenAccountCount = Math.max(0, accounts.length - displayAccounts.length);

  const accountBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((account) => {
      const base = Number(account.initialBalance ?? 0);
      map.set(account.id, Number.isFinite(base) ? base : 0);
    });

    transactions.forEach((tx) => {
      const amount = Number(tx.amount);
      if (!tx.accountId || !Number.isFinite(amount) || !map.has(tx.accountId)) {
        return;
      }
      const prev = map.get(tx.accountId) || 0;
      const next = tx.type === 'income' ? prev + amount : prev - amount;
      map.set(tx.accountId, next);
    });

    return map;
  }, [accounts, transactions]);

  const applyAccountBalance = (accountId: string) => {
    const current = accounts.find((item) => item.id === accountId);
    if (!current) {
      return;
    }
    const raw =
      editingBalances[accountId] ??
      Number(
        accountBalanceMap.get(accountId) ?? current.balance ?? current.initialBalance ?? 0
      ).toFixed(2);
    const parsed = Number(raw || '0');
    if (!Number.isFinite(parsed)) {
      return;
    }
    const normalized = Math.round(parsed * 100) / 100;
    updateAccountBalance(accountId, normalized);
    setEditingBalances((prev) => ({ ...prev, [accountId]: normalized.toFixed(2) }));
  };

  const accountCards = useMemo(
    () =>
      displayAccounts.map((item) => {
        const computedBalance =
          accountBalanceMap.get(item.id) ?? Number(item.balance ?? item.initialBalance ?? 0);
        return {
          ...item,
          computedBalance
        };
      }),
    [displayAccounts, accountBalanceMap]
  );

  const removeTagFromAllTransactions = (tagLabel: string) => {
    const normalized = tagLabel.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    transactions.forEach((tx) => {
      const nextTags = tx.tags.filter((t) => t.trim().toLowerCase() !== normalized);
      if (nextTags.length !== tx.tags.length) {
        updateTransaction(tx.id, { ...tx, tags: nextTags });
      }
    });
  };

  const totalBalance = useMemo(
    () => accountCards.reduce((sum, item) => sum + item.computedBalance, 0),
    [accountCards]
  );

  const negativeAccounts = useMemo(
    () => accountCards.filter((item) => item.computedBalance < 0).length,
    [accountCards]
  );

  return (
    <div className="grid grid-2 categories-accounts-page">
      <section className="panel categories-panel">
        <header className="categories-accounts-head">
          <h2>分类与标签管理</h2>
          <div className="categories-accounts-metrics" aria-label="分类统计">
            <span className="metric-chip">
              分类 <strong>{categories.length}</strong>
            </span>
            <span className="metric-chip">
              标签 <strong>{tagGroups.length}</strong>
            </span>
          </div>
        </header>
        <form
          onSubmit={submitCategory}
          className="row categories-form-row"
          style={{ marginBottom: 16 }}
        >
          <input
            placeholder="新增分类名称"
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value);
              if (categoryError) setCategoryError('');
            }}
            style={{ flex: 1 }}
            maxLength={24}
          />
          <button className="primary" type="submit">
            添加
          </button>
        </form>
        {categoryError ? <small className="error">{categoryError}</small> : null}
        {loading ? (
          <LoadingSkeleton lines={4} />
        ) : categories.length === 0 ? (
          <EmptyState title="暂无分类" description="请添加第一个交易分类。" icon="🧩" />
        ) : (
          <>
            <ul className="categories-list">
              {displayCategories.map((item) => (
                <li key={item.id} className="row categories-row">
                  <span style={{ flex: 1 }}>
                    {item.name}
                    <button
                      type="button"
                      className="tag-count-chip tag-count-chip-link"
                      onClick={() =>
                        navigate(`/transactions?categoryId=${encodeURIComponent(item.id)}`)
                      }
                      aria-label={`查看分类 ${item.name} 的 ${categoryUsageMap.get(item.id) || 0} 条交易`}
                    >
                      {categoryUsageMap.get(item.id) || 0} 条
                    </button>
                  </span>
                  <button type="button" className="danger" onClick={() => removeCategory(item.id)}>
                    删除
                  </button>
                </li>
              ))}
            </ul>
            {categories.length > CATEGORY_COLLAPSE_THRESHOLD ? (
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  已显示 {displayCategories.length}/{categories.length}
                </small>
                <button type="button" onClick={() => setShowAllCategories((prev) => !prev)}>
                  {showAllCategories ? '收起' : `展开剩余 ${hiddenCategoryCount} 项`}
                </button>
              </div>
            ) : null}
          </>
        )}

        <h3 style={{ marginTop: 20 }}>交易标签</h3>
        {tagGroups.length === 0 ? (
          <EmptyState
            title="暂无标签"
            description="标签来自交易明细，新增交易标签后会自动聚合到这里。"
            icon="🏷️"
          />
        ) : (
          <>
            <ul className="categories-list">
              {displayTags.map((tag) => (
                <li key={tag.key} className="row categories-row">
                  <span style={{ flex: 1 }}>
                    #{tag.label}
                    <button
                      type="button"
                      className="tag-count-chip tag-count-chip-link"
                      onClick={() =>
                        navigate(`/transactions?keyword=${encodeURIComponent(tag.label)}`)
                      }
                      aria-label={`查看标签 ${tag.label} 的 ${tag.count} 条交易`}
                    >
                      {tag.count} 条
                    </button>
                  </span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeTagFromAllTransactions(tag.label)}
                  >
                    全部移除
                  </button>
                </li>
              ))}
            </ul>
            {tagGroups.length > TAG_COLLAPSE_THRESHOLD ? (
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  已显示 {displayTags.length}/{tagGroups.length}
                </small>
                <button type="button" onClick={() => setShowAllTags((prev) => !prev)}>
                  {showAllTags ? '收起' : `展开剩余 ${hiddenTagCount} 项`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="panel accounts-panel">
        <header className="categories-accounts-head">
          <h2>账户管理</h2>
          <div className="categories-accounts-metrics" aria-label="账户统计">
            <span className="metric-chip metric-chip-highlight">
              当前总余额 <strong>{formatCurrencyFixed2(totalBalance)}</strong>
            </span>
            <span className="metric-chip">
              负余额 <strong>{negativeAccounts}</strong>
            </span>
          </div>
        </header>

        <div className="account-toolbar-tip">
          可在下方快速新增账户、校准余额，并查看每个账户的资金健康状态。
        </div>

        <form onSubmit={submitAccount} className="account-create-form">
          <div className="account-create-grid">
            <div className="field">
              <label>账户名称</label>
              <input
                placeholder="如：招商银行卡 / 零钱 / 花呗"
                value={accountName}
                onChange={(e) => {
                  setAccountName(e.target.value);
                  if (accountError) setAccountError('');
                }}
                maxLength={24}
              />
            </div>
            <div className="field">
              <label>账户类型</label>
              <select
                aria-label="账户类型"
                title="账户类型"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType | '')}
              >
                <option value="">请选择类型</option>
                <option value="cash">💵 现金</option>
                <option value="debit">💳 借记卡</option>
                <option value="savings">🏦 储蓄卡</option>
                <option value="credit">💳 信用卡</option>
                <option value="virtual">📱 虚拟账户</option>
                <option value="liability">📄 负债</option>
                <option value="receivable">📥 应收</option>
              </select>
            </div>
            <div className="field">
              <label>初始余额</label>
              <input
                type="number"
                placeholder="0"
                value={accountInitialBalance}
                onChange={(e) => setAccountInitialBalance(e.target.value)}
              />
            </div>
            <button className="primary account-create-submit" type="submit">
              添加账户
            </button>
          </div>
        </form>
        {accountError ? <small className="error">{accountError}</small> : null}

        {loading ? (
          <LoadingSkeleton lines={4} />
        ) : accounts.length === 0 ? (
          <EmptyState title="暂无账户" description="请添加第一个资金账户。" icon="💳" />
        ) : (
          <>
            <div className="account-card-grid">
              {accountCards.map((item) => {
                const balanceValue =
                  editingBalances[item.id] ?? Number(item.computedBalance || 0).toFixed(2);
                return (
                  <article key={item.id} className="account-card">
                    <header className="account-card-head">
                      <span className="account-card-icon" aria-hidden="true">
                        {getAccountDisplayIcon(item.name, item.type)}
                      </span>
                      <div className="account-card-main">
                        <strong>{item.name}</strong>
                        {item.type ? (
                          <span className="account-type-badge">
                            {getAccountTypeLabel(item.type)}
                          </span>
                        ) : null}
                        <small>初始：{formatCurrencyFixed2(item.initialBalance ?? 0)}</small>
                      </div>
                      <div className="account-card-balance-wrap">
                        <span
                          className={`mono-inline account-card-balance ${
                            item.computedBalance < 0
                              ? 'account-card-balance-negative'
                              : 'account-card-balance-positive'
                          }`}
                        >
                          {formatCurrencyFixed2(item.computedBalance)}
                        </span>
                        <small>按交易自动汇总</small>
                      </div>
                    </header>

                    <div className="account-card-actions">
                      <div className="field account-balance-field">
                        <label>校准余额</label>
                        <input
                          className="account-balance-input"
                          type="number"
                          aria-label={`校准余额：${item.name}`}
                          title={`校准余额：${item.name}`}
                          placeholder="输入余额"
                          value={balanceValue}
                          onChange={(e) =>
                            setEditingBalances((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                        />
                      </div>
                      <button type="button" onClick={() => applyAccountBalance(item.id)}>
                        保存校准
                      </button>
                      <button className="danger" onClick={() => setPendingDeleteAccountId(item.id)}>
                        删除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {accounts.length > ACCOUNT_COLLAPSE_THRESHOLD ? (
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  已显示 {displayAccounts.length}/{accounts.length}
                </small>
                <button type="button" onClick={() => setShowAllAccounts((prev) => !prev)}>
                  {showAllAccounts ? '收起' : `展开剩余 ${hiddenAccountCount} 项`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDeleteAccountId)}
        title="确认删除账户"
        description={
          pendingDeleteLinkedCount > 0
            ? `该账户下存在 ${pendingDeleteLinkedCount} 条交易记录，删除后仅移除账户本身。是否继续？`
            : '删除账户后将无法恢复，是否继续？'
        }
        confirmText="确认删除"
        cancelText="取消"
        danger
        onConfirm={() => {
          if (!pendingDeleteAccountId) return;
          removeAccount(pendingDeleteAccountId);
          setPendingDeleteAccountId(null);
        }}
        onCancel={() => setPendingDeleteAccountId(null)}
      />
    </div>
  );
}
