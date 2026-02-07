import { Link } from 'react-router-dom';
import { TransactionItem } from '../../../entities/transaction/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { TableSkeleton } from '../../../shared/ui/TableSkeleton';

const NOTE_MAX_LENGTH = 22;

function truncateNote(note: string): string {
  if (note.length <= NOTE_MAX_LENGTH) {
    return note;
  }
  return `${note.slice(0, NOTE_MAX_LENGTH)}…`;
}

export interface TransactionRowView {
  item: TransactionItem;
  categoryName: string;
  accountName: string;
}

interface TransactionTableProps {
  rows: TransactionRowView[];
  total: number;
  filteredTotal: number;
  page: number;
  pages: number;
  loading: boolean;
  errorMessage?: string;
  hasFilters: boolean;
  highlightId?: string;
  onRetry: () => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TransactionTable({
  rows,
  total,
  filteredTotal,
  page,
  pages,
  loading,
  errorMessage,
  hasFilters,
  highlightId,
  onRetry,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onOpenDetail,
  onDelete
}: TransactionTableProps) {
  return (
    <section className="panel">
      {loading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : errorMessage ? (
        <EmptyState
          icon="⚠️"
          title="交易数据加载失败"
          description={errorMessage}
          secondaryAction={{ label: '清空筛选', onClick: onClearFilters }}
          primaryAction={{ label: '重试', onClick: onRetry, variant: 'primary' }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📋"
          title={hasFilters ? '没有符合条件的交易' : '暂无交易记录'}
          description={hasFilters ? '调整筛选条件后重试。' : '添加第一笔交易，或导入账单数据。'}
          secondaryAction={hasFilters ? { label: '清空筛选', onClick: onClearFilters } : undefined}
          primaryAction={
            hasFilters
              ? undefined
              : {
                  label: '新增账目',
                  onClick: () => {
                    window.location.href = '/transactions/new';
                  },
                  variant: 'primary'
                }
          }
        />
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>类型</th>
                <th>分类</th>
                <th>账户</th>
                <th>金额</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, categoryName, accountName }) => {
                const note = item.note || '-';
                return (
                  <tr
                    key={item.id}
                    id={`transaction-row-${item.id}`}
                    className={highlightId === item.id ? 'transaction-row-highlight' : undefined}
                  >
                    <td>{formatDate(item.date)}</td>
                    <td>
                      <span className={item.type === 'income' ? 'badge badge-success' : 'badge badge-danger'}>
                        {item.type === 'income' ? '收入' : '支出'}
                      </span>
                    </td>
                    <td>{categoryName}</td>
                    <td>{accountName}</td>
                    <td
                      style={{
                        fontWeight: 600,
                        color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'
                      }}
                    >
                      {formatCurrency(item.amount)}
                    </td>
                    <td>
                      <span title={note}>{truncateNote(note)}</span>
                    </td>
                    <td className="row">
                      <button type="button" onClick={() => onOpenDetail(item.id)}>
                        详情
                      </button>
                      <Link to={`/transactions/${item.id}`}>
                        <button type="button">编辑</button>
                      </Link>
                      <button type="button" className="danger" onClick={() => onDelete(item.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <small style={{ color: 'var(--color-text-secondary)' }}>
              当前 {filteredTotal} 条 / 全部 {total} 条
            </small>
            <div className="row">
              <button type="button" disabled={page === 1} onClick={onPrevPage}>
                上一页
              </button>
              <small style={{ color: 'var(--color-text-secondary)' }}>
                第 {page} / {pages} 页
              </small>
              <button type="button" disabled={page === pages} onClick={onNextPage}>
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
