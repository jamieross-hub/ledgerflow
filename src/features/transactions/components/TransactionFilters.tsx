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
    <section className="panel">
      <h2>交易记录</h2>

      <div className="transaction-filters-grid">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>关键词</label>
          <input
            placeholder="搜索备注或标签"
            value={filters.keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>类型</label>
          <select value={filters.type} onChange={(event) => onTypeChange(event.target.value as TransactionTypeFilter)}>
            <option value="all">全部</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
            <option value="budget">预算</option>
            <option value="repayment">还款</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>来源</label>
          <select
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

        <div className="field" style={{ marginBottom: 0 }}>
          <label>日期</label>
          <select
            value={filters.datePreset}
            onChange={(event) => onDatePresetChange(event.target.value as TransactionDatePreset)}
          >
            <option value="all">全部时间</option>
            <option value="thisMonth">本月</option>
            <option value="last30">最近 30 天</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        {filters.datePreset === 'custom' ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>开始日期</label>
              <input type="date" value={filters.dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>结束日期</label>
              <input type="date" value={filters.dateTo} onChange={(event) => onDateToChange(event.target.value)} />
            </div>
          </>
        ) : null}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" onClick={onExport}>
          导出 CSV
        </button>
        <button type="button" onClick={onImportWechat}>
          导入微信账单
        </button>
        <button type="button" onClick={onImportAlipay}>
          导入支付宝账单
        </button>
        <button type="button" onClick={onClear}>
          清空筛选
        </button>
        <Link to="/transactions/new">
          <button className="primary">新增账目</button>
        </Link>
      </div>
    </section>
  );
}
