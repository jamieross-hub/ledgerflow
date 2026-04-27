import { formatMoneyByCurrency } from '../../../shared/lib/format';

export interface DashboardAnomalyInsightsProps {
  anomalyInsight: {
    anomalies: string[];
    highlights: string[];
    supportFacts: string[];
  };
  subscriptionAlerts: Array<{
    id: string;
    name: string;
    amount: number;
    currency: string;
    renewalDate?: string;
    expireDate?: string;
    status: string;
  }>;
  onNavigateToSmartBudget: () => void;
  onNavigateToTransactions: () => void;
  onNavigateToSubscriptions: () => void;
}

export function DashboardAnomalyInsights({
  anomalyInsight,
  subscriptionAlerts,
  onNavigateToSmartBudget,
  onNavigateToTransactions,
  onNavigateToSubscriptions
}: DashboardAnomalyInsightsProps) {
  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="dashboard-section-header">
        <h4>异常与亮点概览</h4>
        <span>只展示有数据支撑的重点判断</span>
      </div>

      {anomalyInsight.supportFacts.length > 0 ? (
        <div className="dashboard-anomaly-facts" aria-label="异常亮点支撑数据">
          {anomalyInsight.supportFacts.map((fact) => (
            <span key={fact} className="metric-chip">
              {fact}
            </span>
          ))}
        </div>
      ) : null}

      <div className="dashboard-anomaly-summary-grid">
        <article className="dashboard-anomaly-summary-card">
          <p className="dashboard-anomaly-card-title">⚠️ 异常提醒</p>
          <ul className="dashboard-anomaly-list">
            {anomalyInsight.anomalies.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </article>
        <article className="dashboard-anomaly-summary-card">
          <p className="dashboard-anomaly-card-title">✨ 节省亮点</p>
          <ul className="dashboard-anomaly-list">
            {anomalyInsight.highlights.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="dashboard-anomaly-toolbar">
        <button type="button" onClick={onNavigateToTransactions}>
          查看关联账单
        </button>
        <button type="button" onClick={onNavigateToSmartBudget}>
          去预算页收口
        </button>
      </div>

      {subscriptionAlerts.length > 0 ? (
        <div className="dashboard-subscription-alerts">
          <div className="dashboard-section-header">
            <h4>订阅到期提醒</h4>
            <span>{subscriptionAlerts.length} 项待处理</span>
          </div>
          <div className="dashboard-anomaly-summary-grid" role="list" aria-label="订阅到期提醒">
            {subscriptionAlerts.map((item) => (
              <article key={item.id} role="listitem" className="dashboard-anomaly-summary-card">
                <p className="dashboard-anomaly-card-title">🧾 订阅提醒</p>
                <p className="dashboard-anomaly-card-text">
                  {item.name} ·{' '}
                  {item.expireDate || item.renewalDate
                    ? `日期：${item.expireDate || item.renewalDate}`
                    : '未设置日期'}
                </p>
                <p className="dashboard-anomaly-card-text">
                  {item.status === 'expired' ? '已到期' : '即将到期'} ·{' '}
                  {formatMoneyByCurrency(item.amount, item.currency)}
                </p>
                <div className="dashboard-anomaly-card-actions">
                  <button type="button" onClick={onNavigateToSubscriptions}>
                    去处理
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
