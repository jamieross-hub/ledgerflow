import { formatMoneyByCurrency } from '../../../shared/lib/format';

export interface DashboardAnomalyInsightsProps {
  anomalyInsight: {
    anomalies: string[];
    highlights: string[];
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
  onNavigateToRepaymentManagement: () => void;
  onNavigateToDashboard: () => void;
  onNavigateToSubscriptions: () => void;
}

export function DashboardAnomalyInsights({
  anomalyInsight,
  subscriptionAlerts,
  onNavigateToSmartBudget,
  onNavigateToTransactions,
  onNavigateToRepaymentManagement,
  onNavigateToDashboard,
  onNavigateToSubscriptions,
}: DashboardAnomalyInsightsProps) {
  const insightCards = [
    ...anomalyInsight.anomalies.map((text) => ({ kind: 'warning' as const, text })),
    ...anomalyInsight.highlights.map((text) => ({ kind: 'highlight' as const, text })),
  ].slice(0, 6);

  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="dashboard-section-header">
        <h4>异常提醒与亮点分析</h4>
        <span>卡片滚动 · 可直接执行动作</span>
      </div>
      <div className="dashboard-anomaly-carousel" role="list" aria-label="异常提醒与亮点卡片">
        {insightCards.map((card, index) => (
          <article key={`${card.kind}-${index}`} role="listitem" className="dashboard-anomaly-card">
            <p className="dashboard-anomaly-card-title">
              {card.kind === 'warning' ? '⚠️ 异常提醒' : '✨ 节省亮点'}
            </p>
            <p className="dashboard-anomaly-card-text">{card.text}</p>
            <div className="dashboard-anomaly-card-actions">
              <button type="button" onClick={onNavigateToSmartBudget}>
                生成节支任务
              </button>
              <button type="button" onClick={onNavigateToTransactions}>
                查看关联账单
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-scenario-entries" role="list" aria-label="智能场景入口">
        <button type="button" role="listitem" onClick={onNavigateToRepaymentManagement}>
          <strong>本月还款压力</strong>
          <span>AI 发现近期还款占比偏高，建议优先排期高息负债。</span>
          <em>AI评估</em>
        </button>
        <button type="button" role="listitem" onClick={onNavigateToDashboard}>
          <strong>下个月账单预测</strong>
          <span>结合趋势预测，提前预留现金流避免月中吃紧。</span>
          <em>AI评估</em>
        </button>
        <button type="button" role="listitem" onClick={onNavigateToTransactions}>
          <strong>近期大额支出提醒</strong>
          <span>发现可疑大额支出，建议核查是否重复记账。</span>
          <em>手动可复核</em>
        </button>
      </div>

      {subscriptionAlerts.length > 0 ? (
        <div className="dashboard-subscription-alerts">
          <div className="dashboard-section-header">
            <h4>订阅到期提醒</h4>
            <span>{subscriptionAlerts.length} 项待处理</span>
          </div>
          <div className="dashboard-anomaly-carousel" role="list" aria-label="订阅到期提醒">
            {subscriptionAlerts.map((item) => (
              <article key={item.id} role="listitem" className="dashboard-anomaly-card">
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
