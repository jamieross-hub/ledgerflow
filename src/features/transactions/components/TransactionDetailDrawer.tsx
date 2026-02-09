import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TransactionItem, TransactionSource } from '../../../entities/transaction/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';

export type TransactionDetailSectionKey = 'base' | 'source' | 'note' | 'tags' | 'json';

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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭详情">
            ✕
          </button>
        </header>

        <div className="drawer-body">
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

          {visibleSections.base ? (
            <>
              <div className="drawer-kv">
                <span>日期时间</span>
                <strong>{formatDateTime(transaction.date)}</strong>
              </div>
              <div className="drawer-kv">
                <span>类型</span>
                <strong className={transaction.type === 'income' ? 'text-income' : 'text-expense'}>
                  {transaction.type === 'income' ? '收入' : '支出'}
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
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </strong>
              </div>
            </>
          ) : null}

          {visibleSections.source ? (
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

          {visibleSections.note ? (
            <section className="drawer-section">
              <h4>备注</h4>
              <p>{transaction.note || '（无）'}</p>
            </section>
          ) : null}

          {visibleSections.tags ? (
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

          {visibleSections.json ? (
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
        </footer>
      </aside>
    </div>
  );
}
