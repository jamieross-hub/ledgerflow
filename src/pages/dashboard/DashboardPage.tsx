import { Link } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency } from '../../shared/lib/format';

/** 根据当前小时返回问候语 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '🌙 夜深了，注意休息';
  if (hour < 9) return '🌅 早上好';
  if (hour < 12) return '☀️ 上午好';
  if (hour < 14) return '🍱 中午好';
  if (hour < 18) return '🌤️ 下午好';
  if (hour < 22) return '🌆 晚上好';
  return '🌙 夜深了，注意休息';
}

const QUICK_ACTIONS = [
  { to: '/transactions/new', icon: '✏️', label: '记一笔', desc: '快速添加收入或支出' },
  { to: '/assistant', icon: '🤖', label: '记账助手', desc: 'AI 智能识别账单' },
  { to: '/transactions', icon: '📋', label: '账目列表', desc: '查看所有交易记录' },
  { to: '/categories-accounts', icon: '🏷️', label: '分类管理', desc: '管理分类与账户' }
];

const TIPS = [
  '💡 小贴士：你可以在记账助手中粘贴账单截图，AI 会自动识别并生成记账数据',
  '💡 小贴士：支持拖拽图片到记账助手，快速识别消费信息',
  '💡 小贴士：在设置页面可以配置 AI 供应商和 API Key',
  '💡 小贴士：所有数据存储在浏览器本地，你的隐私完全受保护 🔒',
  '💡 小贴士：支持导出 CSV 文件，方便在 Excel 中进一步分析',
  '💡 小贴士：试试暗黑模式，在右上角主题切换器中选择 🌙'
];

export function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions);

  const currentMonth = new Date().getMonth();
  const monthly = transactions.filter((t) => new Date(t.date).getMonth() === currentMonth);
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthly.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const tipIndex = new Date().getDate() % TIPS.length;

  return (
    <div>
      {/* ===== 欢迎横幅 ===== */}
      <section className="welcome-banner">
        <div className="welcome-content">
          <h2 className="welcome-greeting">{getGreeting()}，欢迎使用 LedgerFlow ✨</h2>
          <p className="welcome-subtitle">
            🎯 你的智能记账工作台已就绪 — 轻松管理每一笔收支，让财务一目了然
          </p>
          <p className="welcome-tip">{TIPS[tipIndex]}</p>
        </div>
        <div className="welcome-emoji">💰</div>
      </section>

      {/* ===== 本月收支概览 ===== */}
      <section className="panel">
        <h2>📊 本月收支概览</h2>
        <div className="grid grid-3">
          <div className="stat-card stat-income">
            <span className="stat-icon">📈</span>
            <div>
              <h3>本月收入</h3>
              <strong className="stat-value">{formatCurrency(income)}</strong>
            </div>
          </div>
          <div className="stat-card stat-expense">
            <span className="stat-icon">📉</span>
            <div>
              <h3>本月支出</h3>
              <strong className="stat-value">{formatCurrency(expense)}</strong>
            </div>
          </div>
          <div className="stat-card stat-balance">
            <span className="stat-icon">💎</span>
            <div>
              <h3>结余</h3>
              <strong className="stat-value">{formatCurrency(income - expense)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 空态引导 ===== */}
      {transactions.length === 0 ? (
        <section className="panel empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>还没有任何账目记录</h3>
          <p>开始你的第一笔记账吧！可以手动添加，也可以让 AI 助手帮你识别账单 🚀</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Link to="/transactions/new">
              <button className="primary">✏️ 记一笔</button>
            </Link>
            <Link to="/assistant">
              <button>🤖 找 AI 助手</button>
            </Link>
          </div>
        </section>
      ) : null}

      {/* ===== 快捷操作 ===== */}
      <h2 style={{ margin: '20px 0 12px' }}>⚡ 快捷操作</h2>
      <div className="grid grid-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="quick-action-card">
            <span className="quick-action-icon">{action.icon}</span>
            <strong className="quick-action-label">{action.label}</strong>
            <span className="quick-action-desc">{action.desc}</span>
          </Link>
        ))}
      </div>

      {/* ===== 占位区块 ===== */}
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="panel">
          <h3>🥧 分类饼图（占位）</h3>
          <p style={{ color: 'color-mix(in srgb, var(--text) 60%, transparent)', fontSize: 13 }}>
            当前版本用文字占位，后续可接入 ECharts / Recharts 实现可视化分析 📊
          </p>
        </section>

        <section className="panel">
          <h3>📈 趋势图（占位）</h3>
          <p style={{ color: 'color-mix(in srgb, var(--text) 60%, transparent)', fontSize: 13 }}>
            保留趋势区块，便于未来接入真实分析服务，追踪你的消费习惯 🔍
          </p>
        </section>
      </div>
    </div>
  );
}
