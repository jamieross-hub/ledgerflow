import { useMemo } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrencyFixed2, formatDateTime } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';

export function RecycleBinPage() {
  const trashedTransactions = useFinanceStore((s) => s.trashedTransactions);
  const trashedCategories = useFinanceStore((s) => s.trashedCategories);
  const trashedAccounts = useFinanceStore((s) => s.trashedAccounts);
  const trashedSubscriptions = useFinanceStore((s) => s.trashedSubscriptions);
  const restoreTransaction = useFinanceStore((s) => s.restoreTransaction);
  const permanentlyDeleteTransaction = useFinanceStore((s) => s.permanentlyDeleteTransaction);
  const restoreCategory = useFinanceStore((s) => s.restoreCategory);
  const permanentlyDeleteCategory = useFinanceStore((s) => s.permanentlyDeleteCategory);
  const restoreAccount = useFinanceStore((s) => s.restoreAccount);
  const permanentlyDeleteAccount = useFinanceStore((s) => s.permanentlyDeleteAccount);
  const restoreSubscription = useFinanceStore((s) => s.restoreSubscription);
  const permanentlyDeleteSubscription = useFinanceStore((s) => s.permanentlyDeleteSubscription);

  const totalCount =
    trashedTransactions.length + trashedCategories.length + trashedAccounts.length + trashedSubscriptions.length;

  const sortedTransactions = useMemo(
    () =>
      [...trashedTransactions].sort(
        (a, b) => new Date(b.trashedAt || b.updatedAt || b.date).getTime() - new Date(a.trashedAt || a.updatedAt || a.date).getTime()
      ),
    [trashedTransactions]
  );

  const sortedCategories = useMemo(
    () => [...trashedCategories].sort((a, b) => new Date(b.trashedAt || 0).getTime() - new Date(a.trashedAt || 0).getTime()),
    [trashedCategories]
  );

  const sortedAccounts = useMemo(
    () => [...trashedAccounts].sort((a, b) => new Date(b.trashedAt || 0).getTime() - new Date(a.trashedAt || 0).getTime()),
    [trashedAccounts]
  );

  const sortedSubscriptions = useMemo(
    () => [...trashedSubscriptions].sort((a, b) => new Date(b.trashedAt || 0).getTime() - new Date(a.trashedAt || 0).getTime()),
    [trashedSubscriptions]
  );

  return (
    <section className="panel recycle-bin-page">
      <div className="recycle-bin-header">
        <div>
          <h2>回收站</h2>
          <p className="muted">删除的交易、分类、账户会先进入这里。恢复后会重新参与余额与统计计算。</p>
        </div>
        <span className="metric-chip">
          共 <strong>{totalCount}</strong> 项
        </span>
      </div>

      {totalCount === 0 ? (
        <EmptyState title="回收站为空" description="删除的内容会先进入回收站，避免误删后无法找回。" icon="🗑️" />
      ) : (
        <div className="recycle-bin-sections">
          <section className="recycle-bin-block">
            <div className="recycle-bin-block-header">
              <h3>交易</h3>
              <span>{sortedTransactions.length} 条</span>
            </div>
            {sortedTransactions.length === 0 ? (
              <p className="muted">暂无已删除交易</p>
            ) : (
              <div className="recycle-bin-list">
                {sortedTransactions.map((item) => (
                  <article key={item.id} className="recycle-bin-item">
                    <div>
                      <strong>{item.note || '未命名交易'}</strong>
                      <div className="recycle-bin-meta">
                        <span>{item.type}</span>
                        <span>{formatCurrencyFixed2(item.amount)}</span>
                        <span>删除于 {formatDateTime(item.trashedAt || item.updatedAt || item.date)}</span>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => restoreTransaction(item.id)}>恢复</button>
                      <button type="button" className="danger" onClick={() => permanentlyDeleteTransaction(item.id)}>
                        彻底删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="recycle-bin-block">
            <div className="recycle-bin-block-header">
              <h3>分类</h3>
              <span>{sortedCategories.length} 个</span>
            </div>
            {sortedCategories.length === 0 ? (
              <p className="muted">暂无已删除分类</p>
            ) : (
              <div className="recycle-bin-list">
                {sortedCategories.map((item) => (
                  <article key={item.id} className="recycle-bin-item">
                    <div>
                      <strong>{item.icon ? `${item.icon} ` : ''}{item.name}</strong>
                      <div className="recycle-bin-meta">
                        <span>{item.kind || '未设置类型'}</span>
                        <span>删除于 {formatDateTime(item.trashedAt || new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => restoreCategory(item.id)}>恢复</button>
                      <button type="button" className="danger" onClick={() => permanentlyDeleteCategory(item.id)}>
                        彻底删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="recycle-bin-block">
            <div className="recycle-bin-block-header">
              <h3>账户</h3>
              <span>{sortedAccounts.length} 个</span>
            </div>
            {sortedAccounts.length === 0 ? (
              <p className="muted">暂无已删除账户</p>
            ) : (
              <div className="recycle-bin-list">
                {sortedAccounts.map((item) => (
                  <article key={item.id} className="recycle-bin-item">
                    <div>
                      <strong>{item.name}</strong>
                      <div className="recycle-bin-meta">
                        <span>{formatCurrencyFixed2(Number(item.balance ?? item.initialBalance ?? 0))}</span>
                        <span>删除于 {formatDateTime(item.trashedAt || new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => restoreAccount(item.id)}>恢复</button>
                      <button type="button" className="danger" onClick={() => permanentlyDeleteAccount(item.id)}>
                        彻底删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="recycle-bin-block">
            <div className="recycle-bin-block-header">
              <h3>订阅</h3>
              <span>{sortedSubscriptions.length} 个</span>
            </div>
            {sortedSubscriptions.length === 0 ? (
              <p className="muted">暂无已删除订阅</p>
            ) : (
              <div className="recycle-bin-list">
                {sortedSubscriptions.map((item) => (
                  <article key={item.id} className="recycle-bin-item">
                    <div>
                      <strong>{item.name}</strong>
                      <div className="recycle-bin-meta">
                        <span>{formatCurrencyFixed2(Number(item.amount ?? 0))} {item.currency || 'CNY'}</span>
                        <span>{item.provider || '未设置服务商'}</span>
                        <span>删除于 {formatDateTime(item.trashedAt || item.updatedAt || new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => restoreSubscription(item.id)}>恢复</button>
                      <button type="button" className="danger" onClick={() => permanentlyDeleteSubscription(item.id)}>
                        彻底删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
