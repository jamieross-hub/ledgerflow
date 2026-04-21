import { formatCurrency } from '../../../shared/lib/format';

export interface DashboardTopTransactionsCardProps {
  items: Array<{
    date: string;
    category: string;
    note: string;
    amount: number;
  }>;
}

export function DashboardTopTransactionsCard({ items }: DashboardTopTransactionsCardProps) {
  return (
    <div className="dashboard-core-top-list">
      <div className="dashboard-section-header">
        <h4>重点账目</h4>
        <span>金额 TOP {items.length}</span>
      </div>
      <div className="dashboard-top-list">
        {items.map((item, index) => (
          <article key={`${item.date}-${index}`} className="dashboard-top-item">
            <div>
              <p className="dashboard-top-title">
                {item.category || '未分类'} · {item.date}
              </p>
              <p className="dashboard-top-note">{item.note || '无备注'}</p>
            </div>
            <strong>{formatCurrency(item.amount)}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}
