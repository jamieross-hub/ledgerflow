import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../shared/lib/format';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';
import {
  BudgetAnswers,
  BudgetRecommendation,
  UserIdentity,
  generateBudgetRecommendation,
  getIdentityLabel
} from '../../features/smart-budget/model/budgetPlanner';
import { useSmartBudgetStore } from '../../shared/store/useSmartBudgetStore';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import {
  buildBudgetTrackingRows,
  getRecentMonthOptions
} from '../../features/smart-budget/model/budgetInsights';

const identityOptions: Array<{ value: UserIdentity; label: string; helper: string }> = [
  { value: 'student', label: '学生', helper: '课程、成长和生活费通常占比较高。' },
  { value: 'employee', label: '上班族', helper: '通勤、家庭与长期储蓄需要更平衡。' },
  { value: 'freelancer', label: '自由职业者', helper: '收入波动较大，建议提高风险缓冲。' },
  { value: 'other', label: '其他', helper: '系统会按通用支出结构推荐。' }
];

const ratioQuickOptions = [0.2, 0.3, 0.4, 0.5];

const initialAnswers: BudgetAnswers = {
  identity: 'employee',
  monthlyIncomeK: 10,
  monthlyFixedExpenseK: 3,
  savingsRatio: 0.3
};

function extractFirstJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  throw new Error('AI 返回内容不是有效 JSON');
}

const COMMON_CATEGORY_PRESETS = [
  '餐饮',
  '衣物穿搭',
  '住房',
  '水电燃气',
  '交通',
  '购物日用',
  '通讯网络',
  '医疗健康',
  '教育学习',
  '娱乐社交',
  '旅行',
  '人情往来',
  '工资',
  '奖金',
  '理财收益',
  '退款返现',
  '保险',
  '税费',
  '还款',
  '其他'
];

