import { FormEvent, useMemo, useState } from 'react';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import {
  calculateDebtMinimumPayment,
  calculateDebtSummary,
  DebtType
} from '../../features/debt/model/debtMetrics';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';

export function RepaymentManagementPage() {
  const { debts, monthlyIncome, setMonthlyIncome, addDebt, removeDebt } = useAppPreferences();
  const { baseUrl, apiKey, model } = useAiSettings();
  const [error, setError] = useState('');
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('credit-card');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtAnnualRate, setDebtAnnualRate] = useState('');
  const [debtMonths, setDebtMonths] = useState('');
  const [repaymentAdvice, setRepaymentAdvice] = useState('');
  const [repaymentReasoning, setRepaymentReasoning] = useState('');
  const [repaymentLoading, setRepaymentLoading] = useState(false);

  const debtSummary = useMemo(
    () => calculateDebtSummary(debts, monthlyIncome),
    [debts, monthlyIncome]
  );

  function onAddDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const balance = Number(debtBalance);
    if (!debtName.trim() || !Number.isFinite(balance) || balance <= 0) {
      setError('请填写有效的负债名称和金额。');
      return;
    }

    addDebt({
      name: debtName.trim(),
      type: debtType,
      balance,
      annualRate: debtType === 'loan' ? Number(debtAnnualRate) || 0 : undefined,
      remainingMonths: debtType === 'loan' ? Number(debtMonths) || 12 : undefined
    });

    setDebtName('');
    setDebtBalance('');
    setDebtAnnualRate('');
    setDebtMonths('');
  }

  async function onGenerateRepaymentAdvice() {
    if (debts.length === 0) {
      setError('请先新增至少一条负债记录，再让 AI 生成建议。');
      return;
    }

    setError('');
    setRepaymentAdvice('');
    setRepaymentReasoning('');
    setRepaymentLoading(true);

    try {
      const debtLines = debts
        .map((item) => {
          const minimum = calculateDebtMinimumPayment(item);
          const typeLabel =
            item.type === 'credit-card' ? '信用卡' : item.type === 'huabei' ? '花呗' : '贷款';
          const annualRate = item.type === 'loan' ? `，年化利率 ${item.annualRate || 0}%` : '';
          const months = item.type === 'loan' ? `，剩余期数 ${item.remainingMonths || 12}` : '';
          return `${item.name}（${typeLabel}）：本金 ¥${item.balance.toFixed(2)}，最低还款 ¥${minimum.toFixed(2)}${annualRate}${months}`;
        })
        .join('\n');

      const result = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt:
          '你是资深个人财务顾问，请用简体中文给出可执行的还款管理建议。优先考虑现金流安全、降低利息、避免逾期，并给出分步骤计划。',
        messages: [
          {
            role: 'user',
            text: `请基于以下负债情况给我一个未来 3 个月还款方案，并输出：\n1) 优先级排序\n2) 每月执行动作\n3) 风险提醒\n\n月收入：¥${monthlyIncome.toFixed(2)}\n总负债：¥${debtSummary.totalDebt.toFixed(2)}\n每月最低还款：¥${debtSummary.totalMinimumPayment.toFixed(2)}\n负债压力：${(debtSummary.pressureRatio * 100).toFixed(1)}%\n\n负债列表：\n${debtLines}`
          }
        ]
      });

      setRepaymentAdvice(result.content);
      setRepaymentReasoning(result.reasoning || '');
    } catch (err) {
      setError((err as Error).message || 'AI 还款建议生成失败，请检查模型配置。');
    } finally {
      setRepaymentLoading(false);
    }
  }

  return (
    <div className="page-stack finance-page">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>💳 负债管理</h2>
        <p className="muted">支持信用卡、花呗、贷款，自动计算每月最低还款额与总负债压力。</p>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="muted">月收入（用于计算负债压力）</span>
            <input
              type="number"
              min={0}
              value={monthlyIncome || ''}
              onChange={(event) => setMonthlyIncome(Number(event.target.value) || 0)}
              placeholder="例如 15000"
            />
          </label>
        </div>

        <form onSubmit={onAddDebt} className="finance-debt-form-grid">
          <input
            value={debtName}
            onChange={(event) => setDebtName(event.target.value)}
            placeholder="负债名称"
          />
          <select
            value={debtType}
            onChange={(event) => setDebtType(event.target.value as DebtType)}
          >
            <option value="credit-card">信用卡</option>
            <option value="huabei">花呗</option>
            <option value="loan">贷款</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={debtBalance}
            onChange={(event) => setDebtBalance(event.target.value)}
            placeholder="剩余本金"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={debtAnnualRate}
            onChange={(event) => setDebtAnnualRate(event.target.value)}
            placeholder="年化利率%"
            disabled={debtType !== 'loan'}
          />
          <input
            type="number"
            min={1}
            value={debtMonths}
            onChange={(event) => setDebtMonths(event.target.value)}
            placeholder="剩余期数"
            disabled={debtType !== 'loan'}
          />
          <button type="submit">新增</button>
        </form>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {debts.length === 0 ? <p className="muted">还没有负债记录，先新增一条吧。</p> : null}
          {debts.map((item) => {
            const minimum = calculateDebtMinimumPayment(item);
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div>
                  <strong>
                    {item.name} ·
                    {item.type === 'credit-card'
                      ? '信用卡'
                      : item.type === 'huabei'
                        ? '花呗'
                        : '贷款'}
                  </strong>
                  <p className="muted" style={{ margin: 0 }}>
                    剩余本金 ¥{item.balance.toFixed(2)} · 最低还款 ¥{minimum.toFixed(2)}
                  </p>
                </div>
                <button type="button" onClick={() => removeDebt(item.id)}>
                  删除
                </button>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>负债压力总览</h3>
          <p style={{ margin: '4px 0' }}>总负债：¥{debtSummary.totalDebt.toFixed(2)}</p>
          <p style={{ margin: '4px 0' }}>
            每月最低还款：¥{debtSummary.totalMinimumPayment.toFixed(2)}
          </p>
          <p style={{ margin: '4px 0' }}>
            负债压力：{(debtSummary.pressureRatio * 100).toFixed(1)}%
            {monthlyIncome <= 0 ? '（请填写月收入）' : ''}
          </p>
        </div>

        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>🤖 AI 还款策略</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            结合当前负债与月收入，生成未来 3 个月分步还款建议。
          </p>
          <button type="button" onClick={onGenerateRepaymentAdvice} disabled={repaymentLoading}>
            {repaymentLoading ? '生成中...' : '生成 AI 还款建议'}
          </button>
          {repaymentAdvice ? (
            <pre className="finance-ai-result">{repaymentAdvice}</pre>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              暂无建议，点击上方按钮即可生成。
            </p>
          )}
          {repaymentReasoning ? (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer' }}>查看模型思考摘要</summary>
              <pre className="finance-ai-result">{repaymentReasoning}</pre>
            </details>
          ) : null}
        </div>

        {error ? <p className="muted">{error}</p> : null}
      </section>
    </div>
  );
}
