import { Link } from 'react-router-dom';
import {
  TransactionDatePreset,
  TransactionFilterState,
  TransactionSourceFilter,
  TransactionTypeFilter
} from '../hooks/useTransactionFilters';

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
  onImportAlipay
}: TransactionFiltersProps) {
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
            <option value="last30">最近 30 天</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div className="transaction-filters-primary-cta">
          <label style={{ visibility: 'hidden' }}>操作</label>
          <Link to="/transactions/new">
            <button className="primary">新增账目</button>
          </Link>
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
              value={filters.dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tx-filter-date-to">结束日期</label>
            <input
              id="tx-filter-date-to"
              aria-label="筛选结束日期"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="transaction-filters-secondary-row">
        <details className="transaction-filter-popover">
          <summary>更多筛选</summary>
          <div className="transaction-filter-popover-panel" role="group" aria-label="更多筛选项">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="tx-filter-source">来源</label>
              <select
                id="tx-filter-source"
                aria-label="按来源筛选"
                value={filters.source}
                onChange={(event) => onSourceChange(event.target.value as TransactionSourceFilter)}
              >
                <option value="all">全部来源</option>
                <option value="manual">手工录入</option>
                <option value="wechat">微信导入</option>
                <option value="alipay">支付宝导入</option>
                <option value="ai">AI 记账</option>
              </select>
            </div>
            <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClear}>
                清空筛选
              </button>
            </div>
          </div>
        </details>

        <details className="transaction-filter-popover">
          <summary>更多操作</summary>
          <div className="transaction-filter-popover-panel" role="group" aria-label="更多操作项">
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
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