export function SmartBudgetPage() {
  const confirmedPlan = useSmartBudgetStore((s) => s.confirmedPlan);
  const confirmPlan = useSmartBudgetStore((s) => s.confirmPlan);
  const clearPlan = useSmartBudgetStore((s) => s.clearPlan);

  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const addCategory = useFinanceStore((s) => s.addCategory);

  const { baseUrl, apiKey, model } = useAiSettings();
  const hasAiConfig = Boolean(baseUrl.trim()) && Boolean(apiKey.trim()) && Boolean(model.trim());

  const [mode, setMode] = useState<'setup' | 'management'>(() =>
    confirmedPlan ? 'management' : 'setup'
  );
  const [setupOpen, setSetupOpen] = useState(() => !confirmedPlan);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'overspent' | 'safe'>('all');
  const [answers, setAnswers] = useState<BudgetAnswers>(initialAnswers);
  const [draftRecommendation, setDraftRecommendation] = useState<BudgetRecommendation | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [aiAdvice, setAiAdvice] = useState<
    | null
    | {
        summary: string;
        suggestions: string[];
        focusCategories?: Array<{ category: string; action: 'increase' | 'decrease' | 'keep'; reason: string }>;
      }
  >(null);

  const monthOptions = useMemo(() => getRecentMonthOptions(transactions), [transactions]);

  const activeMonthKey = selectedMonthKey || monthOptions[0]?.key || '';

  const trackingRows = useMemo(() => {
    if (!confirmedPlan || !activeMonthKey) {
      return [];
    }

    return buildBudgetTrackingRows({
      recommendation: confirmedPlan.recommendation,
      transactions,
      categories,
      monthKey: activeMonthKey
    });
  }, [confirmedPlan, transactions, categories, activeMonthKey]);

  const visibleRows = useMemo(() => {
    if (statusFilter === 'overspent') {
      return trackingRows.filter((item) => item.isOverspent);
    }
    if (statusFilter === 'safe') {
      return trackingRows.filter((item) => !item.isOverspent);
    }
    return trackingRows;
  }, [statusFilter, trackingRows]);

  const overspentCount = trackingRows.filter((item) => item.isOverspent).length;

  const summary = useMemo(
    () =>
      `身份：${getIdentityLabel(answers.identity)} · 月收入：${answers.monthlyIncomeK} 千 · 固定支出：${answers.monthlyFixedExpenseK} 千 · 储蓄比例：${Math.round(answers.savingsRatio * 100)}%`,
    [answers]
  );

  useEffect(() => {
    if (!confirmedPlan) {
      setMode('setup');
      setSetupOpen(true);
      return;
    }
    setMode('management');
    setSetupOpen(false);
  }, [confirmedPlan]);

  useEffect(() => {
    if (transactions.length > 0) return;
    const existing = new Set(categories.map((item) => item.name.trim().toLocaleLowerCase('zh-CN')));
    COMMON_CATEGORY_PRESETS.forEach((name) => {
      if (!existing.has(name.toLocaleLowerCase('zh-CN'))) {
        addCategory(name);
      }
    });
  }, [transactions.length, categories, addCategory]);

  useEffect(() => {
    if (!confirmedPlan || !activeMonthKey || trackingRows.length === 0) {
      setAiStatus('idle');
      setAiError('');
      setAiAdvice(null);
      return;
    }

    if (!hasAiConfig) {
      setAiStatus('error');
      setAiError('未配置 AI 模型，请先在设置页完成模型地址、密钥与模型名称。');
      setAiAdvice(null);
      return;
    }

    let canceled = false;
    setAiStatus('loading');
    setAiError('');

    void (async () => {
      try {
        const response = await sendAiChat({
          baseUrl,
          apiKey,
          model,
          systemPrompt:
            '你是预算优化助手。仅输出 JSON：{"summary":"一句话总结","suggestions":["建议1","建议2"],"focusCategories":[{"category":"分类名","action":"increase|decrease|keep","reason":"原因"}] }。focusCategories 最多 6 项。',
          messages: [
            {
              role: 'user',
              text: `请基于以下预算执行数据给出可执行建议：\n${JSON.stringify(
                {
                  monthKey: activeMonthKey,
                  profile: {
                    identity: getIdentityLabel(confirmedPlan.answers.identity),
                    income: confirmedPlan.recommendation.monthlyIncome,
                    fixedExpense: confirmedPlan.recommendation.monthlyFixedExpense,
                    savingsAmount: confirmedPlan.recommendation.savingsAmount
                  },
                  availableCategories: categories.map((item) => item.name),
                  rows: trackingRows.map((item) => ({
                    category: item.category,
                    budgetAmount: item.budgetAmount,
                    spentAmount: item.spentAmount,
                    ratio: Number(item.ratio.toFixed(3)),
                    overspent: item.isOverspent
                  }))
                },
                null,
                2
              )}`
            }
          ]
        });

        if (canceled) return;

        const parsed = JSON.parse(extractFirstJsonObject(response.content)) as {
          summary?: unknown;
          suggestions?: unknown;
          focusCategories?: unknown;
        };

        const suggestions = Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map((item) => String(item)).filter(Boolean).slice(0, 6)
          : [];
        const focusCategories = Array.isArray(parsed.focusCategories)
          ? parsed.focusCategories
              .map((item) => {
                if (!item || typeof item !== 'object') return null;
                const row = item as { category?: unknown; action?: unknown; reason?: unknown };
                const action =
                  row.action === 'increase' || row.action === 'decrease' || row.action === 'keep'
                    ? row.action
                    : 'keep';
                return {
                  category: String(row.category || ''),
                  action,
                  reason: String(row.reason || '')
                };
              })
              .filter(
                (item): item is { category: string; action: 'increase' | 'decrease' | 'keep'; reason: string } =>
                  Boolean(item?.category)
              )
              .slice(0, 6)
          : [];

        setAiAdvice({
          summary: String(parsed.summary || '预算执行总体平稳，可持续跟踪超支项。'),
          suggestions,
          focusCategories
        });
        setAiStatus('done');
      } catch (err) {
        if (canceled) return;
        setAiStatus('error');
        setAiAdvice(null);
        setAiError(err instanceof Error ? err.message : 'AI 建议生成失败');
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    confirmedPlan,
    activeMonthKey,
    trackingRows,
    hasAiConfig,
    baseUrl,
    apiKey,
    model,
    categories
  ]);

  const goNext = () => {
    setError(null);

    if (step === 2 && answers.monthlyIncomeK <= 0) {
      setError('每月收入必须大于 0。');
      return;
    }

    if (step === 3) {
      if (answers.monthlyFixedExpenseK < 0) {
        setError('固定支出不能为负数。');
        return;
      }
      if (answers.monthlyFixedExpenseK >= answers.monthlyIncomeK) {
        setError('固定支出必须小于每月收入。');
        return;
      }
    }

    if (step === 4) {
      try {
        const result = generateBudgetRecommendation(answers);
        setDraftRecommendation(result);
      } catch (validationError) {
        setError(validationError instanceof Error ? validationError.message : '预算生成失败。');
        return;
      }
    }

    setStep((current) => Math.min(current + 1, 5));
  };

  const goPrev = () => {
    setError(null);
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleConfirm = () => {
    if (!draftRecommendation) {
      return;
    }
    confirmPlan({ answers, recommendation: draftRecommendation });
    setSetupOpen(false);
    setMode('management');
  };

  const progressPercent = (ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return 0;
    }
    return Math.min(Math.round(ratio * 100), 160);
  };

  return (
    <section className="panel smart-budget-page">
      <header className="smart-budget-header">
        <h2>智能预算</h2>
        <p>通过 4 个问题快速生成预算，确认后进入预算管理查看近期预算执行是否超支。</p>
      </header>

      <div className="smart-budget-mode-switch" role="tablist" aria-label="智能预算模式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'setup'}
          className={mode === 'setup' ? 'active' : ''}
          onClick={() => {
            setMode('setup');
            setSetupOpen(true);
          }}
        >
          预算设置
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'management'}
          className={mode === 'management' ? 'active' : ''}
          onClick={() => {
            setMode('management');
            setSetupOpen(false);
          }}
          disabled={!confirmedPlan}
        >
          智能预算管理
        </button>
      </div>

      {confirmedPlan && mode === 'management' && !setupOpen ? (
        <p className="smart-budget-empty">
          预算设置已折叠。{' '}
          <button
            type="button"
            className="smart-budget-inline-btn"
            onClick={() => {
              setMode('setup');
              setSetupOpen(true);
            }}
          >
            展开预算设置
          </button>
        </p>
      ) : null}

      {mode === 'management' ? (
        confirmedPlan ? (
          <section className="smart-budget-management" aria-label="智能预算管理看板">
            <div className="smart-budget-management-topbar">
              <div className="field">
                <label htmlFor="budget-month">最近月份</label>
                <select
                  id="budget-month"
                  value={activeMonthKey}
                  onChange={(event) => setSelectedMonthKey(event.target.value)}
                >
                  {monthOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="smart-budget-filter-group" role="group" aria-label="预算状态过滤">
                <button
                  type="button"
                  className={statusFilter === 'all' ? 'active' : ''}
                  onClick={() => setStatusFilter('all')}
                >
                  全部 {trackingRows.length}
                </button>
                <button
                  type="button"
                  className={statusFilter === 'overspent' ? 'active' : ''}
                  onClick={() => setStatusFilter('overspent')}
                >
                  已超支 {overspentCount}
                </button>
                <button
                  type="button"
                  className={statusFilter === 'safe' ? 'active' : ''}
                  onClick={() => setStatusFilter('safe')}
                >
                  正常 {trackingRows.length - overspentCount}
                </button>
              </div>
            </div>

            <section className="smart-budget-ai-card" aria-live="polite">
              <h4 style={{ margin: 0 }}>🤖 AI 预算建议</h4>
              {aiStatus === 'loading' ? <p className="smart-budget-empty">正在生成预算优化建议...</p> : null}
              {aiStatus === 'error' ? <p className="smart-budget-error">{aiError}</p> : null}
              {aiStatus === 'done' && aiAdvice ? (
                <>
                  <p className="smart-budget-ai-summary">{aiAdvice.summary}</p>
                  {aiAdvice.suggestions.length ? (
                    <ul className="smart-budget-ai-list">
                      {aiAdvice.suggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {aiAdvice.focusCategories?.length ? (
                    <div className="smart-budget-ai-tags">
                      {aiAdvice.focusCategories.map((item) => (
                        <span key={`${item.category}-${item.action}`} className={`ai-tag ${item.action}`}>
                          {item.category}：
                          {item.action === 'decrease'
                            ? '建议收紧'
                            : item.action === 'increase'
                              ? '可适度加配'
                              : '保持'}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            {visibleRows.length ? (
              <div className="smart-budget-progress-list">
                {visibleRows.map((item) => (
                  <article key={item.category} className="smart-budget-progress-card">
                    <header>
                      <h4>{item.category}</h4>
                      <span className={item.isOverspent ? 'warn' : 'safe'}>
                        {item.isOverspent ? `超支 ${formatCurrency(item.diff)}` : '预算内'}
                      </span>
                    </header>
                    <p>
                      已花费 {formatCurrency(item.spentAmount)} / 预算{' '}
                      {formatCurrency(item.budgetAmount)}
                    </p>
                    <div className="smart-budget-progress-track" aria-hidden="true">
                      <span
                        className={item.isOverspent ? 'warn' : ''}
                        style={{ width: `${progressPercent(item.ratio)}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="smart-budget-empty">当前筛选条件下暂无预算项，请切换月份或筛选条件。</p>
            )}
          </section>
        ) : (
          <p className="smart-budget-empty">请先完成预算设置并确认后，再查看智能预算管理。</p>
        )
      ) : null}

      {mode === 'setup' && setupOpen ? (
        <>
          <div className="smart-budget-stepper" aria-label="预算问答步骤">
            {[1, 2, 3, 4, 5].map((value) => (
              <span
                key={value}
                className={value === step ? 'active' : value < step ? 'done' : ''}
                aria-current={value === step ? 'step' : undefined}
              >
                {value <= 4 ? `问题 ${value}` : '确认'}
              </span>
            ))}
          </div>

          {step === 1 ? (
            <div className="smart-budget-block">
              <h3>问题 1：你目前的身份是？</h3>
              <div className="smart-budget-choice-grid">
                {identityOptions.map((item) => (
                  <label key={item.value} className="smart-budget-choice-card">
                    <input
                      type="radio"
                      name="identity"
                      value={item.value}
                      checked={answers.identity === item.value}
                      onChange={() => setAnswers((prev) => ({ ...prev, identity: item.value }))}
                    />
                    <strong>{item.label}</strong>
                    <span>{item.helper}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="smart-budget-block">
              <h3>问题 2：每月收入（禁止输入 0，以千为单位）</h3>
              <div className="field">
                <label htmlFor="income-k">示例：8 代表 8000 元</label>
                <input
                  id="income-k"
                  type="number"
                  min={1}
                  step={1}
                  value={answers.monthlyIncomeK}
                  onChange={(event) =>
                    setAnswers((prev) => ({ ...prev, monthlyIncomeK: Number(event.target.value) }))
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="smart-budget-block">
              <h3>问题 3：每月固定支出有多少（以千为单位）</h3>
              <p>包含房租/房贷、固定账单、长期订阅等刚性成本。</p>
              <div className="field">
                <label htmlFor="fixed-expense-k">示例：3 代表 3000 元</label>
                <input
                  id="fixed-expense-k"
                  type="number"
                  min={0}
                  step={0.5}
                  value={answers.monthlyFixedExpenseK}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      monthlyFixedExpenseK: Number(event.target.value)
                    }))
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="smart-budget-block">
              <h3>问题 4：设置预算比例（快捷选择或滑动选择）</h3>
              <p>该比例用于“可支配收入”中的储蓄/投资占比。</p>

              <div className="smart-budget-ratio-options">
                {ratioQuickOptions.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className={answers.savingsRatio === ratio ? 'active' : ''}
                    onClick={() => setAnswers((prev) => ({ ...prev, savingsRatio: ratio }))}
                  >
                    {Math.round(ratio * 100)}%
                  </button>
                ))}
              </div>

              <div className="field">
                <label htmlFor="savings-ratio-range">
                  当前比例：{Math.round(answers.savingsRatio * 100)}%
                </label>
                <input
                  id="savings-ratio-range"
                  type="range"
                  min={10}
                  max={60}
                  step={1}
                  value={Math.round(answers.savingsRatio * 100)}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      savingsRatio: Number(event.target.value) / 100
                    }))
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 5 && draftRecommendation ? (
            <div className="smart-budget-block">
              <h3>月分类预算推荐（可确认保存）</h3>
              <p>{summary}</p>
              <div className="smart-budget-result-grid">
                <article className="smart-budget-stat-card">
                  <span>月收入</span>
                  <strong>{formatCurrency(draftRecommendation.monthlyIncome)}</strong>
                </article>
                <article className="smart-budget-stat-card">
                  <span>固定支出</span>
                  <strong>{formatCurrency(draftRecommendation.monthlyFixedExpense)}</strong>
                </article>
                <article className="smart-budget-stat-card">
                  <span>储蓄/投资</span>
                  <strong>{formatCurrency(draftRecommendation.savingsAmount)}</strong>
                </article>
                <article className="smart-budget-stat-card">
                  <span>灵活预算</span>
                  <strong>{formatCurrency(draftRecommendation.flexibleBudget)}</strong>
                </article>
              </div>

              <div className="table-wrap">
                <table className="table smart-budget-table">
                  <thead>
                    <tr>
                      <th>分类</th>
                      <th>金额</th>
                      <th>占月收入比例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftRecommendation.categoryBudgets.map((row) => (
                      <tr key={row.category}>
                        <td>{row.category}</td>
                        <td>{formatCurrency(row.amount)}</td>
                        <td>{(row.ratio * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="smart-budget-actions">
                <button type="button" className="primary" onClick={handleConfirm}>
                  确认使用该预算建议
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftRecommendation(null);
                    setStep(1);
                    setError(null);
                  }}
                >
                  重新填写问答
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="smart-budget-error">{error}</p> : null}

          <footer className="smart-budget-footer">
            <button type="button" onClick={goPrev} disabled={step === 1}>
              上一步
            </button>
            <button type="button" className="primary" onClick={goNext} disabled={step >= 5}>
              {step === 4 ? '生成预算推荐' : '下一步'}
            </button>
          </footer>

          {confirmedPlan ? (
            <section className="smart-budget-confirmed panel">
              <h3>已确认预算</h3>
              <p>
                最近确认时间：
                {new Date(confirmedPlan.confirmedAt).toLocaleString('zh-CN', { hour12: false })}
              </p>
              <p>
                身份：{getIdentityLabel(confirmedPlan.answers.identity)}，储蓄比例：
                {Math.round(confirmedPlan.answers.savingsRatio * 100)}%
              </p>
              <button
                type="button"
                onClick={() => {
                  clearPlan();
                  setSetupOpen(true);
                  setMode('setup');
                  setAiStatus('idle');
                  setAiAdvice(null);
                  setAiError('');
                }}
              >
                清除已确认预算
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
