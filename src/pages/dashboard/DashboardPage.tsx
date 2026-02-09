import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { DebugLogPanel } from '../../features/debug-log/ui/DebugLogPanel';
import { formatCurrency } from '../../shared/lib/format';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { EmptyState } from '../../shared/ui/EmptyState';

interface ForecastPayload {
  summary: string;
  points: number[];
  suggestions: string[];
}

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

function monthLabel(date: Date): string {
  return `${date.getMonth() + 1}月`;
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const FORECAST_CACHE_KEY = 'dashboard_forecast_cache_v1';

function normalizeForecastPayload(raw: unknown, fallback: number): ForecastPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<ForecastPayload>;
  const points = Array.isArray(parsed.points)
    ? parsed.points.slice(0, 3).map((n) => toSafeNumber(n, fallback))
    : [fallback, fallback, fallback];
  const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
    ? parsed.summary.trim()
    : '模型已完成分析，建议结合预算目标跟踪未来三个月现金流。';
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.slice(0, 3).map((item) => String(item).trim()).filter(Boolean)
    : [];
  return { summary, points, suggestions };
}

function readForecastCache(fallback: number): { payload: ForecastPayload; updatedAt: string } | null {
  try {
    const raw = localStorage.getItem(FORECAST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: unknown; updatedAt?: unknown };
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
    const payload = normalizeForecastPayload(parsed.payload, fallback);
    if (!payload || !updatedAt) return null;
    return { payload, updatedAt };
  } catch {
    return null;
  }
}

