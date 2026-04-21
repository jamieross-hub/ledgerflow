import { formatCurrency } from '../../../shared/lib/format';

export interface DashboardHistoryCompareCardProps {
  previousMonthExpense: number;
  quarterExpense: number;
  yearlyExpense: number;
  profile?: {
    timePreference: string;
    topMerchant: string;
    personality: string;
    crowdCompare: string;
  };
  monthlyInsightStatus: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
}

export function DashboardHistoryCompareCard({
  previousMonthExpense,
  quarterExpense,
  yearlyExpense,
  profile,
  monthlyInsightStatus,
}: DashboardHistoryCompareCardProps) {
  return (
    <article className="panel" style={{ marginTop: 12 }}>
      <div className="dashboard-section-header">
        <h3>历史对比与消费画像</h3>
        <span>少字显示 · 金额优先</span>
      </div>

      <div className="grid grid-2 dashboard-history-profile-grid" style={{ gap: 12 }}>
        <section className="panel dashboard-history-card" style={{ margin: 0 }}>
          <h4>历史对比</h4>
          <div className="dashboard-history-metrics dashboard-history-metrics--compact">
            <article>
              <span>上月</span>
              <strong className="expense">{formatCurrency(previousMonthExpense)}</strong>
            </article>
            <article>
              <span>本季</span>
              <strong className="expense">{formatCurrency(quarterExpense)}</strong>
            </article>
            <article>
              <span>本年</span>
              <strong className="expense">{formatCurrency(yearlyExpense)}</strong>
            </article>
          </div>
        </section>

        <section className="panel dashboard-profile-card" style={{ margin: 0 }}>
          <h4>消费画像</h4>
          <div className="dashboard-profile-tags dashboard-profile-tags--compact">
            <span>时段：{profile?.timePreference || '暂无'}</span>
            <span>商家：{profile?.topMerchant || '暂无'}</span>
            <span>风格：{profile?.personality || '暂无'}</span>
            <span>对比：{profile?.crowdCompare || '暂无'}</span>
          </div>
          {monthlyInsightStatus !== 'done' ? (
            <p className="dashboard-ai-error dashboard-profile-tip" style={{ marginTop: 8 }}>
              暂无 AI 画像
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}
