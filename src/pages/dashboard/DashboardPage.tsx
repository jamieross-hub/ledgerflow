import { Link } from 'react-router-dom';
import { DebugLogPanel } from '../../features/debug-log/ui/DebugLogPanel';
import { formatCurrency } from '../../shared/lib/format';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { EmptyState } from '../../shared/ui/EmptyState';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了，注意休息';
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const QUICK_ACTIONS = [
  { to: '/transactions/new', icon: '✏️', label: '记一笔', desc: '快速添加收入或支出' },
  { to: '/assistant', icon: '🤖', label: '记账助手', desc: 'AI 智能识别账单' },
  { to: '/transactions', icon: '📋', label: '账目列表', desc: '查看所有交易记录' },
  { to: '/categories-accounts', icon: '🏷️', label: '分类管理', desc: '管理分类与账户' }
];

const TIPS = [
  '你可以在记账助手中粘贴账单截图，AI 会自动识别并生成记账数据',
  '支持拖拽图片到记账助手，快速识别消费信息',
  '在设置页面可以配置 AI 供应商和 API Key',
  '所有数据存储在浏览器本地，你的隐私完全受保护',
  '支持导出 CSV 文件，方便在 Excel 中进一步分析',
  '试试暗黑模式，在侧边栏底部的主题切换器中选择'
];

export function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const accounts = useFinanceStore((s) => s.accounts);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthly = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthly.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const monthlyBalance = income - expense;

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance ?? a.initialBalance ?? 0), 0);
  const liabilities = accounts
    .filter((a) => a.type === 'credit' || a.type === 'liability')
    .reduce((sum, a) => sum + Math.abs(Number(a.balance ?? a.initialBalance ?? 0)), 0);
  const netAssets = totalBalance - liabilities;

  const recentMonths = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(currentYear, currentMonth - (5 - i), 1);
    const key = monthKey(d);
    const rows = transactions.filter((t) => monthKey(new Date(t.date)) === key);
    const mIncome = rows.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const mExpense = rows.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const shortLabel = `${d.getMonth() + 1}月`;
    return { key, shortLabel, income: mIncome, expense: mExpense, balance: mIncome - mExpense };
  });

  const trend = recentMonths.map((m) => m.balance);
  const avgTrend = trend.length > 0 ? trend.reduce((s, n) => s + n, 0) / trend.length : 0;
  const slope = trend.length >= 2 ? trend[trend.length - 1] - trend[0] : 0;
  const projectedNextMonth = Math.max(-99999999, monthlyBalance + avgTrend * 0.35 + slope * 0.25);

  const futureInsight =
    projectedNextMonth >= 0
      ? `预计下月结余约 ${formatCurrency(projectedNextMonth)}，现金流偏稳。建议继续保持当前支出节奏。`
      : `预计下月可能出现 ${formatCurrency(Math.abs(projectedNextMonth))} 的结余缺口，建议提前压缩可选消费。`;

  const tipIndex = new Date().getDate() % TIPS.length;

  return (
    <div>
      <section className="welcome-banner">
        <div className="welcome-content">
          <h2 className="welcome-greeting">{getGreeting()}，欢迎使用 LedgerFlow</h2>
          <p className="welcome-subtitle">你的智能记账工作台已就绪，轻松管理每一笔收支。</p>
          <p className="welcome-tip">💡 {TIPS[tipIndex]}</p>
        </div>
        <div className="welcome-emoji">💰</div>
      </section>

      <section className="panel">
        <h2>核心资产仪表盘</h2>
        <div className="grid grid-3">
          <div className="stat-card stat-balance">
            <span className="stat-icon">🧭</span>
            <div>
              <h3>净资产</h3>
              <strong className="stat-value">{formatCurrency(netAssets)}</strong>
            </div>
          </div>
          <div className="stat-card stat-income">
            <span className="stat-icon">💎</span>
            <div>
              <h3>本月结余</h3>
              <strong className="stat-value">{formatCurrency(monthlyBalance)}</strong>
            </div>
          </div>
          <div className="stat-card stat-expense">
            <span className="stat-icon">📄</span>
            <div>
              <h3>负债</h3>
              <strong className="stat-value">{formatCurrency(liabilities)}</strong>
            </div>
          </div>
        </div>
      </section>

      {transactions.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="📝"
            title="还没有任何账目记录"
            description="开始你的第一笔记账吧，也可以让 AI 助手帮你识别账单。"
            secondaryAction={{
              label: '找 AI 助手',
              onClick: () => {
                window.location.href = '/assistant';
              }
            }}
            primaryAction={{
              label: '记一笔',
              variant: 'primary',
              onClick: () => {
                window.location.href = '/transactions/new';
              }
            }}
          />
        </section>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <section className="panel">
            <h3>本月趋势</h3>
            <div className="dashboard-trend-list" aria-label="近 6 个月收支趋势">
              {recentMonths.map((item) => (
                <article key={item.key} className="dashboard-trend-item">
                  <strong>{item.shortLabel}</strong>
                  <span className="mono-inline">收入 {formatCurrency(item.income)}</span>
                  <span className="mono-inline">支出 {formatCurrency(item.expense)}</span>
                  <span className="mono-inline">结余 {formatCurrency(item.balance)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>未来趋势（AI自动分析）</h3>
            <p className="dashboard-ai-badge">AI 趋势引擎（本地规则模拟）</p>
            <p className="dashboard-future-text">{futureInsight}</p>
            <p className="dashboard-future-tip">该分析基于近 6 个月收支波动、近期斜率与本月表现进行预测，可作为预算参考。</p>
          </section>
        </div>
      )}

      <h2 style={{ margin: '24px 0 12px', fontSize: 'var(--font-lg)', fontWeight: 600 }}>快捷操作</h2>
      <div className="grid grid-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="quick-action-card">
            <span className="quick-action-icon">{action.icon}</span>
            <strong className="quick-action-label">{action.label}</strong>
            <span className="quick-action-desc">{action.desc}</span>
          </Link>
        ))}
      </div>

      <DebugLogPanel />
    </div>
  );
}
