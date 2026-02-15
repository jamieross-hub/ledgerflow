import { useMemo, useState } from 'react';
import { formatCurrency } from '../../shared/lib/format';
import {
  BudgetAnswers,
  BudgetRecommendation,
  UserIdentity,
  generateBudgetRecommendation,
  getIdentityLabel
} from '../../features/smart-budget/model/budgetPlanner';
import { useSmartBudgetStore } from '../../shared/store/useSmartBudgetStore';

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

export function SmartBudgetPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<BudgetAnswers>(initialAnswers);
  const [draftRecommendation, setDraftRecommendation] = useState<BudgetRecommendation | null>(null);
  const confirmedPlan = useSmartBudgetStore((s) => s.confirmedPlan);
  const confirmPlan = useSmartBudgetStore((s) => s.confirmPlan);
  const clearPlan = useSmartBudgetStore((s) => s.clearPlan);

  const summary = useMemo(
    () =>
      `身份：${getIdentityLabel(answers.identity)} · 月收入：${answers.monthlyIncomeK} 千 · 固定支出：${answers.monthlyFixedExpenseK} 千 · 储蓄比例：${Math.round(answers.savingsRatio * 100)}%`,
    [answers]
  );

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
  };

  return (
    <section className="panel smart-budget-page">
      <header className="smart-budget-header">
        <h2>智能预算</h2>
        <p>通过 4 个问题快速生成可执行的月度分类预算，并支持一键确认保存。</p>
      </header>

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
                setAnswers((prev) => ({ ...prev, savingsRatio: Number(event.target.value) / 100 }))
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
          <button type="button" onClick={clearPlan}>
            清除已确认预算
          </button>
        </section>
      ) : null}
    </section>
  );
}
