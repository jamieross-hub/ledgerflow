import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import {
  analyzeFinancialOverview,
  FINANCIAL_ANALYSIS_RANGE_OPTIONS,
  type FinancialAnalysisRangeKey
} from '../../features/financial-analysis/model/analysis';
import { formatCurrency } from '../../shared/lib/format';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { EmptyState } from '../../shared/ui/EmptyState';

interface AiFinancialAnalysisPayload {
  summary: string;
  past: string[];
  present: string[];
  future: string[];
  actions: Array<{
    label: string;
    to: string;
  }>;
}

interface FinancialAnalysisQuickAction {
  label: string;
  hint: string;
  onClick: () => void;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function metricValue(label: string, value: number, help?: string): string {
  if (help === '百分比') {
    return formatPercent(value);
  }
  if (label.includes('率') && Math.abs(value) <= 100) {
    return formatPercent(value);
  }
  return formatCurrency(value);
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function normalizeAiPayload(raw: unknown): AiFinancialAnalysisPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const payload = raw as Partial<AiFinancialAnalysisPayload>;
  const summary = String(payload.summary || '').trim();
  const normalizeList = (value: unknown) =>
    Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : [];
  const actions = Array.isArray(payload.actions)
    ? payload.actions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const next = item as { label?: unknown; to?: unknown };
          const label = String(next.label || '').trim();
          const to = String(next.to || '').trim();
          if (!label || !to) return null;
          return { label, to };
        })
        .filter((item): item is { label: string; to: string } => Boolean(item))
        .slice(0, 3)
    : [];

  if (!summary) {
    return null;
  }

  return {
    summary,
    past: normalizeList(payload.past),
    present: normalizeList(payload.present),
    future: normalizeList(payload.future),
    actions
  };
}

function buildTransactionsLink(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `/transactions?${query}` : '/transactions';
}

function getRangeDateBounds(range: { key: FinancialAnalysisRangeKey; days: number | null }) {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (range.key === 'month') {
    const start = new Date(current.getFullYear(), current.getMonth(), 1);
    return {
      from: start.toISOString().slice(0, 10),
      to: current.toISOString().slice(0, 10)
    };
  }

  const days = Math.max(1, range.days || 30);
  const start = new Date(current);
  start.setDate(start.getDate() - (days - 1));

  return {
    from: start.toISOString().slice(0, 10),
    to: current.toISOString().slice(0, 10)
  };
}

