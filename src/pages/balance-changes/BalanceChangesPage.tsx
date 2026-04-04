import { useMemo } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrencyFixed2, formatDateTime } from '../../shared/lib/format';
import { EmptyState } from '../../shared/ui/EmptyState';

const TYPE_LABELS: Record<string, string> = {
  'transaction-income': '收入入账',
  'transaction-expense': '支出扣减',
  'transaction-budget': '预算变动',
  'transaction-repayment': '还款扣减',
  'transaction-refund': '退款回补',
  'manual-adjustment': '手动调整'
};

function getTypeLabel(type: string) {
  return TYPE_LABELS[type] || type;
}

function getDirectionText(beforeBalance: number, afterBalance: number) {
  if (afterBalance > beforeBalance) {
    return '余额增加';
  }
  if (afterBalance < beforeBalance) {
    return '余额减少';
  }
  return '余额无变化';
}

function getRelatedDescription(entry: {
  type: string;
  transactionSummary: string;
  relatedTransactionId?: string;
  relatedSummary: string;
}) {
  if (entry.type === 'transaction-refund' && entry.relatedTransactionId) {
    return `退款回补，原单：${entry.relatedSummary}`;
  }
  if (entry.type === 'transaction-expense') {
    return `支出记录：${entry.transactionSummary}`;
  }
  if (entry.type === 'transaction-income') {
    return `收入记录：${entry.transactionSummary}`;
  }
  if (entry.type === 'manual-adjustment') {
    return `手动调整：${entry.transactionSummary}`;
  }
  return entry.transactionSummary;
}

export function BalanceChangesPage() {
  const entries = useFinanceStore((s) => s.balanceChangeEntries);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);

  const rows = useMemo(
    () =>
      [...entries]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((entry) => {
          const account = accounts.find((item) => item.id === entry.accountId);
          const transaction = entry.transactionId
            ? transactions.find((item) => item.id === entry.transactionId)
            : null;
          const relatedTransaction = entry.relatedTransactionId
            ? transactions.find((item) => item.id === entry.relatedTransactionId)
            : null;

          return {
            ...entry,
            accountName: account?.name || '未知账户',
            transactionSummary: transaction?.note || transaction?.id || '—',
            relatedSummary: relatedTransaction?.note || relatedTransaction?.id || '—'
          };
        }),
    [accounts, entries, transactions]
  );

  return (
    <section className="panel balance-change-page">
      <div className="balance-change-header">
        <div>
          <h2>余额变动明细</h2>
          <p className="muted">
            用来回答“这笔余额为什么变了”。已覆盖收入、支出、退款、手动调整等余额变化。
          </p>
        </div>
        <div className="balance-change-summary">
          <span className="metric-chip">
            明细 <strong>{rows.length}</strong>
          </span>
        </div>
      </div>

      <div className="balance-change-tip">
        <strong>历史兼容说明</strong>
        <p>
          历史余额明细会基于现有交易记录与手动余额调整记录重建；若更早历史数据缺少关联信息，页面会尽量展示已知对象，并保留“未知/缺失”说明。
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="暂无余额变动明细"
          description="当你新增收入、支出、退款或手动调整账户余额后，这里会自动生成可追踪记录。"
          icon="📚"
        />
      ) : (
        <div className="balance-change-table-wrap">
          <table className="balance-change-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>账户</th>
                <th>变动类型</th>
                <th>金额</th>
                <th>变动前</th>
                <th>变动后</th>
                <th>关联对象</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.accountName}</td>
                  <td>
                    <div className="balance-change-related">
                      <span>{getTypeLabel(entry.type)}</span>
                      <small>{getDirectionText(entry.beforeBalance, entry.afterBalance)}</small>
                    </div>
                  </td>
                  <td
                    className={
                      entry.afterBalance >= entry.beforeBalance
                        ? 'balance-change-amount is-positive'
                        : 'balance-change-amount is-negative'
                    }
                  >
                    {formatCurrencyFixed2(entry.amount)}
                  </td>
                  <td>{formatCurrencyFixed2(entry.beforeBalance)}</td>
                  <td>{formatCurrencyFixed2(entry.afterBalance)}</td>
                  <td>
                    <div className="balance-change-related">
                      <span>{getRelatedDescription(entry)}</span>
                      {entry.relatedTransactionId ? <small>关联原单：{entry.relatedSummary}</small> : null}
                    </div>
                  </td>
                  <td>
                    <div className="balance-change-related">
                      <span>{entry.note || '—'}</span>
                      {entry.remark ? <small>{entry.remark}</small> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
