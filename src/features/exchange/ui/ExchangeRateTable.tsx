import { useState } from 'react';
import type { ExchangeRate } from '../model/types';
import { getCurrencyFlag, getCurrencyName } from '../model/types';

interface ExchangeRateTableProps {
  rates: ExchangeRate[];
  base: string;
  date: string;
  fromCache: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;
const COMMON_CODES = [
  'CNY',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'HKD',
  'SGD',
  'AUD',
  'CAD',
  'CHF',
  'KRW',
  'INR',
  'RUB',
  'THB',
  'MYR',
  'IDR',
  'PHP',
  'VND',
  'TWD',
  'NZD',
  'AED',
  'SAR'
];

const TREND_ICON: Record<NonNullable<ExchangeRate['trend']>, string> = {
  up: '⬆️',
  down: '⬇️',
  flat: '⟷'
};

const TREND_LABEL: Record<NonNullable<ExchangeRate['trend']>, string> = {
  up: '上涨',
  down: '下跌',
  flat: '持平'
};

export function ExchangeRateTable({
  rates,
  base,
  date,
  fromCache,
  loading,
  error,
  onRefresh
}: ExchangeRateTableProps) {
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ledgerflow-fav-currencies') || '[]');
    } catch {
      return [];
    }
  });
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const toggleFavorite = (code: string) => {
    setFavorites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      localStorage.setItem('ledgerflow-fav-currencies', JSON.stringify(next));
      return next;
    });
  };

  const keyword = search.trim().toLowerCase();
  const filtered = rates.filter(
    (r) => r.code.toLowerCase().includes(keyword) || r.name.toLowerCase().includes(keyword)
  );

  // 收藏置顶
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.includes(a.code) ? 0 : 1;
    const bFav = favorites.includes(b.code) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.code.localeCompare(b.code);
  });

  const defaultVisible = sorted.filter(
    (item) => favorites.includes(item.code) || COMMON_CODES.includes(item.code)
  );
  const displayRows = showAll ? sorted : defaultVisible;

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = displayRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      {/* 工具栏 */}
      <div className="exchange-toolbar">
        <input
          className="exchange-search"
          placeholder="搜索货币代码或名称…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <span className="exchange-meta">
          基准: {getCurrencyFlag(base)} {base} ({getCurrencyName(base)}){date ? ` · ${date}` : ''}
          {fromCache ? ' · 📦 缓存' : ' · 🌐 已同步最新'}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowAll((prev) => !prev);
            setPage(1);
          }}
          title={showAll ? '仅显示常见货币（含收藏）' : '展开显示全部货币'}
        >
          {showAll ? '收起非常见货币' : '展开全部货币'}
        </button>
        <button onClick={onRefresh} disabled={loading} title="刷新汇率">
          🔄 {loading ? '加载中…' : '刷新'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="exchange-error">
          ⚠️ {error}
          <button onClick={onRefresh} style={{ marginLeft: 8 }}>
            重试
          </button>
        </div>
      )}

      {/* 表格 */}
      <table className="exchange-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>⭐</th>
            <th>货币</th>
            <th>货币名称</th>
            <th style={{ textAlign: 'right' }}>汇率 (1 {base})</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-tertiary)' }}
              >
                {loading
                  ? '加载中…'
                  : showAll
                    ? '无匹配货币'
                    : '当前仅展示常见货币（含收藏），可点击“展开全部货币”查看全部'}
              </td>
            </tr>
          ) : (
            pageRows.map((r) => (
              <tr key={r.code} className={favorites.includes(r.code) ? 'exchange-row-fav' : ''}>
                <td>
                  <button
                    className="exchange-fav-btn"
                    onClick={() => toggleFavorite(r.code)}
                    title={favorites.includes(r.code) ? '取消收藏' : '收藏'}
                  >
                    {favorites.includes(r.code) ? '⭐' : '☆'}
                  </button>
                </td>
                <td className="mono-inline">
                  {getCurrencyFlag(r.code)} {r.code}
                </td>
                <td>{r.name}</td>
                <td style={{ textAlign: 'right' }} className="mono-inline">
                  <span>{r.rate.toFixed(r.rate < 1 ? 6 : 4)}</span>
                  {r.trend ? (
                    <span className={`exchange-rate-trend exchange-rate-trend-${r.trend}`}>
                      {TREND_ICON[r.trend]} {TREND_LABEL[r.trend]}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="exchange-pagination">
          <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            上一页
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
