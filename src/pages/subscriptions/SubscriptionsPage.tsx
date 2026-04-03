import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  SubscriptionBillingCycle,
  SubscriptionItem,
  SubscriptionKind,
  SubscriptionStatus
} from '../../entities/subscription/types';
import { formatDate, formatMoneyByCurrency } from '../../shared/lib/format';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';

const KIND_LABELS: Record<SubscriptionKind, string> = {
  digital: '数字订阅',
  mobile: '话费/通信',
  membership: '会员卡',
  other: '其他'
};

const CYCLE_LABELS: Record<SubscriptionBillingCycle, string> = {
  monthly: '每月',
  quarterly: '每季度',
  semiannual: '每半年',
  yearly: '每年',
  custom: '自定义'
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '正常',
  'due-soon': '即将到期',
  expired: '已到期',
  paused: '已暂停'
};

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  active: 'badge',
  'due-soon': 'badge badge-warning',
  expired: 'badge badge-danger',
  paused: 'badge'
};

function toMonthlyAmount(item: Pick<SubscriptionItem, 'amount' | 'billingCycle' | 'customCycleDays'>) {
  const amount = Number(item.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (item.billingCycle === 'monthly') return amount;
  if (item.billingCycle === 'quarterly') return amount / 3;
  if (item.billingCycle === 'semiannual') return amount / 6;
  if (item.billingCycle === 'yearly') return amount / 12;
  if (item.billingCycle === 'custom' && item.customCycleDays && item.customCycleDays > 0) {
    return (amount / item.customCycleDays) * 30;
  }
  return amount;
}

const DEFAULT_FORM = {
  name: '',
  kind: 'digital' as SubscriptionKind,
  amount: '0',
  currency: 'CNY',
  billingCycle: 'monthly' as SubscriptionBillingCycle,
  customCycleDays: '',
  accountId: '',
  provider: '',
  note: '',
  renewalDate: '',
  expireDate: '',
  autoRenew: true,
  status: 'active' as SubscriptionStatus
};

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const subscriptions = useFinanceStore((s) => s.subscriptions);
  const accounts = useFinanceStore((s) => s.accounts);
  const addSubscription = useFinanceStore((s) => s.addSubscription);
  const updateSubscription = useFinanceStore((s) => s.updateSubscription);
  const removeSubscription = useFinanceStore((s) => s.removeSubscription);
  const generateSubscriptionTransaction = useFinanceStore((s) => s.generateSubscriptionTransaction);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pendingDeleteItem = useMemo(
    () => subscriptions.find((item) => item.id === pendingDeleteId) ?? null,
    [subscriptions, pendingDeleteId]
  );

  const summary = useMemo(() => {
    return {
      total: subscriptions.length,
      dueSoon: subscriptions.filter((item) => item.status === 'due-soon').length,
      expired: subscriptions.filter((item) => item.status === 'expired').length
    };
  }, [subscriptions]);

  const monthlySummaryByCurrency = useMemo(() => {
    const grouped = new Map<string, number>();
    subscriptions
      .filter((item) => item.status !== 'paused')
      .forEach((item) => {
        const currency = item.currency || 'CNY';
        grouped.set(currency, (grouped.get(currency) || 0) + toMonthlyAmount(item));
      });

    return Array.from(grouped.entries())
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }, [subscriptions]);

  const rows = useMemo(
    () =>
      [...subscriptions].sort((a, b) => {
        const aDate = new Date(a.expireDate || a.renewalDate || a.updatedAt).getTime();
        const bDate = new Date(b.expireDate || b.renewalDate || b.updatedAt).getTime();
        return aDate - bDate;
      }),
    [subscriptions]
  );

  const attentionItems = useMemo(
    () => rows.filter((item) => item.status === 'due-soon' || item.status === 'expired').slice(0, 6),
    [rows]
  );

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const amount = Number(form.amount || '0');
    if (!name) {
      setError('请输入订阅名称。');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('订阅金额必须大于 0。');
      return;
    }

    const payload = {
      name,
      kind: form.kind,
      amount,
      currency: form.currency.trim().toUpperCase() || 'CNY',
      billingCycle: form.billingCycle,
      customCycleDays:
        form.billingCycle === 'custom' && Number(form.customCycleDays) > 0
          ? Number(form.customCycleDays)
          : undefined,
      accountId: form.accountId || undefined,
      provider: form.provider.trim() || undefined,
      note: form.note.trim() || undefined,
      renewalDate: form.renewalDate || undefined,
      expireDate: form.expireDate || undefined,
      autoRenew: form.autoRenew,
      status: form.status
    };

    if (editingId) {
      updateSubscription(editingId, payload);
    } else {
      addSubscription(payload);
    }

    resetForm();
  };

  const startEdit = (item: SubscriptionItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      kind: item.kind,
      amount: String(item.amount),
      currency: item.currency,
      billingCycle: item.billingCycle,
      customCycleDays: item.customCycleDays ? String(item.customCycleDays) : '',
      accountId: item.accountId || '',
      provider: item.provider || '',
      note: item.note || '',
      renewalDate: item.renewalDate || '',
      expireDate: item.expireDate || '',
      autoRenew: item.autoRenew ?? true,
      status: item.status
    });
    setError('');
  };

  const handleGenerateTransaction = (item: SubscriptionItem) => {
    try {
      const result = generateSubscriptionTransaction(item.id);
      navigate(`/transactions/${result.transactionId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '生成订阅支出失败，请稍后重试。');
    }
  };

  return (
    <section className="panel subscriptions-page">
      <div className="subscriptions-header">
        <div>
          <h2>订阅管理</h2>
          <p className="muted">统一管理数字订阅、话费、会员卡等周期性项目，支持多币种与到期日跟踪。</p>
        </div>
        <div className="subscriptions-summary">
          <span className="metric-chip">总数 <strong>{summary.total}</strong></span>
          <span className="metric-chip">即将到期 <strong>{summary.dueSoon}</strong></span>
          <span className="metric-chip">已到期 <strong>{summary.expired}</strong></span>
        </div>
      </div>

      {attentionItems.length > 0 ? (
        <div className="subscriptions-alerts">
          <div className="dashboard-section-header">
            <h4>待处理提醒</h4>
            <span>优先处理即将到期与已到期项目</span>
          </div>
          <div className="subscriptions-alert-list">
            {attentionItems.map((item) => (
              <article key={`alert-${item.id}`} className="subscriptions-alert-card">
                <strong>{item.name}</strong>
                <span>
                  {item.expireDate
                    ? `到期：${formatDate(item.expireDate)}`
                    : item.renewalDate
                      ? `续费：${formatDate(item.renewalDate)}`
                      : '日期未设置'}
                </span>
                <em>
                  {STATUS_LABELS[item.status]} · {formatMoneyByCurrency(item.amount, item.currency)}
                </em>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {monthlySummaryByCurrency.length > 0 ? (
        <div className="subscriptions-monthly-summary">
          <div className="dashboard-section-header">
            <h4>预计月度固定成本</h4>
            <span>按币种分组展示，避免错误合并</span>
          </div>
          <div className="subscriptions-monthly-summary-list">
            {monthlySummaryByCurrency.map((item) => (
              <article key={item.currency} className="subscriptions-monthly-summary-card">
                <strong>{item.currency}</strong>
                <span>{formatMoneyByCurrency(item.amount, item.currency)}</span>
                <em>按当前订阅周期折算到每月</em>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <form className="subscriptions-form" onSubmit={handleSubmit}>
        <label>
          <span>名称</span>
          <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="例如：Spotify / 中国移动 / 健身月卡" />
        </label>
        <label>
          <span>类型</span>
          <select value={form.kind} onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as SubscriptionKind }))}>
            <option value="digital">数字订阅</option>
            <option value="mobile">话费/通信</option>
            <option value="membership">会员卡</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          <span>金额</span>
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
        </label>
        <label>
          <span>币种</span>
          <input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} placeholder="CNY / USD / HKD" />
        </label>
        <label>
          <span>计费周期</span>
          <select value={form.billingCycle} onChange={(e) => setForm((prev) => ({ ...prev, billingCycle: e.target.value as SubscriptionBillingCycle }))}>
            <option value="monthly">每月</option>
            <option value="quarterly">每季度</option>
            <option value="semiannual">每半年</option>
            <option value="yearly">每年</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        {form.billingCycle === 'custom' ? (
          <label>
            <span>自定义天数</span>
            <input type="number" min="1" step="1" value={form.customCycleDays} onChange={(e) => setForm((prev) => ({ ...prev, customCycleDays: e.target.value }))} />
          </label>
        ) : null}
        <label>
          <span>扣费账户</span>
          <select value={form.accountId} onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}>
            <option value="">未指定</option>
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>服务商</span>
          <input value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder="可选" />
        </label>
        <label>
          <span>续费日</span>
          <input type="date" value={form.renewalDate} onChange={(e) => setForm((prev) => ({ ...prev, renewalDate: e.target.value }))} />
        </label>
        <label>
          <span>到期日</span>
          <input type="date" value={form.expireDate} onChange={(e) => setForm((prev) => ({ ...prev, expireDate: e.target.value }))} />
        </label>
        <label>
          <span>状态</span>
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as SubscriptionStatus }))}>
            <option value="active">正常</option>
            <option value="paused">已暂停</option>
          </select>
        </label>
        <label className="subscriptions-checkbox">
          <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm((prev) => ({ ...prev, autoRenew: e.target.checked }))} />
          <span>自动续费</span>
        </label>
        <label className="subscriptions-form-full">
          <span>备注</span>
          <textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} rows={3} placeholder="可记录套餐说明、会员权益、卡号尾号等" />
        </label>
        {error ? <p className="assistant-wb-issue error subscriptions-form-full">{error}</p> : null}
        <div className="subscriptions-actions subscriptions-form-full">
          <button type="submit" className="primary">{editingId ? '保存修改' : '新增订阅'}</button>
          {editingId ? <button type="button" onClick={resetForm}>取消编辑</button> : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="还没有订阅项目" description="先添加第一个数字订阅、话费套餐或会员卡，后面就能统一看费用和到期情况。" icon="🧾" />
      ) : (
        <div className="subscriptions-table-wrap">
          <table className="subscriptions-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>金额</th>
                <th>周期</th>
                <th>账户</th>
                <th>续费/到期</th>
                <th>状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const account = item.accountId ? accounts.find((row) => row.id === item.accountId) : null;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="balance-change-related">
                        <span>{item.name}</span>
                        {item.provider ? <small>{item.provider}</small> : null}
                      </div>
                    </td>
                    <td>{KIND_LABELS[item.kind]}</td>
                    <td>{formatMoneyByCurrency(item.amount, item.currency)}</td>
                    <td>{item.billingCycle === 'custom' ? `每 ${item.customCycleDays || '—'} 天` : CYCLE_LABELS[item.billingCycle]}</td>
                    <td>{account?.name || '未指定'}</td>
                    <td>
                      <div className="balance-change-related">
                        <span>{item.renewalDate ? `续费：${formatDate(item.renewalDate)}` : '续费日未设置'}</span>
                        <small>{item.expireDate ? `到期：${formatDate(item.expireDate)}` : '到期日未设置'}</small>
                      </div>
                    </td>
                    <td><span className={STATUS_CLASS[item.status]}>{STATUS_LABELS[item.status]}</span></td>
                    <td>{item.note || '—'}</td>
                    <td>
                      <div className="subscriptions-actions-inline">
                        <button type="button" className="primary" onClick={() => handleGenerateTransaction(item)}>
                          生成支出
                        </button>
                        <button type="button" onClick={() => startEdit(item)}>编辑</button>
                        <button type="button" className="danger" onClick={() => setPendingDeleteId(item.id)}>删除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title="移入回收站"
        description={pendingDeleteItem ? `确认将“${pendingDeleteItem.name}”移入回收站吗？后续仍可在回收站恢复或彻底删除。` : ''}
        confirmText="移入回收站"
        cancelText="取消"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) removeSubscription(pendingDeleteId);
          setPendingDeleteId(null);
          if (editingId === pendingDeleteId) resetForm();
        }}
      />
    </section>
  );
}
