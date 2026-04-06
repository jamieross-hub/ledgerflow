import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../shared/lib/format';

export interface MonthlyInsightPanelProps {
  anomalyInsight: {
    anomalies: string[];
    highlights: string[];
  };
  subscriptionAlerts: Array<{
    id: string;
    name: string;
    amount: number;
    nextRenewal: string;
    status: 'due-soon' | 'active' | 'expired';
  }>;
  displayTopTransactions: Array<{
    date: string;
    category: string;
    note: string;
    amount: number;
  }>;
  onNavigateToTransactions: () => void;
}

export function MonthlyInsightPanel({
  anomalyInsight,
  subscriptionAlerts,
  displayTopTransactions,
  onNavigateToTransactions,
}: MonthlyInsightPanelProps) {
  const { t } = useTranslation();

  const insightCards = [
    ...anomalyInsight.anomalies.map((text) => ({ kind: 'warning' as const, text })),
    ...anomalyInsight.highlights.map((text) => ({ kind: 'highlight' as const, text })),
  ].slice(0, 6);

  return (
    <section key="anomaly-insights" className="panel" style={{ marginTop: 12 }}>
      <div className="dashboard-section-header">
        <h4>{t('dashboard.ui.anomalyAndHighlight')}</h4>
        <span>{t('dashboard.ui.cardScrollHint')}</span>
      </div>
      <div className="dashboard-anomaly-carousel" role="list" aria-label={t('dashboard.ui.anomalyCardList')}>
        {insightCards.map((card, index) => (
          <article key={`${card.kind}-${index}`} role="listitem" className="dashboard-anomaly-card">
            <p className="dashboard-anomaly-card-title">
              {card.kind === 'warning'
                ? t('dashboard.ui.anomalyAlert')
                : t('dashboard.ui.savingHighlight')}
            </p>
            <p className="dashboard-anomaly-card-text">{card.text}</p>
            <div className="dashboard-anomaly-card-actions">
              <button type="button" onClick={onNavigateToTransactions}>
                {t('dashboard.ui.generateSavingTask')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {subscriptionAlerts.length > 0 ? (
        <div className="dashboard-subscription-alerts" style={{ marginTop: 12 }}>
          <h5 className="dashboard-subscription-alerts-title">
            {t('dashboard.ui.subscriptionAlerts')}
          </h5>
          <div className="dashboard-subscription-alert-list">
            {subscriptionAlerts.map((item) => (
              <article key={item.id} className="dashboard-subscription-alert">
                <div className="dashboard-subscription-alert-main">
                  <strong>{item.name}</strong>
                  <small>
                    {item.nextRenewal} · {formatCurrency(item.amount)}
                  </small>
                </div>
                <span className={`dashboard-subscription-alert-status is-${item.status}`}>
                  {item.status === 'due-soon'
                    ? t('dashboard.ui.dueSoon')
                    : item.status === 'expired'
                    ? t('dashboard.ui.expired')
                    : t('dashboard.ui.active')}
                </span>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-top-list" style={{ marginTop: 12 }}>
        <h5 className="dashboard-top-list-title">{t('dashboard.ui.topTransactions')}</h5>
        {displayTopTransactions.map((item, index) => (
          <article key={`${item.date}-${index}`} className="dashboard-top-item">
            <div>
              <p className="dashboard-top-title">
                {item.category || t('dashboard.ui.uncategorized')} · {item.date}
              </p>
              <p className="dashboard-top-note">{item.note || t('dashboard.ui.noNote')}</p>
            </div>
            <strong>{formatCurrency(item.amount)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
