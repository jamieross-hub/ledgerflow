import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { DebugLogPanel } from '../../features/debug-log/ui/DebugLogPanel';
import { APP_VERSION } from '../../shared/config/app';
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
  profile?: {
    timePreference: string;
    topMerchant: string;
    personality: string;
    crowdCompare: string;
  };
}

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 6) return t('dashboard.greeting.night');
  if (hour < 9) return t('dashboard.greeting.morning');
  if (hour < 12) return t('dashboard.greeting.forenoon');
  if (hour < 14) return t('dashboard.greeting.noon');
  if (hour < 18) return t('dashboard.greeting.afternoon');
  if (hour < 22) return t('dashboard.greeting.evening');
  return t('dashboard.greeting.night');
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(date: Date): string {
  return `${date.getMonth() + 1}月`;
}

function isActualExpenseType(type: 'expense' | 'income' | 'budget' | 'repayment'): boolean {
  return type === 'expense' || type === 'repayment';
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

function monthBounds(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
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

function getConstellationLabel(month: number, day: number): string {
  const edgeDays = [20, 19, 21, 21, 21, 22, 23, 23, 23, 24, 23, 22];
  const names = [
    '摩羯座',
    '水瓶座',
    '双鱼座',
    '白羊座',
    '金牛座',
    '双子座',
    '巨蟹座',
    '狮子座',
    '处女座',
    '天秤座',
    '天蝎座',
    '射手座',
    '摩羯座'
  ];
  return day < edgeDays[month - 1] ? names[month - 1] : names[month];
}

const FORECAST_CACHE_KEY = 'dashboard_forecast_cache_v1';
const DASHBOARD_MODULES_KEY = 'dashboard_custom_modules_v1';

const DASHBOARD_MODULE_CATALOG = [
  { id: 'dynamic-charts', label: '动态图表', description: '收支趋势、分类占比、净资产曲线' },
  {
    id: 'anomaly-insights',
    label: '异常与亮点',
    description: 'AI + 本地模式识别消费异动和节省机会'
  },
  { id: 'top-transactions', label: '支出排行', description: '展示本月金额较高的重点账目' },
  { id: 'history-compare', label: '历史对比维度', description: '上月 / 季度 / 年度支出对比' },
  { id: 'profile', label: '消费画像', description: '时段偏好、商家偏好、消费人格' },
  { id: 'finance-suggestions', label: '财务建议', description: '结合玄学与预算动作给出建议' }
] as const;

type DashboardModuleId = (typeof DASHBOARD_MODULE_CATALOG)[number]['id'];

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

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [hoveredChartPoint, setHoveredChartPoint] = useState<{
    label: string;
    value: number;
  } | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<'week' | 'month' | 'year'>('week');
  const [cashflowView, setCashflowView] = useState<'expense' | 'cashflow'>('expense');
  const [moduleOrder, setModuleOrder] = useState<DashboardModuleId[]>(() =>
    DASHBOARD_MODULE_CATALOG.map((item) => item.id)
  );
  const [moduleVisibility, setModuleVisibility] = useState<Record<DashboardModuleId, boolean>>(
    () =>
      Object.fromEntries(DASHBOARD_MODULE_CATALOG.map((item) => [item.id, true])) as Record<
        DashboardModuleId,
        boolean
      >
  );
  const [draggingModule, setDraggingModule] = useState<DashboardModuleId | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const monthly = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const income = monthly.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = monthly
    .filter((t) => isActualExpenseType(t.type))
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
          .filter((t) => isActualExpenseType(t.type))
          .reduce((sum, t) => sum + t.amount, 0);
        const shortLabel = `${d.getMonth() + 1}月`;
        return { key, shortLabel, income: mIncome, expense: mExpense, balance: mIncome - mExpense };
      }),
    [currentMonth, currentYear, transactions]
  );

  /** 本月趋势仅展示：上月、当月、下月 */

  const aiInput = useMemo(() => {
    const txRows = transactions
      .slice()
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 40)
      .map((item) => ({
        date: item.date,
        type: item.type,
        amount: item.amount,
        category: categories.find((c) => c.id === item.categoryId)?.name || item.categoryId,
        note: String(item.note || '').slice(0, 24)
      }));

    return {
      monthBalance: monthlyBalance,
      recentMonths: recentMonths.slice(-3).map((item) => ({
        month: item.shortLabel,
        income: item.income,
        expense: item.expense,
        balance: item.balance
      })),
      accountSummary: accounts.map((item) => ({
        name: item.name,
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
      } else if (isActualExpenseType(item.type)) {
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
      .slice(0, 4)
      .map((item) => ({
        date: item.date,
        category:
          categories.find((c) => c.id === item.categoryId)?.name || item.categoryId || '未分类',
        amount: item.amount,
        type: item.type,
        note: String(item.note || '').slice(0, 24)
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
            '你是财务趋势分析助手。仅输出 JSON：{"summary":"简明结论","points":[n1,n2,n3],"suggestions":["建议1","建议2"]}。points 仅保留未来 3 个月。',
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
            '你是财务洞察分析助手。只输出 JSON：{"summary":"字符串","categoryBreakdown":[{"name":"分类","amount":123,"percent":12.3}],"topTransactions":[{"date":"YYYY-MM-DD","category":"分类","amount":123,"note":""}],"highlights":["要点1","要点2"],"profile":{"timePreference":"字符串","topMerchant":"字符串","personality":"字符串","crowdCompare":"字符串"}}。要求：1) categoryBreakdown.percent 是 0~100 的百分比数值，不带%符号；2) 占比必须基于“本月总交易额（收入+支出+还款）”，不能超过100；3) 若数据不足，明确写“暂无足够数据”，不要臆测。',
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
                percent: Math.min(100, Math.max(0, toSafeNumber(item?.percent, 0)))
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
        const profile =
          parsed.profile && typeof parsed.profile === 'object'
            ? {
                timePreference: String(
                  (parsed.profile as Record<string, unknown>).timePreference || '暂无足够数据'
                ),
                topMerchant: String(
                  (parsed.profile as Record<string, unknown>).topMerchant || '暂无足够数据'
                ),
                personality: String(
                  (parsed.profile as Record<string, unknown>).personality || '暂无足够数据'
                ),
                crowdCompare: String(
                  (parsed.profile as Record<string, unknown>).crowdCompare || '暂无足够数据'
                )
              }
            : undefined;
        const next: MonthlyInsightPayload = {
          summary,
          categoryBreakdown,
          topTransactions,
          highlights,
          profile
        };
        setMonthlyInsight(next);
        setMonthlyInsightStatus('done');
      } catch (error) {
        if (!canceled) {
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

  const reducedHistoryMonths = useMemo(() => recentMonths.slice(-4), [recentMonths]);
  const currentIndex = Math.max(reducedHistoryMonths.length - 1, 0);

  const chartData = useMemo(() => {
    const history = reducedHistoryMonths.map((item) => ({
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
  }, [currentMonth, currentYear, forecast?.points, monthlyBalance, reducedHistoryMonths]);

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
    return buildSmoothPath(chartPoints.slice(0, currentIndex + 1));
  }, [chartPoints, currentIndex]);

  const forecastSegment = useMemo(() => {
    if (chartPoints.length - currentIndex < 2) return '';
    return buildSmoothPath(chartPoints.slice(currentIndex, chartPoints.length));
  }, [chartPoints, currentIndex]);

  const lastMonthBalance = recentMonths[recentMonths.length - 2]?.balance ?? 0;
  const monthOverMonthChange = monthlyBalance - lastMonthBalance;
  const monthOverMonthRate =
    lastMonthBalance === 0
      ? monthOverMonthChange === 0
        ? 0
        : 100
      : (monthOverMonthChange / Math.abs(lastMonthBalance)) * 100;
  const monthOverMonthDirection = monthOverMonthChange >= 0 ? 'up' : 'down';
  const monthOverMonthArrow = monthOverMonthChange >= 0 ? '↗' : '↘';
  const forecastMonths = useMemo(() => {
    const values = forecast?.points?.slice(0, 3) || [
      monthlyBalance,
      monthlyBalance * 0.98,
      monthlyBalance * 0.96
    ];
    return values.map((value, index) => {
      const d = new Date(currentYear, currentMonth + index + 1, 1);
      return {
        label: monthLabel(d),
        value: toSafeNumber(value, monthlyBalance)
      };
    });
  }, [currentMonth, currentYear, forecast?.points, monthlyBalance]);

  const currentMonthLabel = `${currentYear}年${currentMonth + 1}月`;
  const monthlyInsightActionLabel =
    monthlyInsightStatus === 'loading' || monthlyInsightStatus === 'streaming'
      ? '分析中...'
      : monthlyInsightStatus === 'done'
        ? '重新分析'
        : 'AI 待分析';

  const monthlyTurnover = useMemo(
    () => monthly.reduce((sum, item) => sum + Math.abs(toSafeNumber(item.amount, 0)), 0),
    [monthly]
  );

  const displayCategoryBreakdown = useMemo(
    () =>
      monthlyInsight?.categoryBreakdown?.length
        ? monthlyInsight.categoryBreakdown.map((item) => ({
            name: item.name,
            amount: item.amount,
            percent: Math.min(100, Math.max(0, toSafeNumber(item.percent, 0)))
          }))
        : monthlyInsightInput.categories.map((item) => ({
            name: item.name,
            amount: item.total,
            percent:
              monthlyTurnover > 0
                ? Math.min(100, Math.max(0, Math.round((Math.abs(item.total) / monthlyTurnover) * 1000) / 10))
                : 0
          })),
    [monthlyInsight, monthlyInsightInput, monthlyTurnover]
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

  const localizedTips = useMemo(
    () => [
      t('dashboard.tips.1'),
      t('dashboard.tips.2'),
      t('dashboard.tips.3'),
      t('dashboard.tips.4'),
      t('dashboard.tips.5'),
      t('dashboard.tips.6')
    ],
    [t]
  );
  const tipIndex = new Date().getDate() % localizedTips.length;
  const categoryNameMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories]
  );

  const mysticInsight = useMemo(() => {
    const expenseRows = monthly.filter((item) => isActualExpenseType(item.type));
    if (expenseRows.length === 0) {
      return {
        title: '消费玄学分析',
        lines: ['本月还没有支出账目，玄学老师掐指一算：你先记一笔再开卦。'],
        disclaimer: '玄学仅供娱乐，理性消费才是王道。'
      };
    }

    const totalExpense = expenseRows.reduce((sum, item) => sum + item.amount, 0);
    const weekdayTotal = Array.from({ length: 7 }, () => 0);
    expenseRows.forEach((item) => {
      weekdayTotal[new Date(item.date).getDay()] += item.amount;
    });
    const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const topWeekdayEntry = weekdayTotal
      .map((amount, day) => ({ day, amount }))
      .sort((a, b) => b.amount - a.amount)[0];
    const topWeekdayPercent = totalExpense
      ? Math.round((topWeekdayEntry.amount / totalExpense) * 100)
      : 0;

    const drinkPattern = /奶茶|咖啡|饮品|茶饮|果茶|coffee|tea/i;
    const spendOn8Days = expenseRows.filter((item) => {
      const day = new Date(item.date).getDate();
      return day % 10 === 8;
    });
    const drinkCountOn8Days = spendOn8Days.filter((item) => {
      const category = categoryNameMap.get(item.categoryId) || '';
      return drinkPattern.test(`${item.note} ${category}`);
    }).length;
    const unique8Dates = Array.from(new Set(spendOn8Days.map((item) => item.date.slice(8, 10))));

    const colorRules = [
      { color: '蓝色', pattern: /电子|数码|学习|办公|网课|科技/i },
      { color: '红色', pattern: /餐|外卖|奶茶|咖啡|美食/i },
      { color: '绿色', pattern: /交通|地铁|公交|骑行|出行/i },
      { color: '紫色', pattern: /娱乐|社交|游戏|电影|聚会/i }
    ];
    const colorCount = new Map<string, number>(colorRules.map((item) => [item.color, 0]));
    expenseRows.forEach((item) => {
      const category = categoryNameMap.get(item.categoryId) || '';
      const text = `${category} ${item.note}`;
      const matched = colorRules.find((rule) => rule.pattern.test(text));
      if (matched) {
        colorCount.set(matched.color, (colorCount.get(matched.color) || 0) + 1);
      }
    });
    const luckyColor =
      Array.from(colorCount.entries()).sort((a, b) => a[1] - b[1])[0]?.[0] || '蓝色';

    const nowDate = new Date();
    const constellation = getConstellationLabel(nowDate.getMonth() + 1, nowDate.getDate());
    const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const zodiac = zodiacAnimals[(nowDate.getFullYear() - 4) % 12];

    return {
      title: '消费玄学分析',
      lines: [
        `你是${constellation}＋生肖${zodiac}，但本月${weekdayNames[topWeekdayEntry.day]}贡献了支出 ${topWeekdayPercent}%：看似水逆，其实是周中摸鱼手滑。`,
        unique8Dates.length
          ? `逢 8 日（${unique8Dates.join('/')}）你一共消费 ${spendOn8Days.length} 笔，其中奶茶/咖啡 ${drinkCountOn8Days} 杯，建议把外卖券藏起来。`
          : '本月暂未触发“逢 8 必买”Buff，恭喜你避开了数字玄学消费陷阱。',
        `你的消费幸运色是${luckyColor}：本月相关消费出现次数最少，建议把“理性消费”设成今日主色调。`
      ],
      disclaimer: '玄学仅供娱乐，理性消费才是王道。'
    };
  }, [categoryNameMap, monthly]);

  const quarterExpense = useMemo(
    () =>
      transactions
        .filter((item) => {
          const d = new Date(item.date);
          return (
            d.getFullYear() === currentYear &&
            Math.floor(d.getMonth() / 3) === Math.floor(currentMonth / 3)
          );
        })
        .filter((item) => isActualExpenseType(item.type))
        .reduce((sum, item) => sum + item.amount, 0),
    [currentMonth, currentYear, transactions]
  );
  const yearlyExpense = useMemo(
    () =>
      transactions
        .filter((item) => new Date(item.date).getFullYear() === currentYear)
        .filter((item) => isActualExpenseType(item.type))
        .reduce((sum, item) => sum + item.amount, 0),
    [currentYear, transactions]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_MODULES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        order?: DashboardModuleId[];
        visibility?: Partial<Record<DashboardModuleId, boolean>>;
      };
      if (Array.isArray(parsed.order)) {
        const safeOrder = parsed.order.filter((id): id is DashboardModuleId =>
          DASHBOARD_MODULE_CATALOG.some((item) => item.id === id)
        );
        if (safeOrder.length) {
          const missing = DASHBOARD_MODULE_CATALOG.map((item) => item.id).filter(
            (id) => !safeOrder.includes(id)
          );
          setModuleOrder([...safeOrder, ...missing]);
        }
      }
      if (parsed.visibility) {
        setModuleVisibility((prev) => ({ ...prev, ...parsed.visibility }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_MODULES_KEY,
        JSON.stringify({ order: moduleOrder, visibility: moduleVisibility })
      );
    } catch {
      // ignore
    }
  }, [moduleOrder, moduleVisibility]);

  const trendSeries = useMemo(() => {
    if (trendGranularity === 'year') {
      return Array.from({ length: 6 }).map((_, index) => {
        const targetYear = currentYear - (5 - index);
        const rows = transactions.filter((item) => new Date(item.date).getFullYear() === targetYear);
        const yearIncome = rows
          .filter((item) => item.type === 'income')
          .reduce((sum, item) => sum + item.amount, 0);
        const yearExpense = rows
          .filter((item) => isActualExpenseType(item.type))
          .reduce((sum, item) => sum + item.amount, 0);
        return {
          label: `${String(targetYear).slice(-2)}年`,
          income: yearIncome,
          expense: yearExpense
        };
      });
    }

    if (trendGranularity === 'month') {
      return recentMonths.map((item) => ({
        label: item.shortLabel,
        income: item.income,
        expense: item.expense
      }));
    }

    const nowPoint = new Date(currentYear, currentMonth, currentDay);
    return Array.from({ length: 8 }).map((_, index) => {
      const offset = 7 - index;
      const end = new Date(nowPoint);
      end.setDate(end.getDate() - offset * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const rows = transactions.filter((item) => {
        const date = new Date(item.date);
        return date >= start && date <= end;
      });
      const weekIncome = rows
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0);
      const weekExpense = rows
        .filter((item) => isActualExpenseType(item.type))
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        label: `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`,
        income: weekIncome,
        expense: weekExpense
      };
    });
  }, [currentDay, currentMonth, currentYear, recentMonths, transactions, trendGranularity]);

  const netAssetCurve = useMemo(() => {
    const balances = recentMonths.map((item) => item.balance);
    const current = netAssets;
    const points = new Array(balances.length);
    let running = current;
    for (let i = balances.length - 1; i >= 0; i -= 1) {
      points[i] = running;
      running -= balances[i];
    }
    return recentMonths.map((item, index) => ({ label: item.shortLabel, value: points[index] }));
  }, [netAssets, recentMonths]);

  const anomalyInsight = useMemo(() => {
    const expenseRows = transactions.filter((item) => isActualExpenseType(item.type));
    if (!expenseRows.length) {
      return {
        anomalies: ['暂无支出数据，暂无法识别异常。'],
        highlights: ['先记一笔账单，系统即可生成亮点分析。']
      };
    }

    const merchantThisWeek = new Map<string, number>();
    const merchantPrevWeek = new Map<string, number>();
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 6);
    const prevWeekStart = new Date(today);
    prevWeekStart.setDate(today.getDate() - 13);

    expenseRows.forEach((item) => {
      const date = new Date(item.date);
      const merchant =
        (item.note || '').trim().slice(0, 12) || categoryNameMap.get(item.categoryId) || '未知商家';
      if (date >= thisWeekStart) {
        merchantThisWeek.set(merchant, (merchantThisWeek.get(merchant) || 0) + item.amount);
      } else if (date >= prevWeekStart && date < thisWeekStart) {
        merchantPrevWeek.set(merchant, (merchantPrevWeek.get(merchant) || 0) + item.amount);
      }
    });

    const anomalies = Array.from(merchantThisWeek.entries())
      .map(([merchant, amount]) => {
        const prev = merchantPrevWeek.get(merchant) || 0;
        return { merchant, amount, prev, ratio: prev > 0 ? amount / prev : amount > 0 ? 99 : 0 };
      })
      .filter((item) => item.amount > 100 && item.ratio >= 1.8)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2)
      .map(
        (item) =>
          `⚠️ ${item.merchant} 本周支出 ${formatCurrency(item.amount)}，较上周提升 ${item.prev ? `${((item.ratio - 1) * 100).toFixed(0)}%` : '显著增长'}。`
      );

    const monthlyByDay = new Map<string, number>();
    monthly.forEach((item) => {
      if (!isActualExpenseType(item.type)) return;
      const key = item.date.slice(0, 10);
      monthlyByDay.set(key, (monthlyByDay.get(key) || 0) + item.amount);
    });
    const dayValues = Array.from(monthlyByDay.values());
    const dayAvg = dayValues.reduce((sum, value) => sum + value, 0) / Math.max(dayValues.length, 1);
    const lowerDays = dayValues.filter((value) => value < dayAvg * 0.7).length;

    const highlights = [
      `✅ 本月日均支出约 ${formatCurrency(dayAvg)}，其中 ${lowerDays} 天低于均值 70%，节奏控制较好。`,
      ...(monthlyInsight?.highlights?.slice(0, 2).map((item) => `✨ AI：${item}`) || [])
    ].slice(0, 3);

    return {
      anomalies: anomalies.length ? anomalies : ['未发现明显异常消费激增，当前消费波动相对稳定。'],
      highlights
    };
  }, [categoryNameMap, monthly, monthlyInsight?.highlights, transactions]);

  const trendMaxValue = useMemo(
    () => Math.max(...trendSeries.flatMap((item) => [item.income, item.expense]), 1),
    [trendSeries]
  );

  const trendBarHeight = (value: number) => {
    if (value <= 0 || trendMaxValue <= 0) {
      return '0%';
    }
    return `${Math.max(8, (value / trendMaxValue) * 100)}%`;
  };

  const expenseTrendAverage = useMemo(() => {
    if (!trendSeries.length) return 0;
    return trendSeries.reduce((sum, item) => sum + item.expense, 0) / trendSeries.length;
  }, [trendSeries]);

  const budgetWarningLine = expenseTrendAverage * 1.12;

  const cashflowCategoryRows = useMemo(() => {
    const map = new Map<string, { amount: number; prevAmount: number }>();

    const thisMonthRows = transactions.filter((item) => {
      const d = new Date(item.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();
    const prevMonthRows = transactions.filter((item) => {
      const d = new Date(item.date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const includeRow = (type: string) =>
      cashflowView === 'cashflow' ? type !== 'income' : type === 'expense';

    thisMonthRows.forEach((item) => {
      if (!includeRow(item.type)) return;
      const name = categoryNameMap.get(item.categoryId) || item.categoryId || '未分类';
      const current = map.get(name) || { amount: 0, prevAmount: 0 };
      current.amount += item.amount;
      map.set(name, current);
    });

    prevMonthRows.forEach((item) => {
      if (!includeRow(item.type)) return;
      const name = categoryNameMap.get(item.categoryId) || item.categoryId || '未分类';
      const current = map.get(name) || { amount: 0, prevAmount: 0 };
      current.prevAmount += item.amount;
      map.set(name, current);
    });

    const rows = Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        amount: value.amount,
        prevAmount: value.prevAmount
      }))
      .sort((a, b) => b.amount - a.amount);

    const top = rows.slice(0, 5);
    const other = rows.slice(5).reduce(
      (acc, item) => {
        acc.amount += item.amount;
        acc.prevAmount += item.prevAmount;
        return acc;
      },
      { amount: 0, prevAmount: 0 }
    );
    if (other.amount > 0) {
      top.push({ name: '其他', amount: other.amount, prevAmount: other.prevAmount });
    }

    const total = top.reduce((sum, item) => sum + item.amount, 0);
    return top.map((item) => ({
      ...item,
      percent: total > 0 ? (item.amount / total) * 100 : 0,
      diffRate: item.prevAmount > 0 ? ((item.amount - item.prevAmount) / item.prevAmount) * 100 : null
    }));
  }, [cashflowView, categoryNameMap, currentMonth, currentYear, transactions]);

  const netAssetRows = useMemo(() => {
    return netAssetCurve.map((item, index) => {
      const prev = index > 0 ? netAssetCurve[index - 1].value : item.value;
      return { ...item, delta: item.value - prev };
    });
  }, [netAssetCurve]);

  const netAssetWorstDrop = useMemo(() => {
    const candidates = netAssetRows.filter((_, index) => index > 0);
    if (!candidates.length) return null;
    return candidates.reduce((worst, current) =>
      current.delta < worst.delta ? current : worst
    );
  }, [netAssetRows]);

  const moveModule = (from: DashboardModuleId, to: DashboardModuleId) => {
    if (from === to) return;
    setModuleOrder((prev) => {
      const next = prev.slice();
      const fromIndex = next.indexOf(from);
      const toIndex = next.indexOf(to);
      if (fromIndex < 0 || toIndex < 0) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, from);
      return next;
    });
  };

  return (
    <div>
      <section className="welcome-banner">
        <span className="welcome-version-tag" aria-label={t('dashboard.ui.currentVersion')}>
          v{APP_VERSION}
        </span>
        <div className="welcome-content">
          <h2 className="welcome-greeting">
            {getGreeting(t)}，{t('dashboard.ui.welcome')}
          </h2>
          <p className="welcome-subtitle">{t('dashboard.ui.welcomeSubtitle')}</p>
          <p className="welcome-tip">💡 {localizedTips[tipIndex]}</p>
        </div>
        <div className="welcome-emoji">💰</div>
      </section>

      <section className="panel dashboard-getting-started">
        <div className="dashboard-section-header">
          <h3>{t('dashboard.ui.gettingStartedTitle')}</h3>
          <span>{t('dashboard.ui.gettingStartedSubtitle')}</span>
        </div>
        <ol className="dashboard-onboarding-steps">
          <li>{t('dashboard.ui.step1')}</li>
          <li>{t('dashboard.ui.step2')}</li>
          <li>{t('dashboard.ui.step3')}</li>
        </ol>
        <div className="dashboard-onboarding-actions">
          <button type="button" onClick={() => navigate('/transactions/new?quick=1')}>
            {t('dashboard.ui.addEntry')}
          </button>
          <button type="button" onClick={() => navigate('/smart-budget')}>
            {t('dashboard.ui.openBudget')}
          </button>
          <button type="button" onClick={() => navigate('/')}>
            {t('dashboard.ui.viewAnalysis')}
          </button>
        </div>
        <p className="dashboard-shortcuts-tip">
          {t('dashboard.ui.shortcutsPrefix')}：<kbd>N</kbd> {t('dashboard.ui.shortcutAdd')} · <kbd>B</kbd>{' '}
          {t('dashboard.ui.shortcutBudget')} · <kbd>/</kbd> {t('dashboard.ui.shortcutSearch')}
        </p>
      </section>

      <section className="panel">
        <h2>{t('dashboard.ui.corePanel')}</h2>
        <div className="grid grid-2">
          <button
            type="button"
            className="stat-card stat-balance stat-card-gradient"
            onClick={() => {
              const { from, to } = monthBounds();
              navigate(`/transactions?datePreset=custom&dateFrom=${from}&dateTo=${to}`);
            }}
            title="点击追溯本月交易"
          >
            <span className="stat-icon">🧭</span>
            <div>
              <h3>净资产</h3>
              <strong className="stat-value">{formatCurrency(netAssets)}</strong>
            </div>
          </button>
          <button
            type="button"
            className="stat-card stat-income stat-card-gradient"
            onClick={() => {
              const { from, to } = monthBounds();
              navigate(`/transactions?datePreset=custom&dateFrom=${from}&dateTo=${to}`);
            }}
            title="点击追溯本月交易"
          >
            <span className="stat-icon">💎</span>
            <div>
              <h3>本月结余</h3>
              <strong className="stat-value">{formatCurrency(monthlyBalance)}</strong>
            </div>
          </button>
        </div>
        <section className="dashboard-module-customizer" aria-label={t('dashboard.ui.moduleCustomize')}>
          <div className="dashboard-section-header">
            <h4>{t('dashboard.ui.moduleCustomize')}</h4>
            <span>{t('dashboard.ui.moduleCustomizeHint')}</span>
          </div>
          <div className="dashboard-module-toggle-list">
            {DASHBOARD_MODULE_CATALOG.map((module) => (
              <label key={module.id}>
                <input
                  type="checkbox"
                  checked={moduleVisibility[module.id]}
                  onChange={(event) =>
                    setModuleVisibility((prev) => ({ ...prev, [module.id]: event.target.checked }))
                  }
                />
                <span>{module.label}</span>
              </label>
            ))}
          </div>
          <div className="dashboard-module-order-list" aria-label="模块顺序">
            {moduleOrder.map((moduleId) => {
              const module = DASHBOARD_MODULE_CATALOG.find((item) => item.id === moduleId);
              if (!module) return null;
              return (
                <button
                  key={module.id}
                  type="button"
                  className="dashboard-module-chip"
                  draggable
                  onDragStart={() => setDraggingModule(module.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingModule) moveModule(draggingModule, module.id);
                    setDraggingModule(null);
                  }}
                  onDragEnd={() => setDraggingModule(null)}
                >
                  ↕ {module.label}
                </button>
              );
            })}
          </div>
        </section>

        {moduleOrder.map((moduleId) => {
          if (!moduleVisibility[moduleId]) return null;
          if (moduleId === 'dynamic-charts') {
            return (
              <section key={moduleId} className="dashboard-dynamic-grid">
                <article className="panel dashboard-unified-card" style={{ margin: 0 }}>
                  <div className="dashboard-section-header">
                    <h4>收支趋势（决策视图）</h4>
                    <div className="dashboard-segment-control">
                      <button
                        type="button"
                        className={trendGranularity === 'week' ? 'active' : ''}
                        onClick={() => setTrendGranularity('week')}
                      >
                        周
                      </button>
                      <button
                        type="button"
                        className={trendGranularity === 'month' ? 'active' : ''}
                        onClick={() => setTrendGranularity('month')}
                      >
                        月
                      </button>
                      <button
                        type="button"
                        className={trendGranularity === 'year' ? 'active' : ''}
                        onClick={() => setTrendGranularity('year')}
                      >
                        年
                      </button>
                    </div>
                  </div>
                  <div className="dashboard-mini-bars-legend" aria-label="收支图例">
                    <span className="legend-income">收入</span>
                    <span className="legend-expense">支出</span>
                    <span className="legend-budget">预警线</span>
                  </div>
                  <div className="dashboard-mini-bars">
                    {trendSeries.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="dashboard-mini-bars-item"
                        onClick={() => {
                          if (trendGranularity === 'month') {
                            const targetMonth = Number(item.label.replace('月', ''));
                            if (!Number.isFinite(targetMonth)) return;
                            const from = `${currentYear}-${String(targetMonth).padStart(2, '0')}-01`;
                            const to = new Date(currentYear, targetMonth, 0).toISOString().slice(0, 10);
                            navigate(`/transactions?datePreset=custom&dateFrom=${from}&dateTo=${to}`);
                            return;
                          }
                          navigate('/transactions');
                        }}
                        title={`${item.label} 收入 ${formatCurrency(item.income)}，支出 ${formatCurrency(item.expense)}`}
                      >
                        <strong>{item.label}</strong>
                        <div className="dashboard-mini-bars-columns" aria-hidden="true">
                          <span style={{ height: trendBarHeight(item.income) }} className="income" />
                          <span style={{ height: trendBarHeight(item.expense) }} className="expense" />
                        </div>
                        <div className="dashboard-mini-bars-meta">
                          <small>收 {formatCurrency(item.income)}</small>
                          <small>支 {formatCurrency(item.expense)}</small>
                        </div>
                        {item.expense > budgetWarningLine ? (
                          <em className="dashboard-mini-bar-warning">超预警</em>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </article>
                <article className="panel dashboard-unified-card" style={{ margin: 0 }}>
                  <div className="dashboard-section-header">
                    <h4>分类结构（Top5 + 其他）</h4>
                    <div className="dashboard-segment-control">
                      <button
                        type="button"
                        className={cashflowView === 'expense' ? 'active' : ''}
                        onClick={() => setCashflowView('expense')}
                      >
                        支出结构
                      </button>
                      <button
                        type="button"
                        className={cashflowView === 'cashflow' ? 'active' : ''}
                        onClick={() => setCashflowView('cashflow')}
                      >
                        现金流结构
                      </button>
                    </div>
                  </div>
                  <div className="dashboard-category-bars" role="list" aria-label="分类占比条形图">
                    {cashflowCategoryRows.map((item) => (
                      <article key={item.name} role="listitem" className="dashboard-category-bar-item">
                        <header>
                          <strong>{item.name}</strong>
                          <span>
                            {formatCurrency(item.amount)} · {item.percent.toFixed(1)}%
                          </span>
                        </header>
                        <div className="dashboard-category-bar-track">
                          <span style={{ width: `${item.percent}%` }} />
                        </div>
                        <p>
                          环比：
                          {item.diffRate === null
                            ? '—'
                            : `${item.diffRate >= 0 ? '↑' : '↓'}${Math.abs(item.diffRate).toFixed(1)}%`}
                        </p>
                      </article>
                    ))}
                    {cashflowCategoryRows.length === 0 ? <p className="muted">暂无可视化数据</p> : null}
                  </div>
                </article>
                <article className="panel dashboard-unified-card" style={{ margin: 0 }}>
                  <div className="dashboard-section-header dashboard-section-header-tight">
                    <h4>累计净资产曲线（含每月Δ）</h4>
                  </div>
                  <div className="dashboard-net-curve">
                    {netAssetRows.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`dashboard-net-row ${
                          netAssetWorstDrop && netAssetWorstDrop.label === item.label ? 'is-worst-drop' : ''
                        }`}
                        onClick={() => {
                          const targetMonth = Number(item.label.replace('月', ''));
                          if (!Number.isFinite(targetMonth)) return;
                          const from = `${currentYear}-${String(targetMonth).padStart(2, '0')}-01`;
                          const to = new Date(currentYear, targetMonth, 0).toISOString().slice(0, 10);
                          navigate(`/transactions?datePreset=custom&dateFrom=${from}&dateTo=${to}`);
                        }}
                      >
                        <span>{item.label}</span>
                        <i style={{ width: `${(item.value / Math.max(...netAssetRows.map((x) => x.value), 1)) * 100}%` }} />
                        <strong>{formatCurrency(item.value)}</strong>
                        <small className={item.delta >= 0 ? 'up' : 'down'}>
                          Δ {item.delta >= 0 ? '+' : ''}
                          {formatCurrency(item.delta)}
                        </small>
                      </button>
                    ))}
                  </div>
                  {netAssetWorstDrop ? (
                    <p className="dashboard-net-worst-hint">
                      最大回撤：{netAssetWorstDrop.label}（Δ{formatCurrency(netAssetWorstDrop.delta)}），可点击查看该月流水。
                    </p>
                  ) : null}
                </article>
              </section>
            );
          }

          if (moduleId === 'anomaly-insights') {
            const insightCards = [
              ...anomalyInsight.anomalies.map((text) => ({ kind: 'warning' as const, text })),
              ...anomalyInsight.highlights.map((text) => ({ kind: 'highlight' as const, text }))
            ].slice(0, 6);

            return (
              <section key={moduleId} className="panel" style={{ marginTop: 12 }}>
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
                        <button type="button" onClick={() => navigate('/smart-budget')}>
                          生成节支任务
                        </button>
                        <button type="button" onClick={() => navigate('/transactions')}>
                          查看关联账单
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="dashboard-scenario-entries" role="list" aria-label="智能场景入口">
                  <button type="button" role="listitem" onClick={() => navigate('/repayment-management')}>
                    <strong>本月还款压力</strong>
                    <span>AI 发现近期还款占比偏高，建议优先排期高息负债。</span>
                    <em>AI评估</em>
                  </button>
                  <button type="button" role="listitem" onClick={() => navigate('/dashboard')}>
                    <strong>下个月账单预测</strong>
                    <span>结合趋势预测，提前预留现金流避免月中吃紧。</span>
                    <em>AI评估</em>
                  </button>
                  <button type="button" role="listitem" onClick={() => navigate('/transactions')}>
                    <strong>近期大额支出提醒</strong>
                    <span>发现可疑大额支出，建议核查是否重复记账。</span>
                    <em>手动可复核</em>
                  </button>
                </div>
              </section>
            );
          }

          if (moduleId === 'top-transactions') {
            return (
              <div key={moduleId} className="dashboard-core-top-list">
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
              </div>
            );
          }

          if (moduleId === 'profile') {
            const profile = monthlyInsight?.profile;
            return (
              <article key={moduleId} className="panel" style={{ marginTop: 12 }}>
                <h3>消费行为画像</h3>
                <p>时段偏好：{profile?.timePreference || '暂无足够数据'}</p>
                <p>高频商家：{profile?.topMerchant || '暂无足够数据'}</p>
                <p>消费人格：{profile?.personality || '暂无足够数据'}</p>
                <p>同类人群对比：{profile?.crowdCompare || '暂无足够数据'}</p>
                {monthlyInsightStatus !== 'done' ? (
                  <p className="dashboard-ai-error" style={{ marginTop: 8 }}>
                    当前画像优先由大模型生成，暂无结果时不做本地臆测。
                  </p>
                ) : null}
              </article>
            );
          }

          if (moduleId === 'history-compare') {
            return (
              <article key={moduleId} className="panel" style={{ marginTop: 12 }}>
                <h3>历史对比维度</h3>
                <p>
                  上月支出：{formatCurrency(recentMonths[recentMonths.length - 2]?.expense || 0)}
                </p>
                <p>本季度支出：{formatCurrency(quarterExpense)}</p>
                <p>本年度支出：{formatCurrency(yearlyExpense)}</p>
              </article>
            );
          }

          return (
            <article key={moduleId} className="panel" style={{ marginTop: 12 }}>
              <h3>{mysticInsight.title}</h3>
              {mysticInsight.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                <strong>{mysticInsight.disclaimer}</strong>
              </p>
            </article>
          );
        })}
      </section>

      {transactions.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="📝"
            title={t('dashboard.ui.emptyTitle')}
            description={t('dashboard.ui.emptyDesc')}
            secondaryAction={{
              label: t('dashboard.ui.findAssistant'),
              onClick: () => {
                navigate('/assistant');
              }
            }}
            primaryAction={{
              label: t('dashboard.ui.quickAdd'),
              variant: 'primary',
              onClick: () => {
                navigate('/transactions/new?quick=1');
              }
            }}
          />
        </section>
      ) : (
        <div className="grid grid-2 dashboard-main-grid" style={{ marginTop: 16 }}>
          <section className="panel">
            <header className="dashboard-panel-header">
              <div>
                <p className="dashboard-panel-kicker">
                  {t('dashboard.ui.thisMonthTrend')} · {currentMonthLabel}
                </p>
                <h3>{t('dashboard.ui.thisMonthTrend')}</h3>
              </div>
              <div className="dashboard-panel-actions">
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
                  {monthlyInsightActionLabel}
                </button>
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
                <p
                  className={`dashboard-summary-change ${
                    monthOverMonthDirection === 'up' ? 'positive' : 'negative'
                  }`}
                >
                  <span>{monthOverMonthArrow}</span>
                  <span>环比 {Math.abs(monthOverMonthRate).toFixed(1)}%</span>
                  <span>
                    ({monthOverMonthChange >= 0 ? '+' : ''}
                    {formatCurrency(monthOverMonthChange)})
                  </span>
                </p>
                <p className="dashboard-summary-sub">
                  <span className="dashboard-summary-metric income">
                    收入 {formatCurrency(income)}
                  </span>
                  <span className="dashboard-summary-metric expense">
                    支出 {formatCurrency(expense)}
                  </span>
                  <span className="dashboard-summary-metric neutral">交易 {monthly.length} 笔</span>
                </p>
              </div>
              <div className="dashboard-summary-chip">AI 分析聚焦于本月分类结构与异常波动</div>
            </div>

            <div className="dashboard-ai-actions" style={{ marginBottom: 'var(--space-3)' }}>
              <p className="dashboard-ai-status-text">
                {monthlyInsightStatus === 'loading'
                  ? '正在整理本月账目结构…'
                  : monthlyInsightStatus === 'streaming'
                    ? '正在生成重点结论，请稍候。'
                    : monthlyInsightStatus === 'done'
                      ? '分析完成，可查看分类与重点账目。'
                      : '点击右上角“重新分析”开始生成。'}
              </p>
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
                    const percentValue = Math.min(100, Math.max(0, toSafeNumber(item.percent, 0)));
                    const percentText = `${percentValue.toFixed(1)}%`;
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
            </div>

            {/* 已移除：上月/本月/下月三段趋势列表 */}
          </section>

          <section className="panel">
            <h3>{t('dashboard.ui.futureTrend')}</h3>
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

            <div
              className="dashboard-forecast-chart"
              aria-label="未来趋势动态图表"
              onMouseLeave={() => setHoveredChartPoint(null)}
            >
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
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={index === currentIndex ? 4.8 : 3.6}
                        onMouseEnter={() =>
                          setHoveredChartPoint({
                            label: point.label,
                            value: point.value
                          })
                        }
                      />
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
                <span className="forecast">预测</span>
              </div>
              <p className="dashboard-forecast-hover">
                {hoveredChartPoint
                  ? `${hoveredChartPoint.label}：${formatCurrency(hoveredChartPoint.value)}`
                  : '悬停数据点查看具体数值'}
              </p>
              <div className="dashboard-forecast-legend">
                {chartData.map((item, index) => {
                  const klass = item.type === 'forecast' ? 'forecast' : 'history';
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
              <article className="dashboard-forecast-quick-card">
                <p>未来3个月预测</p>
                <div className="dashboard-forecast-quick-values">
                  {forecastMonths.map((item) => (
                    <div key={item.label} className="dashboard-forecast-quick-value-item">
                      <span>{item.label}</span>
                      <strong>{formatCurrency(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
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
