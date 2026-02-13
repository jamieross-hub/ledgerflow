import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { TransactionItem } from '../../../entities/transaction/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { TableSkeleton } from '../../../shared/ui/TableSkeleton';

const NOTE_MAX_LENGTH = 22;

export type TransactionSortKey =
  | 'date'
  | 'type'
  | 'category'
  | 'account'
  | 'amount'
  | 'orderNo'
  | 'merchantOrderNo'
  | 'note';
export type TransactionSortDirection = 'asc' | 'desc';

export interface TransactionQuickFilters {
  date: string;
  type: 'all' | 'income' | 'expense' | 'budget' | 'repayment';
  category: string;
  account: string;
  amount: string;
  orderNo: string;
  merchantOrderNo: string;
  note: string;
}

function truncateNote(note: string): string {
  if (note.length <= NOTE_MAX_LENGTH) {
    return note;
  }
  return `${note.slice(0, NOTE_MAX_LENGTH)}…`;
}

function truncateOrderNo(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
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

export type TransactionColumnKey =
  | 'date'
  | 'type'
  | 'category'
  | 'account'
  | 'amount'
  | 'orderNo'
  | 'merchantOrderNo'
  | 'note';

interface TransactionTableProps {
  rows: TransactionRowView[];
  total: number;
  filteredTotal: number;
  page: number;
  pages: number;
  pageSize: number;
  pageSizeOptions: number[];
  loading: boolean;
  errorMessage?: string;
  hasFilters: boolean;
  highlightId?: string;
  selectedIds: string[];
  canSelectAllOnPage: boolean;
  allPageSelected: boolean;
  sortKey: TransactionSortKey;
  sortDirection: TransactionSortDirection;
  quickFilters: TransactionQuickFilters;
  onRetry: () => void;
  onClearFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (size: number) => void;
  onOpenDetail: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onToggleSelect: (id: string, selected: boolean) => void;
  onToggleSelectPage: (selected: boolean) => void;
  onSortChange: (key: TransactionSortKey) => void;
  onQuickFilterChange: <K extends keyof TransactionQuickFilters>(
    key: K,
    value: TransactionQuickFilters[K]
  ) => void;
  visibleColumns: Record<TransactionColumnKey, boolean>;
  columnOrder: TransactionColumnKey[];
  onToggleColumn: (key: TransactionColumnKey) => void;
  onColumnReorder: (fromKey: TransactionColumnKey, toKey: TransactionColumnKey) => void;
}

export function TransactionTable({
  rows,
  total,
  filteredTotal,
  page,
  pages,
  pageSize,
  pageSizeOptions,
  loading,
  errorMessage,
  hasFilters,
  highlightId,
  selectedIds,
  canSelectAllOnPage,
  allPageSelected,
  sortKey,
  sortDirection,
  quickFilters,
  onRetry,
  onClearFilters,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  onOpenDetail,
  onDelete,
  onDeleteSelected,
  onClearSelection,
  onToggleSelect,
  onToggleSelectPage,
  onSortChange,
  onQuickFilterChange,
  visibleColumns,
  columnOrder,
  onToggleColumn,
  onColumnReorder
}: TransactionTableProps) {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const dragColumnRef = useRef<TransactionColumnKey | null>(null);

  const navigate = useNavigate();

  const columnOptions: Array<{ key: TransactionColumnKey; label: string }> = [
    { key: 'date', label: '日期' },
    { key: 'type', label: '类型' },
    { key: 'category', label: '分类' },
    { key: 'account', label: '账户' },
    { key: 'amount', label: '金额' },
    { key: 'orderNo', label: '交易订单号' },
    { key: 'merchantOrderNo', label: '商家订单号' },
    { key: 'note', label: '备注' }
  ];

  const orderedColumns = columnOrder
    .map((key) => columnOptions.find((item) => item.key === key))
    .filter((item): item is { key: TransactionColumnKey; label: string } => Boolean(item));

  const renderCellValue = (columnKey: TransactionColumnKey, row: TransactionRowView) => {
    const { item, categoryName, accountName } = row;
    switch (columnKey) {
      case 'date':
        return formatDate(item.date);
      case 'type':
        return item.type === 'income'
          ? '收入'
          : item.type === 'budget'
            ? '预算'
            : item.type === 'repayment'
              ? '还款'
              : '支出';
      case 'category':
        return categoryName;
      case 'account':
        return accountName;
      case 'amount':
        return formatCurrency(item.amount);
      case 'orderNo':
        return item.orderNo || '-';
      case 'merchantOrderNo':
        return item.merchantOrderNo || '-';
      case 'note':
        return truncateNote(item.note || '-');
      default:
        return '-';
    }
  };

  const textFilterKeyMap: Record<
    Exclude<TransactionColumnKey, 'type'>,
    Exclude<keyof TransactionQuickFilters, 'type'>
  > = {
    date: 'date',
    category: 'category',
    account: 'account',
    amount: 'amount',
    orderNo: 'orderNo',
    merchantOrderNo: 'merchantOrderNo',
    note: 'note'
  };

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const onViewportChange = () => setContextMenu(null);

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('keydown', onEscape);
    };
  }, [contextMenu]);

  return (
    <section className="panel">
      {loading ? (
        <TableSkeleton rows={6} columns={8} />
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
          {selectedIds.length > 0 ? (
            <div className="transaction-bulk-bar">
              <strong>已选中 {selectedIds.length} 条</strong>
              <div className="row">
                <button type="button" onClick={onDeleteSelected} className="danger">
                  批量删除
                </button>
                <button type="button" onClick={onClearSelection}>
                  取消选择
                </button>
              </div>
            </div>
          ) : null}

          <div className="transaction-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="transaction-select-col">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(event) => onToggleSelectPage(event.target.checked)}
                      disabled={!canSelectAllOnPage}
                      aria-label="全选当前页"
                    />
                  </th>
                  {orderedColumns.map((column) => {
                    if (!visibleColumns[column.key]) return null;
                    return (
                      <th
                        key={`head-${column.key}`}
                        draggable
                        onDragStart={() => {
                          dragColumnRef.current = column.key;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragColumnRef.current && dragColumnRef.current !== column.key) {
                            onColumnReorder(dragColumnRef.current, column.key);
                          }
                          dragColumnRef.current = null;
                        }}
                      >
                        <button
                          type="button"
                          className={`transaction-sort-btn ${sortKey === column.key ? 'active' : ''}`}
                          onClick={() => onSortChange(column.key)}
                        >
                          {column.label}{' '}
                          <span>{sortIndicator(sortKey === column.key, sortDirection)}</span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
                <tr className="transaction-filter-row">
                  <th className="transaction-select-col" />
                  {orderedColumns.map((column) => {
                    if (!visibleColumns[column.key]) return null;
                    if (column.key === 'type') {
                      return (
                        <th key={`filter-${column.key}`}>
                          <select
                            aria-label="按类型筛选"
                            value={quickFilters.type}
                            onChange={(event) =>
                              onQuickFilterChange(
                                'type',
                                event.target.value as TransactionQuickFilters['type']
                              )
                            }
                          >
                            <option value="all">全部</option>
                            <option value="income">收入</option>
                            <option value="expense">支出</option>
                            <option value="budget">预算</option>
                            <option value="repayment">还款</option>
                          </select>
                        </th>
                      );
                    }
                    return (
                      <th key={`filter-${column.key}`}>
                        <input
                          value={
                            quickFilters[
                              textFilterKeyMap[column.key as Exclude<TransactionColumnKey, 'type'>]
                            ]
                          }
                          onChange={(event) => {
                            const filterKey =
                              textFilterKeyMap[column.key as Exclude<TransactionColumnKey, 'type'>];
                            onQuickFilterChange(filterKey, event.target.value);
                          }}
                          placeholder={`筛选${column.label}`}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, categoryName, accountName }) => {
                  const note = item.note || '-';
                  const checked = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      id={`transaction-row-${item.id}`}
                      className={`transaction-row-clickable ${highlightId === item.id ? 'transaction-row-highlight' : ''}`.trim()}
                      onClick={() => onOpenDetail(item.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        const menuWidth = 280;
                        const menuHeight = 420;
                        const padding = 8;
                        const x = Math.min(event.clientX, window.innerWidth - menuWidth - padding);
                        const y = Math.min(
                          event.clientY,
                          window.innerHeight - menuHeight - padding
                        );
                        setContextMenu({
                          x: Math.max(padding, x),
                          y: Math.max(padding, y),
                          id: item.id
                        });
                      }}
                    >
                      <td
                        className="transaction-select-col"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => onToggleSelect(item.id, event.target.checked)}
                          aria-label={`选择交易 ${formatDate(item.date)} ${item.note || ''}`}
                        />
                      </td>
                      {orderedColumns.map((column) => {
                        if (!visibleColumns[column.key]) return null;
                        if (column.key === 'type') {
                          return (
                            <td key={`${item.id}-${column.key}`}>
                              <span
                                className={
                                  item.type === 'income'
                                    ? 'badge badge-success'
                                    : 'badge badge-danger'
                                }
                              >
                                {renderCellValue(column.key, { item, categoryName, accountName })}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === 'amount') {
                          return (
                            <td
                              key={`${item.id}-${column.key}`}
                              style={{
                                fontWeight: 600,
                                color:
                                  item.type === 'income'
                                    ? 'var(--color-income)'
                                    : 'var(--color-expense)'
                              }}
                            >
                              {renderCellValue(column.key, { item, categoryName, accountName })}
                            </td>
                          );
                        }
                        if (column.key === 'note') {
                          return (
                            <td key={`${item.id}-${column.key}`}>
                              <span title={note}>
                                {renderCellValue(column.key, { item, categoryName, accountName })}
                              </span>
                            </td>
                          );
                        }
                        if (column.key === 'orderNo' || column.key === 'merchantOrderNo') {
                          const orderText = renderCellValue(column.key, {
                            item,
                            categoryName,
                            accountName
                          });
                          return (
                            <td key={`${item.id}-${column.key}`}>
                              <span
                                className="transaction-order-ellipsis"
                                title={String(orderText)}
                              >
                                {orderText === '-' ? '-' : truncateOrderNo(String(orderText))}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={`${item.id}-${column.key}`}>
                            {renderCellValue(column.key, { item, categoryName, accountName })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="transaction-mobile-list" aria-label="移动端交易列表">
            {rows.map(({ item, categoryName, accountName }) => {
              const note = item.note || '（无备注）';
              const isSwiped = swipedId === item.id;
              return (
                <article
                  key={`mobile-${item.id}`}
                  className={`transaction-mobile-item ${isSwiped ? 'is-swiped' : ''}`.trim()}
                  onClick={() => {
                    if (swipedId === item.id) {
                      setSwipedId(null);
                      return;
                    }
                    onOpenDetail(item.id);
                  }}
                  onTouchStart={(event) => {
                    touchStartXRef.current = event.touches[0]?.clientX ?? null;
                    if (swipedId && swipedId !== item.id) {
                      setSwipedId(null);
                    }
                  }}
                  onTouchEnd={(event) => {
                    const start = touchStartXRef.current;
                    const end = event.changedTouches[0]?.clientX;
                    touchStartXRef.current = null;
                    if (start === null || end === undefined) {
                      return;
                    }
                    const delta = end - start;
                    if (delta < -44) {
                      setSwipedId(item.id);
                    } else if (delta > 32 && swipedId === item.id) {
                      setSwipedId(null);
                    }
                  }}
                >
                  <div className="transaction-mobile-swipe">
                    <div className="transaction-mobile-main">
                      <header>
                        <span
                          className={
                            item.type === 'income' ? 'badge badge-success' : 'badge badge-danger'
                          }
                        >
                          {item.type === 'income'
                            ? '收入'
                            : item.type === 'budget'
                              ? '预算'
                              : item.type === 'repayment'
                                ? '还款'
                                : '支出'}
                        </span>
                        <strong>{formatCurrency(item.amount)}</strong>
                      </header>
                      <p>{note}</p>
                      {item.orderNo || item.merchantOrderNo ? (
                        <small>
                          交易订单：{item.orderNo || '-'} · 商家订单：{item.merchantOrderNo || '-'}
                        </small>
                      ) : null}
                      <small>
                        {formatDate(item.date)} · {categoryName} · {accountName}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="danger transaction-mobile-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSwipedId(null);
                        onDelete(item.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {contextMenu
            ? createPortal(
                <div
                  ref={contextMenuRef}
                  className="transaction-context-menu"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onClick={(event) => event.stopPropagation()}
                  aria-label="交易右键菜单"
                >
                  <button
                    type="button"
                    className="transaction-context-item"
                    onClick={() => {
                      navigate(`/transactions/${contextMenu.id}`);
                      setContextMenu(null);
                    }}
                  >
                    编辑账单
                  </button>
                  <button
                    type="button"
                    className="transaction-context-item danger"
                    onClick={() => {
                      onDelete(contextMenu.id);
                      setContextMenu(null);
                    }}
                  >
                    删除账单
                  </button>
                  <div className="transaction-context-divider" />
                  <p className="transaction-context-title">列显示设置</p>
                  <div className="transaction-context-columns">
                    {columnOptions.map((option) => (
                      <label key={`ctx-${option.key}`}>
                        <input
                          type="checkbox"
                          checked={visibleColumns[option.key]}
                          onChange={() => onToggleColumn(option.key)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>,
                document.body
              )
            : null}

          <div
            className="row transaction-pagination"
            style={{ marginTop: 12, justifyContent: 'space-between' }}
          >
            <small style={{ color: 'var(--color-text-secondary)' }}>
              当前 {filteredTotal} 条 / 全部 {total} 条
            </small>
            <div className="row transaction-pagination-controls">
              <label className="transaction-page-size">
                每页
                <select
                  aria-label="每页显示条数"
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={`page-size-${size}`} value={size}>
                      {size} 条
                    </option>
                  ))}
                </select>
              </label>
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
