import { Link } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency } from '../../shared/lib/format';

export function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions);

  const currentMonth = new Date().getMonth();
  const monthly = transactions.filter((t) => new Date(t.date).getMonth() === currentMonth);
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthly.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <section className="panel">
        <h2>仪表盘</h2>
        <p>本月收支概览。</p>
        <div className="grid grid-3">
          <div className="panel">
            <h3>本月收入</h3>
            <strong>{formatCurrency(income)}</strong>
          </div>
          <div className="panel">
            <h3>本月支出</h3>
            <strong>{formatCurrency(expense)}</strong>
          </div>
          <div className="panel">
            <h3>结余</h3>
            <strong>{formatCurrency(income - expense)}</strong>
          </div>
        </div>
      </section>

      {transactions.length === 0 ? (
        <section className="panel">
          <h3>暂无账目数据</h3>
          <p>你还没有录入任何交易，点击下方“新增账目”开始记账。</p>
        </section>
      ) : null}

      <section className="panel">
        <h3>分类饼图（占位）</h3>
        <p>当前版本用文字占位，后续可接入 ECharts / Recharts。</p>
      </section>

      <section className="panel">
        <h3>趋势图（占位）</h3>
        <p>当前版本保留趋势区块，便于未来接入真实分析服务。</p>
      </section>

      <Link to="/transactions/new">
        <button className="primary">新增账目</button>
      </Link>
    </div>
  );
}
