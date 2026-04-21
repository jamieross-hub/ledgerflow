import { formatCurrency } from '../../../shared/lib/format';

export interface NetAssetCurveRow {
  label: string;
  value: number;
  delta: number;
}

export interface NetAssetCurveCardProps {
  rows: NetAssetCurveRow[];
  worstDropLabel?: string;
  worstDropDelta?: number;
  onNavigateToMonth: (label: string) => void;
}

export function NetAssetCurveCard({
  rows,
  worstDropLabel,
  worstDropDelta,
  onNavigateToMonth,
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
            key={item.label}
            type="button"
            className={`dashboard-net-row ${worstDropLabel === item.label ? 'is-worst-drop' : ''}`.trim()}
            onClick={() => onNavigateToMonth(item.label)}
          >
            <span>{item.label}</span>
            <i style={{ width: `${(item.value / maxValue) * 100}%` }} />
            <strong>{formatCurrency(item.value)}</strong>
            <small className={item.delta >= 0 ? 'up' : 'down'}>
              Δ {item.delta >= 0 ? '+' : ''}
              {formatCurrency(item.delta)}
            </small>
          </button>
        ))}
      </div>
      {worstDropLabel && typeof worstDropDelta === 'number' ? (
        <p className="dashboard-net-worst-hint">
          最大回撤：{worstDropLabel}（Δ{formatCurrency(worstDropDelta)}），可点击查看该月流水。
        </p>
      ) : null}
    </article>
  );
}
