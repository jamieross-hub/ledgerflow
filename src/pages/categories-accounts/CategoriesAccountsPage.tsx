import { FormEvent, useEffect, useState } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { AccountPresetPicker } from '../../features/accounts/ui/AccountPresetPicker';
import { ACCOUNT_PRESETS, getAccountTypeLabel } from '../../features/accounts/model/accountTypes';
import type { AccountPreset, AccountType } from '../../features/accounts/model/accountTypes';

export function CategoriesAccountsPage() {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const removeAccount = useFinanceStore((s) => s.removeAccount);

  const [categoryName, setCategoryName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [accountInitialBalance, setAccountInitialBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [pendingDeleteAccountId, setPendingDeleteAccountId] = useState<string | null>(null);

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

  function handlePresetSelect(preset: AccountPreset) {
    addAccount(preset.name, preset.type);
  }

  const pendingDeleteLinkedCount = pendingDeleteAccountId
    ? transactions.filter((item) => item.accountId === pendingDeleteAccountId).length
    : 0;

  return (
    <div className="grid grid-2">
      <section className="panel">
        <h2>分类管理</h2>
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
      </section>

      <section className="panel">
        <h2>账户管理</h2>

        {/* 预设快捷添加 */}
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
            📋 快速添加预设账户
          </summary>
          <div style={{ marginTop: 8 }}>
            <AccountPresetPicker presets={ACCOUNT_PRESETS} onSelect={handlePresetSelect} />
          </div>
        </details>

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
          <EmptyState title="暂无账户" description="请添加第一个资金账户，或使用上方预设快速创建。" icon="💳" />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {accounts.map((item) => (
              <li key={item.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ flex: 1 }}>
                  {item.name}
                  {item.type && (
                    <span className="account-type-badge">{getAccountTypeLabel(item.type)}</span>
                  )}
                </span>
                <span className="mono-inline" style={{ color: 'var(--color-text-secondary)', minWidth: 108, textAlign: 'right' }}>
                  {formatCurrency(item.balance ?? item.initialBalance ?? 0)}
                </span>
                <button className="danger" onClick={() => setPendingDeleteAccountId(item.id)}>
                  删除
                </button>
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
