import { useEffect, useMemo, useState } from 'react';
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

interface MonthlyInsightPayload {
  summary: string;
  categoryBreakdown: Array<{ name: string; amount: number; percent: number }>;
  topTransactions: Array<{ date: string; category: string; amount: number; note: string }>;
  highlights: string[];
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

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const cmds: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    cmds.push(`Q ${cx} ${prev.y}, ${curr.x} ${curr.y}`);
  }
  return cmds.join(' ');
}

const FORECAST_CACHE_KEY = 'dashboard_forecast_cache_v1';

function normalizeForecastPayload(raw: unknown, fallback: number): ForecastPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<ForecastPayload>;
  const points = Array.isArray(parsed.points)
    ? parsed.points.slice(0, 3).map((n) => toSafeNumber(n, fallback))
    : [fallback, fallback, fallback];
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : '模型已完成分析，建议结合预算目标跟踪未来三个月现金流。';
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .slice(0, 3)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  return { summary, points, suggestions };
}

function readForecastCache(
  fallback: number
): { payload: ForecastPayload; updatedAt: string } | null {
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

const TIPS = [
  '你可以在记账助手中粘贴账单截图，AI 会自动识别并生成记账数据',
  '支持拖拽图片到记账助手，快速识别消费信息',
  '在设置页面可以配置 AI 供应商和 API Key',
  '所有数据存储在浏览器本地，你的隐私完全受保护',
  '支持导出 CSV 文件：Excel 看了都想给你点个赞',
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
  const [forecastStatus, setForecastStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle'
  );
  const [forecastError, setForecastError] = useState('');
  const [forecastUpdatedAt, setForecastUpdatedAt] = useState<string>('');
  const [forecastRequestToken, setForecastRequestToken] = useState(0);

  const [monthlyInsight, setMonthlyInsight] = useState<MonthlyInsightPayload | null>(null);
  const [monthlyInsightStatus, setMonthlyInsightStatus] = useState<
    'idle' | 'loading' | 'streaming' | 'done' | 'error'
  >('idle');
  const [monthlyInsightError, setMonthlyInsightError] = useState('');
  const [monthlyInsightRequestToken, setMonthlyInsightRequestToken] = useState(0);
  const [monthlyInsightProgress, setMonthlyInsightProgress] = useState(0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthly = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthly
    .filter((t) => t.type === 'expense' || t.type === 'budget' || t.type === 'repayment')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyBalance = income - expense;

  const liabilityNameKeywords = [
    '信用卡',
    '花呗',
    '白条',
    '借呗',
    '欠款',
    '负债',
    'credit',
    'visa',
    'master'
  ];
  const isLiabilityAccount = (account: (typeof accounts)[number]) => {
    if (account.type === 'credit' || account.type === 'liability') {
      return true;
    }
    const name = String(account.name || '').toLowerCase();
    return liabilityNameKeywords.some((keyword) => name.includes(keyword.toLowerCase()));
  };

  const liabilities = accounts.filter(isLiabilityAccount).reduce((sum, account) => {
    const balance = Number(account.balance ?? account.initialBalance ?? 0);
    if (!Number.isFinite(balance)) {
      return sum;
    }
    return sum + (balance < 0 ? Math.abs(balance) : balance);
  }, 0);

  const assetBalance = accounts
    .filter((account) => !isLiabilityAccount(account))
    .reduce((sum, account) => {
      const balance = Number(account.balance ?? account.initialBalance ?? 0);
      return Number.isFinite(balance) ? sum + balance : sum;
    }, 0);

  const netAssets = assetBalance - liabilities;

  const recentMonths = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(currentYear, currentMonth - (5 - i), 1);
        const key = monthKey(d);
        const rows = transactions.filter((t) => monthKey(new Date(t.date)) === key);
        const mIncome = rows
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const mExpense = rows
          .filter((t) => t.type === 'expense' || t.type === 'budget' || t.type === 'repayment')
          .reduce((sum, t) => sum + t.amount, 0);
        const shortLabel = `${d.getMonth() + 1}月`;
        return { key, shortLabel, income: mIncome, expense: mExpense, balance: mIncome - mExpense };
      }),
    [currentMonth, currentYear, transactions]
  );

  /** 本月趋势仅展示：上月、当月、下月 */
  const trendMonths = useMemo(() => {
    const offsets = [-1, 0, 1];
    return offsets.map((offset) => {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const key = monthKey(d);
      const rows = transactions.filter((t) => monthKey(new Date(t.date)) === key);
      const mIncome = rows.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const mExpense = rows
        .filter((t) => t.type === 'expense' || t.type === 'budget' || t.type === 'repayment')
        .reduce((sum, t) => sum + t.amount, 0);
      const label = offset === -1 ? '上月' : offset === 0 ? '本月' : '下月';
      const shortLabel = `${label}（${d.getMonth() + 1}月）`;
      return {
        key,
        shortLabel,
        income: mIncome,
        expense: mExpense,
        balance: mIncome - mExpense,
        isCurrent: offset === 0
      };
    });
  }, [currentMonth, currentYear, transactions]);

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
      recentMonths: recentMonths.map((item) => ({
        month: item.shortLabel,
        income: item.income,
        expense: item.expense,
        balance: item.balance
      })),
      accounts: accounts.map((item) => ({
        name: item.name,
        type: item.type,
        balance: Number(item.balance ?? item.initialBalance ?? 0)
      })),
      transactions: txRows
    };
  }, [accounts, categories, monthlyBalance, recentMonths, transactions]);

  const monthlyInsightInput = useMemo(() => {
    const categoryMap = new Map<
      string,
      { name: string; income: number; expense: number; count: number }
    >();
    monthly.forEach((item) => {
      const name =
        categories.find((c) => c.id === item.categoryId)?.name || item.categoryId || '未分类';
      const entry = categoryMap.get(name) || { name, income: 0, expense: 0, count: 0 };
      if (item.type === 'income') {
        entry.income += item.amount;
      } else if (item.type === 'expense' || item.type === 'budget' || item.type === 'repayment') {
        entry.expense += item.amount;
      }
      entry.count += 1;
      categoryMap.set(name, entry);
    });

    const categoryRows = Array.from(categoryMap.values())
      .map((entry) => ({
        name: entry.name,
        income: entry.income,
        expense: entry.expense,
        count: entry.count,
        total: entry.income - entry.expense
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    const topTransactions = monthly
      .slice()
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 6)
      .map((item) => ({
        date: item.date,
        category:
          categories.find((c) => c.id === item.categoryId)?.name || item.categoryId || '未分类',
        amount: item.amount,
        type: item.type,
        note: item.note
      }));

    return {
      month: `${currentYear}年${currentMonth + 1}月`,
      income,
      expense,
      balance: monthlyBalance,
      categories: categoryRows,
      topTransactions,
      recentMonths: recentMonths.slice(-3).map((item) => ({
        month: item.shortLabel,
        income: item.income,
        expense: item.expense,
        balance: item.balance
      }))
    };
  }, [
    categories,
    currentMonth,
    currentYear,
    income,
    monthly,
    monthlyBalance,
    expense,
    recentMonths
  ]);

  useEffect(() => {
    if (transactions.length === 0) {
      setForecast(null);
      setForecastStatus('idle');
      setForecastError('');
      setForecastUpdatedAt('');
      setMonthlyInsight(null);
      setMonthlyInsightStatus('idle');
      setMonthlyInsightError('');
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
    if (forecastRequestToken <= 0) return;

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
            '你是财务趋势分析助手。仅输出 JSON，不要输出 Markdown。JSON 结构：{"summary":"使用通俗中文，按先结论后原因输出","points":[n1,n2,n3],"suggestions":["可执行建议1","可执行建议2"]}。summary 必须清晰易懂、避免术语堆砌。points 为未来 3 个月结余预测。',
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

  useEffect(() => {
    if (monthlyInsightStatus !== 'loading' && monthlyInsightStatus !== 'streaming') {
      setMonthlyInsightProgress(monthlyInsightStatus === 'done' ? 100 : 0);
      return;
    }

    setMonthlyInsightProgress((prev) => (prev > 8 ? prev : 8));
    const timer = window.setInterval(() => {
      setMonthlyInsightProgress((prev) => {
        const cap = monthlyInsightStatus === 'streaming' ? 94 : 86;
        return Math.min(cap, prev + Math.max(1, Math.round((100 - prev) * 0.08)));
      });
    }, 380);

    return () => window.clearInterval(timer);
  }, [monthlyInsightStatus]);

  useEffect(() => {
    if (transactions.length === 0) return;
    if (monthlyInsightRequestToken <= 0) return;

    let canceled = false;

    const run = async () => {
      setMonthlyInsightStatus('loading');
      setMonthlyInsightError('');
      try {
        const res = await sendAiChat({
          baseUrl,
          apiKey,
          model,
          systemPrompt:
            '你是财务洞察分析助手。输出 JSON，不要输出 Markdown。JSON 结构：{"summary":"字符串","categoryBreakdown":[{"name":"分类","amount":123,"percent":0.12}],"topTransactions":[{"date":"YYYY-MM-DD","category":"分类","amount":123,"note":""}],"highlights":["要点1","要点2"]}。',
          messages: [
            {
              role: 'user',
              text: `请基于以下本月账务数据进行洞察，关注分类结构、异常支出与改善建议。\n${JSON.stringify(monthlyInsightInput)}`
            }
          ]
        });

        if (canceled) return;
        const parsed = JSON.parse(extractJson(res.content)) as Partial<MonthlyInsightPayload>;
        const categoryBreakdown = Array.isArray(parsed.categoryBreakdown)
          ? parsed.categoryBreakdown
              .map((item) => ({
                name: String(item?.name || '未分类'),
                amount: toSafeNumber(item?.amount, 0),
                percent: toSafeNumber(item?.percent, 0)
              }))
              .filter((item) => item.name)
          : [];
        const topTransactions = Array.isArray(parsed.topTransactions)
          ? parsed.topTransactions
              .map((item) => ({
                date: String(item?.date || ''),
                category: String(item?.category || '未分类'),
                amount: toSafeNumber(item?.amount, 0),
                note: String(item?.note || '')
              }))
              .filter((item) => item.date)
          : [];
        const highlights = Array.isArray(parsed.highlights)
          ? parsed.highlights.map((item) => String(item).trim()).filter(Boolean)
          : [];
        const summary =
          typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
            ? parsed.summary.trim()
            : '本月洞察已生成，可结合分类与大额交易进行预算调整。';
        const next: MonthlyInsightPayload = {
          summary,
          categoryBreakdown,
          topTransactions,
          highlights
        };
        setMonthlyInsight(next);
        setMonthlyInsightProgress(100);
        setMonthlyInsightStatus('done');
      } catch (error) {
        if (!canceled) {
          setMonthlyInsightProgress(0);
          setMonthlyInsightStatus('error');
          setMonthlyInsightError(error instanceof Error ? error.message : '本月趋势分析失败');
        }
      }
    };

    void run();

    return () => {
      canceled = true;
    };
  }, [
    apiKey,
    baseUrl,
    model,
    monthlyInsightInput,
    monthlyInsightRequestToken,
    transactions.length
  ]);

  const handleRefreshForecast = () => {
    setForecastRequestToken((prev) => prev + 1);
  };

  const handleRefreshMonthlyInsight = () => {
    setMonthlyInsightRequestToken((prev) => prev + 1);
  };

  const currentIndex = Math.max(recentMonths.length - 1, 0);

  const chartData = useMemo(() => {
    const history = recentMonths.map((item) => ({
      label: item.shortLabel,
      value: item.balance,
      type: 'history' as const
    }));
    const future = (forecast?.points || []).slice(0, 3).map((value, index) => {
      const d = new Date(currentYear, currentMonth + index + 1, 1);
      return {
        label: monthLabel(d),
        value: toSafeNumber(value, monthlyBalance),
        type: 'forecast' as const
      };
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
    return buildSmoothPath(chartPoints.slice(0, currentIndex));
  }, [chartPoints, currentIndex]);

  const currentSegment = useMemo(() => {
    if (chartPoints.length < 2 || currentIndex < 1) return '';
    return buildSmoothPath(chartPoints.slice(currentIndex - 1, currentIndex + 1));
  }, [chartPoints, currentIndex]);

  const forecastSegment = useMemo(() => {
    if (chartPoints.length - currentIndex < 2) return '';
    return buildSmoothPath(chartPoints.slice(currentIndex, chartPoints.length));
  }, [chartPoints, currentIndex]);

  const monthlyStatusText =
    monthlyInsightStatus === 'loading'
      ? '分析中'
      : monthlyInsightStatus === 'streaming'
        ? '流式输出中'
        : monthlyInsightStatus === 'done'
          ? '已完成'
          : monthlyInsightStatus === 'error'
            ? '异常'
            : '待分析';

  const currentMonthLabel = `${currentYear}年${currentMonth + 1}月`;

  const displayCategoryBreakdown = useMemo(
    () =>
      monthlyInsight?.categoryBreakdown?.length
        ? monthlyInsight.categoryBreakdown.map((item) => ({
            name: item.name,
            amount: item.amount,
            percent: item.percent
          }))
        : monthlyInsightInput.categories.map((item) => ({
            name: item.name,
            amount: item.total,
            count: item.count
          })),
    [monthlyInsight, monthlyInsightInput]
  );

  const displayTopTransactions = useMemo(
    () =>
      monthlyInsight?.topTransactions?.length
        ? monthlyInsight.topTransactions
        : monthlyInsightInput.topTransactions.map((item) => ({
            date: item.date,
            category: item.category,
            amount: item.amount,
            note: item.note
          })),
    [monthlyInsight, monthlyInsightInput]
  );

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
              <h3>欠款负债</h3>
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
        <div className="grid grid-2 dashboard-main-grid" style={{ marginTop: 16 }}>
          <section className="panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="dashboard-panel-kicker">本月趋势 · {currentMonthLabel}</p>
                <h3>本月趋势</h3>
              </div>
              <div className="dashboard-panel-actions">
                <span className={`dashboard-ai-status status-${monthlyInsightStatus}`}>
                  AI {monthlyStatusText}
                </span>
              </div>
            </header>

            <div className="dashboard-trend-summary">
              <div>
                <p className="dashboard-summary-title">本月收支概览</p>
                <p className="dashboard-summary-main">
                  结余
                  <span
                    className={
                      monthlyBalance >= 0
                        ? 'dashboard-summary-main-amount positive'
                        : 'dashboard-summary-main-amount negative'
                    }
                  >
                    {formatCurrency(monthlyBalance)}
                  </span>
                </p>
                <p className="dashboard-summary-sub">
                  <span className="dashboard-summary-metric income">
                    收入 {formatCurrency(income)}
                  </span>
                  <span className="dashboard-summary-dot">·</span>
                  <span className="dashboard-summary-metric expense">
                    支出 {formatCurrency(expense)}
                  </span>
                  <span className="dashboard-summary-dot">·</span>
                  <span className="dashboard-summary-metric neutral">交易 {monthly.length} 笔</span>
                </p>
              </div>
              <div className="dashboard-summary-chip">AI 分析聚焦于本月分类结构与异常波动</div>
            </div>

            <div className="dashboard-insight-progress" aria-live="polite">
              <div className="dashboard-insight-progress-head">
                <span>AI 洞察进度</span>
                <strong>{monthlyInsightProgress}%</strong>
              </div>
              <div className="dashboard-insight-progress-track">
                <span style={{ width: `${monthlyInsightProgress}%` }} />
              </div>
              <p>
                {monthlyInsightStatus === 'loading'
                  ? '正在整理本月账目结构…'
                  : monthlyInsightStatus === 'streaming'
                    ? '正在生成重点结论，请稍候。'
                    : monthlyInsightStatus === 'done'
                      ? '分析完成，可查看分类与重点账目。'
                      : '点击“重新分析”开始生成。'}
              </p>
            </div>

            <div className="dashboard-ai-actions" style={{ marginBottom: 'var(--space-3)' }}>
              <button
                type="button"
                className="dashboard-forecast-refresh"
                onClick={handleRefreshMonthlyInsight}
                disabled={
                  monthlyInsightStatus === 'loading' ||
                  monthlyInsightStatus === 'streaming' ||
                  transactions.length === 0
                }
              >
                重新分析
              </button>
              {monthlyInsightError ? (
                <p className="dashboard-ai-error">{monthlyInsightError}</p>
              ) : null}
            </div>

            <div className="dashboard-trend-sections">
              <section>
                <div className="dashboard-section-header">
                  <h4>分类结构</h4>
                  <span>按金额排序</span>
                </div>
                <div className="dashboard-breakdown-grid">
                  {displayCategoryBreakdown.map((item, index) => {
                    const percentValue =
                      'percent' in item
                        ? item.percent
                        : Math.round((item.amount / Math.max(expense, 1)) * 100);
                    const percentText = `${percentValue}%`;
                    const emoji = item.amount >= 0 ? '📌' : '🔻';
                    return (
                      <article key={`${item.name}-${index}`} className="dashboard-breakdown-item">
                        <div>
                          <p className="dashboard-breakdown-name">
                            {emoji} {item.name}
                          </p>
                          <p className="dashboard-breakdown-meta">
                            {item.name} {formatCurrency(item.amount)}，占比 {percentText}
                          </p>
                        </div>
                        <div className="dashboard-breakdown-bar">
                          <span style={{ width: percentText }} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="dashboard-section-header">
                  <h4>重点账目</h4>
                  <span>金额 TOP {displayTopTransactions.length}</span>
                </div>
                <div className="dashboard-top-list">
                  {displayTopTransactions.map((item, index) => (
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
              </section>
            </div>

            <div className="dashboard-trend-list" aria-label="上月、本月、下月收支结余趋势">
              {trendMonths.map((item) => (
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
              <p className="dashboard-ai-badge">
                模型：{model || '默认模型'} ·{' '}
                {forecastStatus === 'loading'
                  ? '分析中'
                  : forecastStatus === 'done'
                    ? '已完成'
                    : forecastStatus === 'error'
                      ? '降级展示'
                      : '待分析'}
                {forecastUpdatedAt
                  ? ` · 上次分析 ${new Date(forecastUpdatedAt).toLocaleString('zh-CN')}`
                  : ''}
              </p>
              <button
                type="button"
                className="dashboard-forecast-refresh"
                onClick={handleRefreshForecast}
                disabled={forecastStatus === 'loading' || transactions.length === 0}
              >
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
                  <line
                    x1="24"
                    y1="20"
                    x2="24"
                    y2="220"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <line
                    x1="24"
                    y1="220"
                    x2="580"
                    y2="220"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  {historySegment ? (
                    <path
                      d={historySegment}
                      className="history-line dashboard-forecast-path"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {currentSegment ? (
                    <path
                      d={currentSegment}
                      className="current-line dashboard-forecast-path"
                      fill="none"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {forecastSegment ? (
                    <path
                      d={forecastSegment}
                      className="forecast-line dashboard-forecast-path"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {chartPoints.map((point, index) => (
                    <g key={`point-${point.label}-${index}`} className="dashboard-forecast-point">
                      <circle cx={point.x} cy={point.y} r={index === currentIndex ? 4.8 : 3.6} />
                      <title>{`${point.label}：${formatCurrency(point.value)}`}</title>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="dashboard-forecast-axis-x" aria-label="时间轴">
                {chartData.map((item, index) => {
                  const klass =
                    index === currentIndex
                      ? 'current'
                      : item.type === 'forecast'
                        ? 'forecast'
                        : 'history';
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
                  const klass =
                    index === currentIndex
                      ? 'current'
                      : item.type === 'forecast'
                        ? 'forecast'
                        : 'history';
                  const prefix = item.type === 'forecast' ? '预测' : '';
                  return (
                    <span key={`${item.label}-${index}`} className={klass}>
                      {prefix}
                      {item.label}：{formatCurrency(item.value)}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-forecast-quick-cards">
              {chartData.slice(currentIndex).map((item, index) => (
                <article
                  key={`future-card-${item.label}-${index}`}
                  className="dashboard-forecast-quick-card"
                >
                  <p>{index === 0 ? '本月基线' : `未来第${index}个月`}</p>
                  <strong>{formatCurrency(item.value)}</strong>
                </article>
              ))}
            </div>

            <p className="dashboard-future-text">
              {forecast?.summary || '点击“手动分析”生成未来趋势分析。'}
            </p>
            <p className="dashboard-future-tip">
              一句话解读：未来趋势是
              {(forecast?.points?.[2] ?? monthlyBalance) >= monthlyBalance
                ? '稳中向上'
                : '需要控制支出'}
              ，建议优先执行下面两条动作。
            </p>
            {forecast?.suggestions?.length ? (
              <ul className="dashboard-future-suggestions">
                {forecast.suggestions.map((item, index) => (
                  <li key={`${item}-${index}`} className="dashboard-future-focus-item">
                    第 {index + 1} 步：{item}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="dashboard-future-tip">
              分析输入源：当前本地账目数据（若已同步数据库，数据会先落地到本地再用于模型分析）。
            </p>
          </section>
        </div>
      )}

      <DebugLogPanel />
    </div>
  );
}