function saveForecastCache(payload: ForecastPayload, updatedAt: string) {
  try {
    localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify({ payload, updatedAt }));
  } catch {
    // ignore cache errors
  }
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
  const categories = useFinanceStore((s) => s.categories);

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);

  const [forecast, setForecast] = useState<ForecastPayload | null>(null);
  const [forecastStatus, setForecastStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [forecastError, setForecastError] = useState('');
  const [forecastUpdatedAt, setForecastUpdatedAt] = useState<string>('');
  const [forecastRequestToken, setForecastRequestToken] = useState(0);

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

  const recentMonths = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(currentYear, currentMonth - (5 - i), 1);
        const key = monthKey(d);
        const rows = transactions.filter((t) => monthKey(new Date(t.date)) === key);
        const mIncome = rows.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const mExpense = rows.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const shortLabel = `${d.getMonth() + 1}月`;
        return { key, shortLabel, income: mIncome, expense: mExpense, balance: mIncome - mExpense };
      }),
    [currentMonth, currentYear, transactions]
  );

  const aiInput = useMemo(() => {
    const txRows = transactions
      .slice()
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 200)
      .map((item) => ({
        date: item.date,
        type: item.type,
        amount: item.amount,
        category: categories.find((c) => c.id === item.categoryId)?.name || item.categoryId,
        account: accounts.find((a) => a.id === item.accountId)?.name || item.accountId,
        tags: item.tags,
        note: item.note
      }));

    return {
      monthBalance: monthlyBalance,
      recentMonths: recentMonths.map((item) => ({ month: item.shortLabel, income: item.income, expense: item.expense, balance: item.balance })),
      accounts: accounts.map((item) => ({ name: item.name, type: item.type, balance: Number(item.balance ?? item.initialBalance ?? 0) })),
      transactions: txRows
    };
  }, [accounts, categories, monthlyBalance, recentMonths, transactions]);

  useEffect(() => {
    if (transactions.length === 0) {
      setForecast(null);
      setForecastStatus('idle');
      setForecastError('');
      setForecastUpdatedAt('');
      return;
    }

    const cached = readForecastCache(monthlyBalance);
    if (cached) {
      setForecast(cached.payload);
      setForecastStatus('done');
      setForecastError('');
      setForecastUpdatedAt(cached.updatedAt);
    }
  }, [monthlyBalance, transactions.length]);

  useEffect(() => {
    if (transactions.length === 0) return;

    let canceled = false;

    const run = async () => {
      setForecastStatus('loading');
      setForecastError('');
      try {
        const res = await sendAiChat({
          baseUrl,
          apiKey,
          model,
          systemPrompt:
            '你是财务趋势分析助手。仅输出 JSON，不要输出 Markdown。JSON 结构：{"summary":"字符串","points":[n1,n2,n3],"suggestions":["建议1","建议2"]}。points 为未来 3 个月结余预测。',
          messages: [
            {
              role: 'user',
              text: `请分析以下账务数据并返回未来三个月结余趋势\n${JSON.stringify(aiInput)}`
            }
          ]
        });

        const parsed = JSON.parse(extractJson(res.content)) as Partial<ForecastPayload>;
        const next = normalizeForecastPayload(parsed, monthlyBalance) ?? {
          summary: '模型已完成分析，建议结合预算目标跟踪未来三个月现金流。',
          points: [monthlyBalance, monthlyBalance, monthlyBalance],
          suggestions: []
        };
        const updatedAt = new Date().toISOString();

        if (!canceled) {
          setForecast(next);
          setForecastStatus('done');
          setForecastUpdatedAt(updatedAt);
          saveForecastCache(next, updatedAt);
        }
      } catch (error) {
        if (!canceled) {
          setForecastStatus('error');
          setForecastError(error instanceof Error ? error.message : '未来趋势分析失败');
          const fallback = {
            summary: 'AI 分析暂不可用，当前已展示基于本地数据的动态趋势，请稍后重试。',
            points: [monthlyBalance, monthlyBalance * 0.96, monthlyBalance * 0.92],
            suggestions: ['优先保证必要支出预算', '对波动较大的品类设置上限']
          };
          setForecast(fallback);
          setForecastUpdatedAt('');
        }
      }
    };

    void run();

    return () => {
      canceled = true;
    };
  }, [aiInput, apiKey, baseUrl, forecastRequestToken, model, monthlyBalance, transactions.length]);

  const handleRefreshForecast = () => {
    setForecastRequestToken((prev) => prev + 1);
  };

  const currentIndex = Math.max(recentMonths.length - 1, 0);

  const chartData = useMemo(() => {
    const history = recentMonths.map((item) => ({ label: item.shortLabel, value: item.balance, type: 'history' as const }));
    const future = (forecast?.points || []).slice(0, 3).map((value, index) => {
      const d = new Date(currentYear, currentMonth + index + 1, 1);
      return { label: monthLabel(d), value: toSafeNumber(value, monthlyBalance), type: 'forecast' as const };
    });
    return [...history, ...future];
  }, [currentMonth, currentYear, forecast?.points, monthlyBalance, recentMonths]);

  const chartRange = useMemo(() => {
    const values = chartData.map((item) => item.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);
    return { max, min, range };
  }, [chartData]);

  const axisTicks = useMemo(() => {
    const mid = (chartRange.max + chartRange.min) / 2;
    return [chartRange.max, mid, chartRange.min];
  }, [chartRange.max, chartRange.min]);

  const chartPoints = useMemo(() => {
    if (chartData.length < 2) return [];
    const width = 600;
    const height = 240;
    const pad = 20;
    return chartData.map((item, index) => {
      const x = pad + (index * (width - pad * 2)) / (chartData.length - 1);
      const y = pad + ((chartRange.max - item.value) / chartRange.range) * (height - pad * 2);
      return { x, y, label: item.label, type: item.type, value: item.value };
    });
  }, [chartData, chartRange.max, chartRange.range]);

  const historySegment = useMemo(() => {
    if (chartPoints.length < 2 || currentIndex < 1) return '';
    return chartPoints
      .slice(0, currentIndex)
      .map((item) => `${item.x},${item.y}`)
      .join(' ');
  }, [chartPoints, currentIndex]);

  const currentSegment = useMemo(() => {
    if (chartPoints.length < 2 || currentIndex < 1) return '';
    return chartPoints
      .slice(currentIndex - 1, currentIndex + 1)
      .map((item) => `${item.x},${item.y}`)
      .join(' ');
  }, [chartPoints, currentIndex]);

  const forecastSegment = useMemo(() => {
    if (chartPoints.length - currentIndex < 2) return '';
    return chartPoints
      .slice(currentIndex, chartPoints.length)
      .map((item) => `${item.x},${item.y}`)
      .join(' ');
  }, [chartPoints, currentIndex]);

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
            <h3>未来趋势</h3>
            <div className="dashboard-forecast-header">
              <p className="dashboard-ai-badge">模型：{model || '默认模型'} · {forecastStatus === 'loading' ? '分析中' : forecastStatus === 'done' ? '已完成' : forecastStatus === 'error' ? '降级展示' : '待分析'}{forecastUpdatedAt ? ` · 上次分析 ${new Date(forecastUpdatedAt).toLocaleString('zh-CN')}` : ''}</p>
              <button type="button" className="dashboard-forecast-refresh" onClick={handleRefreshForecast} disabled={forecastStatus === 'loading' || transactions.length === 0}>
                手动分析
              </button>
            </div>
            {forecastError ? <p className="dashboard-future-tip">{forecastError}</p> : null}

            <div className="dashboard-forecast-chart" aria-label="未来趋势动态图表">
              <div className="dashboard-forecast-axes">
                <div className="dashboard-forecast-axis-y" aria-label="金额轴">
                  {axisTicks.map((value, index) => (
                    <span key={`y-${index}`}>{formatCurrency(value)}</span>
                  ))}
                </div>
                <svg viewBox="0 0 600 240" role="img" aria-label="历史与未来趋势折线图">
                  <line x1="24" y1="20" x2="24" y2="220" stroke="var(--color-border)" strokeWidth="1" />
                  <line x1="24" y1="220" x2="580" y2="220" stroke="var(--color-border)" strokeWidth="1" />
                  {historySegment ? (
                    <polyline points={historySegment} className="history-line" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                  {currentSegment ? (
                    <polyline points={currentSegment} className="current-line" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                  {forecastSegment ? (
                    <polyline points={forecastSegment} className="forecast-line" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                </svg>
              </div>
              <div className="dashboard-forecast-axis-x" aria-label="时间轴">
                {chartData.map((item, index) => {
                  const klass = index === currentIndex ? 'current' : item.type === 'forecast' ? 'forecast' : 'history';
                  return (
                    <span key={`x-${item.label}-${index}`} className={klass}>
                      {item.label}
                    </span>
                  );
                })}
              </div>
              <div className="dashboard-forecast-key" aria-label="趋势颜色说明">
                <span className="history">历史</span>
                <span className="current">当前</span>
                <span className="forecast">未来</span>
              </div>
              <div className="dashboard-forecast-legend">
                {chartData.map((item, index) => {
                  const klass = index === currentIndex ? 'current' : item.type === 'forecast' ? 'forecast' : 'history';
                  const prefix = item.type === 'forecast' ? '预测' : '';
                  return (
                    <span key={`${item.label}-${index}`} className={klass}>
                      {prefix}{item.label}：{formatCurrency(item.value)}
                    </span>
                  );
                })}
              </div>
            </div>

            <p className="dashboard-future-text">{forecast?.summary || '正在根据账目、账户与交易详情生成未来趋势分析...'}</p>
            {forecast?.suggestions?.length ? (
              <ul className="dashboard-future-suggestions">
                {forecast.suggestions.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
            <p className="dashboard-future-tip">分析输入源：当前本地账目数据（若已同步数据库，数据会先落地到本地再用于模型分析）。</p>
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
