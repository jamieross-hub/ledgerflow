import { formatCurrency } from '../../../shared/lib/format';

export interface NetAssetCurveRow {
  key: string;
  label: string;
  value: number;
  delta: number;
  dateFrom: string;
  dateTo: string;
  isCurrent?: boolean;
}

export interface NetAssetCurveCardProps {
  rows: NetAssetCurveRow[];
  worstDropKey?: string;
  worstDropDelta?: number;
  onNavigateToMonth: (dateFrom: string, dateTo: string) => void;
}

export function NetAssetCurveCard({
  rows,
  worstDropKey,
  worstDropDelta,
  onNavigateToMonth
}: NetAssetCurveCardProps) {
  const maxValue = Math.max(...rows.map((item) => item.value), 1);

  return (
    <article className="panel dashboard-unified-card" style={{ margin: 0 }}>
      <div className="dashboard-section-header dashboard-section-header-tight">
        <h4>累计净资产曲线（含每月Δ）</h4>
      </div>
      <div className="dashboard-net-curve">
        {rows.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dashboard-net-row ${worstDropKey === item.key ? 'is-worst-drop' : ''} ${
              item.isCurrent ? 'is-current' : ''
            }`.trim()}
            onClick={() => onNavigateToMonth(item.dateFrom, item.dateTo)}
          >
            <span className="dashboard-net-row-label">
              {item.label}
              {item.isCurrent ? <em>当前</em> : null}
            </span>
            <i style={{ width: `${(item.value / maxValue) * 100}%` }} />
            <strong>{formatCurrency(item.value)}</strong>
            <small className={item.delta >= 0 ? 'up' : 'down'}>
              Δ {item.delta >= 0 ? '+' : ''}
              {formatCurrency(item.delta)}
            </small>
          </button>
        ))}
      </div>
      {worstDropKey && typeof worstDropDelta === 'number' ? (
        <p className="dashboard-net-worst-hint">
          最大回撤：{formatCurrency(worstDropDelta)}，可点击对应月份查看当月流水。
        </p>
      ) : null}
    </article>
  );
}
