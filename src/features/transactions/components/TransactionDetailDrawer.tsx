import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TransactionItem,
  TransactionSource,
  TransactionStatus
} from '../../../entities/transaction/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: '待处理',
  completed: '已完成',
  refunded: '已退款',
  closed: '已关闭',
  failed: '失败'
};

function statusLabel(status: TransactionStatus): string {
  return STATUS_LABELS[status] || status;
}

function sourceLabel(source: TransactionSource): string {
  if (source === 'ai') return 'AI 记账';
  if (source === 'wechat') return '微信导入';
  if (source === 'alipay') return '支付宝导入';
  return '手工录入';
}

export type TransactionDetailSectionKey = 'base' | 'source' | 'note' | 'tags' | 'json';
type DetailMode = 'professional' | 'timeline';
const DETAIL_MODE_STORAGE_KEY = 'ledgerflow.transactions.detailMode';

interface TransactionDetailDrawerProps {
  open: boolean;
  transaction: TransactionItem | null;
  categoryName: string;
  accountName: string;
  source: TransactionSource;
  onClose: () => void;
  onCopyNote: () => void;
  onCopyJson: () => void;
  onDelete: () => void;
  visibleSections: Record<TransactionDetailSectionKey, boolean>;
  onToggleSection: (key: TransactionDetailSectionKey) => void;
}