export function FinancialAnalysisPage() {
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<FinancialAnalysisRangeKey>('30d');
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [aiUpdatedAt, setAiUpdatedAt] = useState('');
  const [aiResult, setAiResult] = useState<AiFinancialAnalysisPayload | null>(null);

  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const subscriptions = useFinanceStore((state) => state.subscriptions);
  const debts = useAppPreferences((state) => state.debts);
  const repaymentRecords = useAppPreferences((state) => state.repaymentRecords);
  const monthlyIncome = useAppPreferences((state) => state.monthlyIncome);
  const baseUrl = useAiSettings((state) => state.baseUrl);
  const apiKey = useAiSettings((state) => state.apiKey);
  const model = useAiSettings((state) => state.model);

  const range =
    FINANCIAL_ANALYSIS_RANGE_OPTIONS.find((item) => item.key === rangeKey) ||
    FINANCIAL_ANALYSIS_RANGE_OPTIONS[1];

  const analysis = useMemo(
    () =>
      analyzeFinancialOverview({
        range,
        transactions,
        categories,
        accounts,
        subscriptions,
        debts,
        repaymentRecords,
        monthlyIncome
      }),
    [accounts, categories, debts, monthlyIncome, range, repaymentRecords, subscriptions, transactions]
  );

  const aiInput = useMemo(
    () => ({
      range: range.label,
      transactionCount: analysis.transactionCount,
      sampleDays: analysis.sampleDays,
      summaryLine: analysis.summaryLine,
      confidenceNote: analysis.confidenceNote,
      metrics: analysis.metrics,
      trendDeltaPct: analysis.trendDeltaPct,
      previous: {
        topCategoryName: analysis.previous.topCategoryName,
        topCategoryAmount: analysis.previous.topCategoryAmount,
        topCategoryShare: analysis.previous.topCategoryShare,
        recentAverageDailyExpense: analysis.previous.recentAverageDailyExpense,
        abnormalExpense: analysis.previous.abnormalExpense
          ? {
              date: analysis.previous.abnormalExpense.date,
              note: analysis.previous.abnormalExpense.note,
              amount: analysis.previous.abnormalExpense.amount
            }
          : null,
        categoryRows: analysis.previous.categoryRows
      },
      present: {
        fixedExpenseAmount: analysis.present.fixedExpenseAmount,
        fixedExpenseRatio: analysis.present.fixedExpenseRatio,
        subscriptionMonthlyCost: analysis.present.subscriptionMonthlyCost,
        debtPressureRatio: analysis.present.debtPressureRatio,
        debtHealthScore: analysis.present.debtHealthScore,
        disposableIncome: analysis.present.disposableIncome
      },
      future: {
        projectedMonthlyBalance: analysis.future.projectedMonthlyBalance,
        suggestedBuffer: analysis.future.suggestedBuffer,
        dueSoonSubscriptionCount: analysis.future.dueSoonSubscriptionCount,
        dueSoonRepaymentCount: analysis.future.dueSoonRepaymentCount
      }
    }),
    [analysis, range.label]
  );

  useEffect(() => {
    setAiResult(null);
    setAiError('');
    setAiUpdatedAt('');
    setAiStatus('idle');
  }, [rangeKey, analysis.transactionCount]);

  const rangeTransactionDates = useMemo(() => getRangeDateBounds(range), [range]);

  const previousQuickActions = useMemo<FinancialAnalysisQuickAction[]>(() => {
    const actions: FinancialAnalysisQuickAction[] = [
      {
        label: '查看当前周期流水',
        hint: '带着当前分析周期回到交易页，继续核对账单。',
        onClick: () =>
          navigate(
            buildTransactionsLink({
              datePreset: 'custom',
              dateFrom: rangeTransactionDates.from,
              dateTo: rangeTransactionDates.to
            })
          )
      },
      {
        label: '只看支出记录',
        hint: '聚焦支出项，适合继续排查波动来源。',
        onClick: () =>
          navigate(
            buildTransactionsLink({
              type: 'expense',
              datePreset: 'custom',
              dateFrom: rangeTransactionDates.from,
              dateTo: rangeTransactionDates.to
            })
          )
      }
    ];

    if (analysis.previous.abnormalExpense?.id) {
      actions.unshift({
        label: '定位异常流水',
        hint: '优先回到原始记录，确认这笔异常支出是否合理。',
        onClick: () => navigate(`/transactions/${analysis.previous.abnormalExpense?.id}`)
      });
    }

    return actions.slice(0, 3);
  }, [analysis.previous.abnormalExpense?.id, navigate, rangeTransactionDates.from, rangeTransactionDates.to]);

  const presentQuickActions = useMemo<FinancialAnalysisQuickAction[]>(() => {
    const actions: FinancialAnalysisQuickAction[] = [];

    if (analysis.present.disposableIncome <= 0 || analysis.present.fixedExpenseRatio >= 0.45) {
      actions.push({
        label: '去制定预算',
        hint: '当前可支配空间偏紧，先回预算页收口固定支出。',
        onClick: () => navigate('/smart-budget')
      });
    }

    if (analysis.present.debtPressureRatio >= 0.25) {
      actions.push({
        label: '查看还款压力',
        hint: '负债压力偏高时，优先检查近期应还与最低还款。',
        onClick: () => navigate('/repayment-management')
      });
    }

    actions.push({
      label: '检查订阅项',
      hint: '固定成本里已经计入订阅，顺手检查是否有可停用项目。',
      onClick: () => navigate('/subscriptions')
    });

    return actions.slice(0, 3);
  }, [analysis.present.debtPressureRatio, analysis.present.disposableIncome, analysis.present.fixedExpenseRatio, navigate]);

  const futureQuickActions = useMemo<FinancialAnalysisQuickAction[]>(() => {
    const actions: FinancialAnalysisQuickAction[] = [];

    if (analysis.future.dueSoonRepaymentCount > 0) {
      actions.push({
        label: '处理近期还款',
        hint: `未来 10 天有 ${analysis.future.dueSoonRepaymentCount} 笔还款提醒，建议先去确认。`,
        onClick: () => navigate('/repayment-management')
      });
    }

    if (analysis.future.dueSoonSubscriptionCount > 0) {
      actions.push({
        label: '检查即将续费订阅',
        hint: `未来 14 天有 ${analysis.future.dueSoonSubscriptionCount} 个订阅到期/续费。`,
        onClick: () => navigate('/subscriptions')
      });
    }

    actions.push({
      label: '回到交易页继续处理',
      hint: '需要补流水或核对数据时，直接回交易页继续操作。',
      onClick: () => navigate('/transactions')
    });

    return actions.slice(0, 3);
  }, [analysis.future.dueSoonRepaymentCount, analysis.future.dueSoonSubscriptionCount, navigate]);

  const runAiAnalysis = async () => {
    if (!transactions.length || !apiKey.trim()) {
      setAiStatus('error');
      setAiError('未配置可用的 AI Key，当前无法生成财务分析解读。');
      return;
    }

    setAiStatus('loading');
    setAiError('');

    try {
      const result = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt:
          '你是 LedgerFlow 的财务分析顾问。你需要基于账本快照，输出一个适合财务分析页面展示的 JSON。语气要专业、克制、具体，禁止空话。只输出 JSON，不要输出额外说明。',
        messages: [
          {
            role: 'user',
            text: `请基于以下财务分析快照，输出 JSON：{"summary":"一句总判断","past":["过去分析1","过去分析2"],"present":["现在分析1","现在分析2"],"future":["未来分析1","未来分析2"],"actions":[{"label":"动作名","to":"/transactions|/smart-budget|/repayment-management|/subscriptions|/assistant"}] }。
要求：
1) past / present / future 各返回 2~3 条；
2) 必须结合输入数字，不要泛泛而谈；
3) 若样本不足，要明确提示“样本不足”；
4) actions 最多 3 条，必须是可执行入口；
5) 用简体中文。

财务分析快照：
${JSON.stringify(aiInput)}`
          }
        ]
      });

      const parsed = normalizeAiPayload(JSON.parse(extractJson(result.content)));
      if (!parsed) {
        throw new Error('AI 未返回可解析的财务分析结果。');
      }

      setAiResult(parsed);
      setAiStatus('done');
      setAiUpdatedAt(new Date().toISOString());
    } catch (error) {
      setAiStatus('error');
      setAiError(error instanceof Error ? error.message : '财务分析生成失败，请稍后重试。');
    }
  };

  if (transactions.length === 0) {
    return (
      <section className="panel">
        <EmptyState
          icon="📈"
          title="还没有足够的财务分析数据"
          description="先新增几笔交易，财务分析页就能开始帮你看清过去、理解现在、规划未来。"
          primaryAction={{
            label: '去记一笔',
            variant: 'primary',
            onClick: () => navigate('/transactions/new?quick=1')
          }}
          secondaryAction={{
            label: '查看交易记录',
            onClick: () => navigate('/transactions')
          }}
        />
      </section>
    );
  }

  return (
    <div className="page-stack financial-analysis-page">
      <section className="panel financial-analysis-hero">
        <div className="financial-analysis-hero-head">
          <div>
            <h2>财务分析</h2>
            <p className="muted">看清过去、理解现在、规划未来。分析页会先整理本地账目，再交给大模型生成更贴近决策的解释与动作建议。</p>
          </div>
          <div className="financial-analysis-range-switcher" aria-label="分析周期切换">
            {FINANCIAL_ANALYSIS_RANGE_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === rangeKey ? 'active' : ''}
                onClick={() => setRangeKey(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="financial-analysis-ai-bar">
          <p className="financial-analysis-ai-status">
            模型：{model || '默认模型'} ·{' '}
            {aiStatus === 'loading'
              ? '分析中'
              : aiStatus === 'done'
                ? '已完成'
                : aiStatus === 'error'
                  ? '分析失败'
                  : '待分析'}
            {aiUpdatedAt ? ` · 上次分析 ${new Date(aiUpdatedAt).toLocaleString('zh-CN')}` : ''}
          </p>
          <button type="button" onClick={runAiAnalysis} disabled={aiStatus === 'loading'}>
            {aiStatus === 'loading' ? '分析中...' : '生成 AI 解读'}
          </button>
        </div>

        <p className="financial-analysis-summary-line">{analysis.summaryLine}</p>
        <p className="financial-analysis-confidence">{analysis.confidenceNote}</p>

        <div className="financial-analysis-metrics-grid">
          {analysis.metrics.map((item) => (
            <article key={item.label} className={`financial-analysis-metric-card tone-${item.tone || 'neutral'}`}>
              <span>{item.label}</span>
              <strong>{metricValue(item.label, item.value, item.help)}</strong>
            </article>
          ))}
        </div>

        <article className="financial-analysis-ai-card">
          <header>
            <div>
              <h3>AI 综合解读</h3>
              <p className="muted">让模型基于当前账本快照，把数字翻译成更适合执行的判断。</p>
            </div>
          </header>
          {aiError ? <p className="financial-analysis-ai-error">{aiError}</p> : null}
          {aiResult ? (
            <div className="financial-analysis-ai-grid">
              <div className="financial-analysis-highlight">
                <strong>一句总判断</strong>
                <p>{aiResult.summary}</p>
              </div>
              <div className="financial-analysis-ai-columns">
                <section>
                  <h4>过去</h4>
                  <ul>
                    {aiResult.past.map((item, index) => (
                      <li key={`past-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>现在</h4>
                  <ul>
                    {aiResult.present.map((item, index) => (
                      <li key={`present-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>未来</h4>
                  <ul>
                    {aiResult.future.map((item, index) => (
                      <li key={`future-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
              {aiResult.actions.length > 0 ? (
                <div className="financial-analysis-actions">
                  {aiResult.actions.map((action) => (
                    <button key={action.label} type="button" onClick={() => navigate(action.to)}>
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">点击“生成 AI 解读”，让模型结合当前财务快照输出更完整的过去 / 现在 / 未来分析。</p>
          )}
        </article>
      </section>

      <section className="panel financial-analysis-section">
        <div className="financial-analysis-section-head">
          <div>
            <h3>过去：复盘支出变化</h3>
            <p className="muted">先看主要流向，再看哪些波动值得回头翻账单。</p>
          </div>
          <span className="metric-chip">
            支出变化
            <strong>
              {analysis.trendDeltaPct === null
                ? '样本不足'
                : `${analysis.trendDeltaPct >= 0 ? '+' : ''}${analysis.trendDeltaPct.toFixed(1)}%`}
            </strong>
          </span>
        </div>

        <div className="financial-analysis-two-col">
          <article className="financial-analysis-subcard">
            <h4>主要支出分类</h4>
            {analysis.previous.categoryRows.length > 0 ? (
              <div className="financial-analysis-category-list">
                {analysis.previous.categoryRows.map((item) => (
                  <article key={item.name} className="financial-analysis-category-item">
                    <header>
                      <strong>{item.name}</strong>
                      <span>{formatPercent(item.share * 100)}</span>
                    </header>
                    <div className="financial-analysis-progress-track">
                      <i style={{ width: `${Math.max(6, item.share * 100)}%` }} />
                    </div>
                    <small>{formatCurrency(item.amount)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">上一阶段还没有足够的支出分类样本。</p>
            )}
          </article>

          <article className="financial-analysis-subcard">
            <h4>复盘结论</h4>
            <p>{analysis.previous.insight}</p>
            <div className="financial-analysis-stat-grid">
              <div>
                <span>日均支出</span>
                <strong>{formatCurrency(analysis.previous.recentAverageDailyExpense)}</strong>
              </div>
              <div>
                <span>最大分类</span>
                <strong>{analysis.previous.topCategoryName}</strong>
              </div>
            </div>
            {analysis.previous.abnormalExpense ? (
              <div className="financial-analysis-highlight warning">
                <strong>异常支出提醒</strong>
                <p>
                  {analysis.previous.abnormalExpense.note || '未备注'} · {formatCurrency(analysis.previous.abnormalExpense.amount)}
                </p>
              </div>
            ) : null}
            <div className="financial-analysis-actions">
              {analysis.previous.actions.map((action) => (
                <button key={action.label} type="button" onClick={() => navigate(action.to)}>
                  {action.label}
                </button>
              ))}
            </div>
            <div className="financial-analysis-ai-columns">
              {previousQuickActions.map((action) => (
                <article key={action.label} className="financial-analysis-subcard">
                  <h4>{action.label}</h4>
                  <p className="financial-analysis-paragraph">{action.hint}</p>
                  <div className="financial-analysis-actions">
                    <button type="button" onClick={action.onClick}>
                      继续处理
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="panel financial-analysis-section">
        <div className="financial-analysis-section-head">
          <div>
            <h3>现在：诊断当前结构</h3>
            <p className="muted">把固定成本、负债压力和当前可支配空间放到同一视图里。</p>
          </div>
          <span className="metric-chip">
            健康度
            <strong>{analysis.present.debtHealthScore}</strong>
          </span>
        </div>

        <div className="financial-analysis-stat-grid is-three">
          <div>
            <span>固定成本</span>
            <strong>{formatCurrency(analysis.present.fixedExpenseAmount)}</strong>
            <small>{formatPercent(analysis.present.fixedExpenseRatio * 100)}</small>
          </div>
          <div>
            <span>订阅月成本</span>
            <strong>{formatCurrency(analysis.present.subscriptionMonthlyCost)}</strong>
            <small>已纳入固定支出观察</small>
          </div>
          <div>
            <span>可支配空间</span>
            <strong>{formatCurrency(analysis.present.disposableIncome)}</strong>
            <small>{formatPercent(analysis.present.debtPressureRatio * 100)} 债务压力</small>
          </div>
        </div>

        <p className="financial-analysis-paragraph">{analysis.present.insight}</p>
        <div className="financial-analysis-actions">
          {analysis.present.actions.map((action) => (
            <button key={action.label} type="button" onClick={() => navigate(action.to)}>
              {action.label}
            </button>
          ))}
        </div>
        <div className="financial-analysis-ai-columns">
          {presentQuickActions.map((action) => (
            <article key={action.label} className="financial-analysis-subcard">
              <h4>{action.label}</h4>
              <p className="financial-analysis-paragraph">{action.hint}</p>
              <div className="financial-analysis-actions">
                <button type="button" onClick={action.onClick}>
                  立即前往
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel financial-analysis-section">
        <div className="financial-analysis-section-head">
          <div>
            <h3>未来：提前预判压力</h3>
            <p className="muted">先做保守估算，再决定是控支、留缓冲，还是优先处理固定扣款。</p>
          </div>
          <span className="metric-chip">
            预测结余
            <strong>{formatCurrency(analysis.future.projectedMonthlyBalance)}</strong>
          </span>
        </div>

        <div className="financial-analysis-stat-grid is-three">
          <div>
            <span>建议缓冲</span>
            <strong>{formatCurrency(analysis.future.suggestedBuffer)}</strong>
            <small>用于固定扣款与突发波动</small>
          </div>
          <div>
            <span>近期订阅提醒</span>
            <strong>{analysis.future.dueSoonSubscriptionCount}</strong>
            <small>14 天内</small>
          </div>
          <div>
            <span>近期还款提醒</span>
            <strong>{analysis.future.dueSoonRepaymentCount}</strong>
            <small>10 天内</small>
          </div>
        </div>

        <div className="financial-analysis-highlight">
          <strong>预测说明</strong>
          <p>{analysis.future.insight}</p>
        </div>
        <div className="financial-analysis-actions">
          {analysis.future.actions.map((action) => (
            <button key={action.label} type="button" onClick={() => navigate(action.to)}>
              {action.label}
            </button>
          ))}
        </div>
        <div className="financial-analysis-ai-columns">
          {futureQuickActions.map((action) => (
            <article key={action.label} className="financial-analysis-subcard">
              <h4>{action.label}</h4>
              <p className="financial-analysis-paragraph">{action.hint}</p>
              <div className="financial-analysis-actions">
                <button type="button" onClick={action.onClick}>
                  去处理
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
