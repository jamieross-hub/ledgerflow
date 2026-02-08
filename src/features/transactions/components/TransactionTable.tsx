import { Link } from 'react-router-dom';
import { TransactionItem } from '../../../entities/transaction/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { TableSkeleton } from '../../../shared/ui/TableSkeleton';

const NOTE_MAX_LENGTH = 22;

export type TransactionSortKey = 'date' | 'type' | 'category' | 'account' | 'amount' | 'note';
export type TransactionSortDirection = 'asc' | 'desc';

export interface TransactionQuickFilters {
  date: string;
  type: 'all' | 'income' | 'expense';
  category: string;
  account: string;
  amount: string;
  note: string;
}

function truncateNote(note: string): string {
  if (note.length <= NOTE_MAX_LENGTH) {
    return note;
  }
  return `${note.slice(0, NOTE_MAX_LENGTH)}…`;
}

function sortIndicator(active: boolean, direction: TransactionSortDirection): string {
  if (!active) {
    return '⇅';
  }
  return direction === 'asc' ? '↑' : '↓';
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
  sortKey: TransactionSortKey;
  sortDirection: TransactionSortDirection;
  quickFilters: TransactionQuickFilters;
  onRetry: () => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => void;
  onSortChange: (key: TransactionSortKey) => void;
  onQuickFilterChange: <K extends keyof TransactionQuickFilters>(key: K, value: TransactionQuickFilters[K]) => void;
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
  sortKey,
  sortDirection,
  quickFilters,
  onRetry,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onOpenDetail,
  onDelete,
  onSortChange,
  onQuickFilterChange
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
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'date' ? 'active' : ''}`}
                    onClick={() => onSortChange('date')}
                  >
                    日期 <span>{sortIndicator(sortKey === 'date', sortDirection)}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'type' ? 'active' : ''}`}
                    onClick={() => onSortChange('type')}
                  >
                    类型 <span>{sortIndicator(sortKey === 'type', sortDirection)}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'category' ? 'active' : ''}`}
                    onClick={() => onSortChange('category')}
                  >
                    分类 <span>{sortIndicator(sortKey === 'category', sortDirection)}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'account' ? 'active' : ''}`}
                    onClick={() => onSortChange('account')}
                  >
                    账户 <span>{sortIndicator(sortKey === 'account', sortDirection)}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'amount' ? 'active' : ''}`}
                    onClick={() => onSortChange('amount')}
                  >
                    金额 <span>{sortIndicator(sortKey === 'amount', sortDirection)}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`transaction-sort-btn ${sortKey === 'note' ? 'active' : ''}`}
                    onClick={() => onSortChange('note')}
                  >
                    备注 <span>{sortIndicator(sortKey === 'note', sortDirection)}</span>
                  </button>
                </th>
                <th>操作</th>
              </tr>
              <tr className="transaction-filter-row">
                <th>
                  <input
                    value={quickFilters.date}
                    onChange={(event) => onQuickFilterChange('date', event.target.value)}
                    placeholder="筛选日期"
                  />
                </th>
                <th>
                  <select
                    value={quickFilters.type}
                    onChange={(event) =>
                      onQuickFilterChange('type', event.target.value as TransactionQuickFilters['type'])
                    }
                  >
                    <option value="all">全部</option>
                    <option value="income">收入</option>
                    <option value="expense">支出</option>
                  </select>
                </th>
                <th>
                  <input
                    value={quickFilters.category}
                    onChange={(event) => onQuickFilterChange('category', event.target.value)}
                    placeholder="筛选分类"
                  />
                </th>
                <th>
                  <input
                    value={quickFilters.account}
                    onChange={(event) => onQuickFilterChange('account', event.target.value)}
                    placeholder="筛选账户"
                  />
                </th>
                <th>
                  <input
                    value={quickFilters.amount}
                    onChange={(event) => onQuickFilterChange('amount', event.target.value)}
                    placeholder="筛选金额"
                  />
                </th>
                <th>
                  <input
                    value={quickFilters.note}
                    onChange={(event) => onQuickFilterChange('note', event.target.value)}
                    placeholder="筛选备注"
                  />
                </th>
                <th />
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