export function TransactionDetailDrawer({
  open,
  transaction,
  categoryName,
  accountName,
  source,
  onClose,
  onCopyNote,
  onCopyJson,
  onDelete,
  visibleSections,
  onToggleSection
}: TransactionDetailDrawerProps) {
  const [mode, setMode] = useState<DetailMode>(() => {
    const saved = window.localStorage.getItem(DETAIL_MODE_STORAGE_KEY);
    return saved === 'timeline' ? 'timeline' : 'professional';
  });

  const setDetailMode = (next: DetailMode) => {
    setMode(next);
    window.localStorage.setItem(DETAIL_MODE_STORAGE_KEY, next);
  };

  // 打开时禁止 body 滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !transaction) return null;

  return (
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="交易详情"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h3>交易详情</h3>
            <small className="drawer-subtitle">支持模块化显示</small>
          </div>
          <div className="drawer-mode-switch" role="tablist" aria-label="交易详情显示模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'professional'}
              className={mode === 'professional' ? 'active' : ''}
              onClick={() => setDetailMode('professional')}
            >
              专业模式
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'timeline'}
              className={mode === 'timeline' ? 'active' : ''}
              onClick={() => setDetailMode('timeline')}
            >
              时间轴模式
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭详情">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          {mode === 'timeline' ? (
            <section className="drawer-timeline" aria-label="交易时间轴">
              {[
                { label: '交易创建', value: formatDateTime(transaction.date), icon: '🧾' },
                { label: '分类与账户', value: `${categoryName} · ${accountName}`, icon: '🗂️' },
                {
                  label: '交易金额',
                  value: `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}`,
                  icon: transaction.type === 'income' ? '🟢' : '🔴'
                },
                { label: '记录来源', value: sourceLabel(source), icon: '🤖' },
                { label: '备注', value: transaction.note || '（无）', icon: '📝' }
              ].map((item) => (
                <article key={item.label} className="drawer-timeline-item">
                  <span className="drawer-timeline-icon">{item.icon}</span>
                  <div>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {mode === 'professional' ? (
            <details className="drawer-modules" open>
              <summary>详情标题模块</summary>
              <div className="drawer-modules-grid">
                {[
                  { key: 'base' as const, label: '基础信息' },
                  { key: 'source' as const, label: '来源' },
                  { key: 'note' as const, label: '备注' },
                  { key: 'tags' as const, label: '标签' },
                  { key: 'json' as const, label: '原始 JSON' }
                ].map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={visibleSections[item.key]}
                      onChange={() => onToggleSection(item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </details>
          ) : null}

          {mode === 'professional' && visibleSections.base ? (
            <>
              <div className="drawer-kv">
                <span>日期时间</span>
                <strong>{formatDateTime(transaction.date)}</strong>
              </div>
              <div className="drawer-kv">
                <span>类型</span>
                <strong className={transaction.type === 'income' ? 'text-income' : 'text-expense'}>
                  {transaction.type === 'income'
                    ? '收入'
                    : transaction.type === 'budget'
                      ? '预算'
                      : transaction.type === 'repayment'
                        ? '还款'
                        : '支出'}
                </strong>
              </div>
              <div className="drawer-kv">
                <span>分类</span>
                <strong>{categoryName}</strong>
              </div>
              <div className="drawer-kv">
                <span>账户</span>
                <strong>{accountName}</strong>
              </div>
              <div className="drawer-kv">
                <span>金额</span>
                <strong className={transaction.type === 'income' ? 'text-income' : 'text-expense'}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </strong>
              </div>
              {transaction.status ? (
                <div className="drawer-kv">
                  <span>交易状态</span>
                  <strong>
                    <span
                      className={`badge ${transaction.status === 'completed' ? 'badge-primary' : ''}`}
                    >
                      {statusLabel(transaction.status)}
                    </span>
                  </strong>
                </div>
              ) : null}
              {transaction.orderNo ? (
                <div className="drawer-kv">
                  <span>订单号</span>
                  <strong>{transaction.orderNo}</strong>
                </div>
              ) : null}
              {transaction.merchantOrderNo ? (
                <div className="drawer-kv">
                  <span>商家订单号</span>
                  <strong>{transaction.merchantOrderNo}</strong>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'professional' && visibleSections.source ? (
            <div className="drawer-kv">
              <span>来源</span>
              <strong>
                {source === 'ai' ? <span className="badge badge-primary">AI 记账</span> : null}
                {source === 'wechat' ? <span className="badge">微信导入</span> : null}
                {source === 'alipay' ? <span className="badge">支付宝导入</span> : null}
                {source === 'manual' ? <span className="badge">手工录入</span> : null}
              </strong>
            </div>
          ) : null}

          {mode === 'professional' && visibleSections.note ? (
            <section className="drawer-section">
              <h4>备注</h4>
              <p>{transaction.note || '（无）'}</p>
            </section>
          ) : null}

          {mode === 'professional' && visibleSections.tags ? (
            <section className="drawer-section">
              <h4>标签</h4>
              <div className="drawer-tags">
                {transaction.tags.length > 0
                  ? transaction.tags.map((tag) => (
                      <span key={tag} className="badge badge-primary">
                        {tag}
                      </span>
                    ))
                  : '（无）'}
              </div>
              {transaction.tags.length > 6 ? (
                <details className="drawer-tags-fold">
                  <summary>展开全部标签</summary>
                  <div className="drawer-tags" style={{ marginTop: 6 }}>
                    {transaction.tags.map((tag) => (
                      <span key={`${tag}-all`} className="badge badge-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}

          {mode === 'professional' && visibleSections.json ? (
            <section className="drawer-section">
              <h4>原始 JSON</h4>
              <pre>{JSON.stringify(transaction, null, 2)}</pre>
            </section>
          ) : null}
        </div>

        <footer className="drawer-footer">
          <button type="button" onClick={onCopyNote}>
            复制备注
          </button>
          <button type="button" onClick={onCopyJson}>
            复制 JSON
          </button>
          <Link to={`/transactions/${transaction.id}`} style={{ textDecoration: 'none' }}>
            <button type="button">✏️ 编辑</button>
          </Link>
          <button type="button" className="danger" onClick={onDelete}>
            🗑️ 删除
          </button>
          <Link to="/transactions/new" className="drawer-add-link" aria-label="新增账目">
            ＋
          </Link>
        </footer>
      </aside>
    </div>
  );
}
