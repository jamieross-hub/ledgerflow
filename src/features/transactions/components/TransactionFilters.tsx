import { useState } from 'react';
import {
  TransactionDatePreset,
  TransactionFilterState,
  TransactionSourceFilter,
  TransactionTypeFilter
} from '../hooks/useTransactionFilters';
import { TransactionColumnKey } from './TransactionTable';
import { BillImportMode } from '../../../shared/lib/billImport';

interface TransactionFiltersProps {
  filters: TransactionFilterState;
  onKeywordChange: (value: string) => void;
  onTypeChange: (value: TransactionTypeFilter) => void;
  onSourceChange: (value: TransactionSourceFilter) => void;
  onDatePresetChange: (value: TransactionDatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
  onExport: () => void;
  onImportWechat: () => void;
  onImportAlipay: () => void;
  importMode: BillImportMode;
  onImportModeChange: (mode: BillImportMode) => void;
  onCheckDuplicates: () => void;
  columnOptions: Array<{ key: TransactionColumnKey; label: string }>;
  visibleColumns: Record<TransactionColumnKey, boolean>;
  onToggleColumn: (key: TransactionColumnKey) => void;
  bulkSelectionEnabled: boolean;
  onToggleBulkSelection: () => void;
  minAvailableDate?: string;
  maxAvailableDate?: string;
  onQuickAdd: () => void;
}

export function TransactionFilters({
  filters,
  onKeywordChange,
  onTypeChange,
  onSourceChange,
  onDatePresetChange,
  onDateFromChange,
  onDateToChange,
  onClear,
  onExport,
  onImportWechat,
  onImportAlipay,
  importMode,
  onImportModeChange,
  onCheckDuplicates,
  columnOptions,
  visibleColumns,
  onToggleColumn,
  bulkSelectionEnabled,
  onToggleBulkSelection,
  minAvailableDate,
  maxAvailableDate,
  onQuickAdd
}: TransactionFiltersProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="panel transaction-filters-panel">
      <h2>交易记录</h2>

      <div className="transaction-filters-primary-row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>关键词</label>
          <input
            placeholder="搜索备注或标签"
            value={filters.keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-filter-type">类型</label>
          <select
            id="tx-filter-type"
            aria-label="按交易类型筛选"
            value={filters.type}
            onChange={(event) => onTypeChange(event.target.value as TransactionTypeFilter)}
          >
            <option value="all">全部</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
            <option value="budget">预算</option>
            <option value="repayment">还款</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tx-filter-date-preset">日期</label>
          <select
            id="tx-filter-date-preset"
            aria-label="按日期范围筛选"
            value={filters.datePreset}
            onChange={(event) => onDatePresetChange(event.target.value as TransactionDatePreset)}
          >
            <option value="all">全部时间</option>
            <option value="thisMonth">本月</option>
            <option value="last3Months">最近三月</option>
            <option value="last30">最近 30 天</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div className="transaction-filters-primary-cta">
          <label style={{ visibility: 'hidden' }}>操作</label>
          <button type="button" className="primary" onClick={onQuickAdd}>
            新增账目
          </button>
        </div>
      </div>

      {filters.datePreset === 'custom' ? (
        <div className="transaction-filters-custom-date-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tx-filter-date-from">开始日期</label>
            <input
              id="tx-filter-date-from"
              aria-label="筛选开始日期"
              type="date"
              min={minAvailableDate}
              max={maxAvailableDate}
              onFocus={(event) => event.currentTarget.showPicker?.()}
              value={filters.dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
            />
            <button
              type="button"
              className="transaction-date-shortcut-btn"
              onClick={() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                  .toISOString()
                  .slice(0, 10);
                onDateFromChange(monthStart);
              }}
            >
              日历开始
            </button>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tx-filter-date-to">结束日期</label>
            <input
              id="tx-filter-date-to"
              aria-label="筛选结束日期"
              type="date"
              min={minAvailableDate}
              max={maxAvailableDate}
              onFocus={(event) => event.currentTarget.showPicker?.()}
              value={filters.dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
            />
            <button
              type="button"
              className="transaction-date-shortcut-btn"
              onClick={() => {
                const today = new Date();
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
                  .toISOString()
                  .slice(0, 10);
                onDateToChange(monthEnd);
              }}
            >
              日历结束
            </button>
          </div>
        </div>
      ) : null}

      <div className="transaction-filters-secondary-row">
        <button
          type="button"
          className={`transaction-filter-trigger ${bulkSelectionEnabled ? 'active' : ''}`}
          onClick={onToggleBulkSelection}
        >
          批量操作
        </button>
        <div className={`transaction-filter-popover ${menuOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="transaction-filter-trigger"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="true"
          >
            筛选与操作
          </button>
          {menuOpen ? (
            <div className="transaction-filter-popover-panel" role="group" aria-label="筛选与操作">
              <p className="transaction-filter-section-title">更多筛选</p>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="tx-filter-source">来源</label>
                <select
                  id="tx-filter-source"
                  aria-label="按来源筛选"
                  value={filters.source}
                  onChange={(event) =>
                    onSourceChange(event.target.value as TransactionSourceFilter)
                  }
                >
                  <option value="all">全部来源</option>
                  <option value="manual">手工录入</option>
                  <option value="wechat">微信导入</option>
                  <option value="alipay">支付宝</option>
                  <option value="ai">AI 记账</option>
                </select>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClear}>
                  清空筛选
                </button>
              </div>

              <div className="transaction-context-divider" />
              <details className="transaction-popover-section" open>
                <summary className="transaction-filter-section-title">显示列</summary>
                <div className="transaction-column-check-grid">
                  {columnOptions.map((option) => (
                    <label key={`filter-col-${option.key}`}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[option.key]}
                        onChange={() => onToggleColumn(option.key)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </details>

              <div className="transaction-context-divider" />
              <details className="transaction-popover-section">
                <summary className="transaction-filter-section-title">更多操作</summary>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label htmlFor="tx-import-mode">账单导入模式</label>
                  <select
                    id="tx-import-mode"
                    aria-label="账单导入模式"
                    value={importMode}
                    onChange={(event) => onImportModeChange(event.target.value as BillImportMode)}
                  >
                    <option value="incremental">增量（跳过重复）</option>
                    <option value="merge">合并（覆盖重复）</option>
                    <option value="overwrite">覆盖（清空后导入）</option>
                  </select>
                </div>
                <div className="transaction-filter-actions-grid">
                  <button type="button" onClick={onExport}>
                    导出 CSV
                  </button>
                  <button type="button" onClick={onImportWechat}>
                    导入微信账单
                  </button>
                  <button type="button" onClick={onImportAlipay}>
                    导入支付宝账单
                  </button>
                  <button type="button" onClick={onCheckDuplicates}>
                    检测重复账单
                  </button>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
