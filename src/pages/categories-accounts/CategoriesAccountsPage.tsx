import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { getAccountTypeLabel } from '../../features/accounts/model/accountTypes';
import type { AccountType } from '../../features/accounts/model/accountTypes';

export function CategoriesAccountsPage() {
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

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, []);

  function submitCategory(e: FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;
    addCategory(categoryName);
    setCategoryName('');
  }

  function submitAccount(e: FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) return;
    const initialBalance = Number(accountInitialBalance || '0');
    addAccount(accountName, accountType || undefined, Number.isFinite(initialBalance) ? initialBalance : 0);
    setAccountName('');
    setAccountType('');
    setAccountInitialBalance('0');
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

  const applyAccountBalance = (accountId: string) => {
    const current = accounts.find((item) => item.id === accountId);
    if (!current) {
      return;
    }
    const raw = editingBalances[accountId] ?? String(current.balance ?? current.initialBalance ?? 0);
    const parsed = Number(raw || '0');
    if (!Number.isFinite(parsed)) {
      return;
    }
    updateAccountBalance(accountId, parsed);
    setEditingBalances((prev) => ({ ...prev, [accountId]: String(parsed) }));
  };

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

  return (
    <div className="grid grid-2">
      <section className="panel">
        <h2>分类与标签管理</h2>
        <form onSubmit={submitCategory} className="row" style={{ marginBottom: 16 }}>
          <input
            placeholder="新增分类名称"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit">
            添加
          </button>
        </form>
        {loading ? (
          <LoadingSkeleton lines={4} />
        ) : categories.length === 0 ? (
          <EmptyState title="暂无分类" description="请添加第一个交易分类。" icon="🧩" />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {categories.map((item) => (
              <li key={item.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ flex: 1 }}>{item.name}</span>
                <button className="danger" onClick={() => removeCategory(item.id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 style={{ marginTop: 20 }}>交易标签</h3>
        {tagGroups.length === 0 ? (
          <EmptyState title="暂无标签" description="标签来自交易明细，新增交易标签后会自动聚合到这里。" icon="🏷️" />
        ) : (
          <details open>
            <summary className="tag-fold-summary">查看全部标签（{tagGroups.length}）</summary>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tagGroups.map((tag) => (
                <li key={tag.key} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <span style={{ flex: 1 }}>
                    #{tag.label}
                    <small style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>{tag.count} 条</small>
                  </span>
                  <button type="button" className="danger" onClick={() => removeTagFromAllTransactions(tag.label)}>
                    全部移除
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="panel">
        <h2>账户管理</h2>

        <form onSubmit={submitAccount} style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input
              placeholder="新增账户名称"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType | '')}
              style={{ minWidth: 100 }}
            >
              <option value="">类型（可选）</option>
              <option value="cash">💵 现金</option>
              <option value="debit">💳 借记卡</option>
              <option value="savings">🏦 储蓄卡</option>
              <option value="credit">💳 信用卡</option>
              <option value="virtual">📱 虚拟账户</option>
              <option value="liability">📄 负债</option>
              <option value="receivable">📥 应收</option>
            </select>
            <input
              type="number"
              placeholder="初始余额"
              value={accountInitialBalance}
              onChange={(e) => setAccountInitialBalance(e.target.value)}
              style={{ width: 120 }}
            />
            <button className="primary" type="submit">
              添加
            </button>
          </div>
        </form>

        {loading ? (
          <LoadingSkeleton lines={4} />
        ) : accounts.length === 0 ? (
          <EmptyState title="暂无账户" description="请添加第一个资金账户。" icon="💳" />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {accounts.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  display: 'grid',
                  gap: 8
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ flex: 1 }}>
                    {item.name}
                    {item.type && <span className="account-type-badge">{getAccountTypeLabel(item.type)}</span>}
                  </span>
                  <span className="mono-inline" style={{ color: 'var(--color-text-secondary)' }}>
                    当前 {formatCurrency(item.balance ?? item.initialBalance ?? 0)}
                  </span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    type="number"
                    value={editingBalances[item.id] ?? String(item.balance ?? item.initialBalance ?? 0)}
                    onChange={(e) => setEditingBalances((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    style={{ width: 160 }}
                  />
                  <button type="button" onClick={() => applyAccountBalance(item.id)}>
                    更新结余
                  </button>
                  <button className="danger" onClick={() => setPendingDeleteAccountId(item.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
