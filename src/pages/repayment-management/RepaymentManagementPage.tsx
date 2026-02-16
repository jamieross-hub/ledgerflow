import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import {
  calculateDebtMinimumPayment,
  calculateDebtSummary,
  DebtType
} from '../../features/debt/model/debtMetrics';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { Toast } from '../../shared/ui/Toast';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const REPAYMENT_CACHE_KEY = 'ledgerflow-repayment-advice-cache-v1';
const MONTHLY_INCOME_CACHE_KEY = 'ledgerflow-repayment-income-cache-v1';
const INCOME_SAMPLE_LIMIT = 120;

interface RepaymentAdviceCacheItem {
  key: string;
  advice: string;
  reasoning: string;
  createdAt: string;
}

type RepaymentAdviceCache = Record<string, RepaymentAdviceCacheItem>;

interface MonthlyIncomeCacheItem {
  key: string;
  value: number;
  reasoning: string;
  createdAt: string;
}

type MonthlyIncomeCache = Record<string, MonthlyIncomeCacheItem>;

type ParsedDebtItem = {
  name: string;
  type: DebtType;
  balance: number;
  annualRate?: number;
  remainingMonths?: number;
};

function buildRepaymentSnapshotKey(input: {
  monthlyIncome: number;
  debts: {
    name: string;
    type: DebtType;
    balance: number;
    annualRate?: number;
    remainingMonths?: number;
  }[];
  model: string;
}): string {
  const normalizedDebts = [...input.debts]
    .map((item) => ({
      name: item.name.trim(),
      type: item.type,
      balance: Number(item.balance.toFixed(2)),
      annualRate: Number((item.annualRate || 0).toFixed(4)),
      remainingMonths: Math.max(0, Math.floor(item.remainingMonths || 0))
    }))
    .sort((a, b) => `${a.type}-${a.name}`.localeCompare(`${b.type}-${b.name}`, 'zh-CN'));

  return JSON.stringify({
    monthlyIncome: Number(input.monthlyIncome.toFixed(2)),
    model: input.model.trim(),
    debts: normalizedDebts
  });
}

function buildIncomeSnapshotKey(input: {
  model: string;
  transactions: { date: string; type: string; amount: number; note: string }[];
}): string {
  return JSON.stringify({
    model: input.model.trim(),
    transactions: input.transactions
      .map((item) => ({
        date: item.date,
        type: item.type,
        amount: Number(item.amount.toFixed(2)),
        note: item.note.trim()
      }))
      .sort((a, b) => `${a.date}-${a.amount}`.localeCompare(`${b.date}-${b.amount}`, 'zh-CN'))
  });
}

function readCache(): RepaymentAdviceCache {
  try {
    const raw = window.localStorage.getItem(REPAYMENT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as RepaymentAdviceCache;
  } catch {
    return {};
  }
}

function writeCache(next: RepaymentAdviceCache) {
  try {
    window.localStorage.setItem(REPAYMENT_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function readIncomeCache(): MonthlyIncomeCache {
  try {
    const raw = window.localStorage.getItem(MONTHLY_INCOME_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as MonthlyIncomeCache;
  } catch {
    return {};
  }
}

function writeIncomeCache(next: MonthlyIncomeCache) {
  try {
    window.localStorage.setItem(MONTHLY_INCOME_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'));
    reader.readAsDataURL(file);
  });
}

function extractJsonObject(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) return content.slice(start, end + 1);
  return content;
}

function normalizeDebtType(value: unknown): DebtType {
  if (value === 'huabei' || value === 'consumer-loan') return 'consumer-loan';
  if (value === 'credit-card' || value === 'loan') return value;
  return 'credit-card';
}

function parseDebtExtraction(content: string): { monthlyIncome?: number; debts: ParsedDebtItem[] } {
  const parsed = JSON.parse(extractJsonObject(content)) as {
    monthlyIncome?: unknown;
    debts?: unknown;
  };

  const debts = Array.isArray(parsed.debts)
    ? parsed.debts
        .map((item): ParsedDebtItem | null => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const name = String(row.name || '').trim();
          const balance = Number(row.balance || 0);
          if (!name || !Number.isFinite(balance) || balance <= 0) return null;

          const type = normalizeDebtType(row.type);
          const annualRateValue = Number(row.annualRate || 0);
          const annualRate =
            type === 'loan' && Number.isFinite(annualRateValue) && annualRateValue >= 0
              ? annualRateValue
              : undefined;
          const monthValue = Math.floor(Number(row.remainingMonths || 0));
          const remainingMonths =
            type === 'loan' && Number.isFinite(monthValue) && monthValue > 0 ? monthValue : 12;

          return {
            name,
            type,
            balance,
            annualRate,
            remainingMonths: type === 'loan' ? remainingMonths : undefined
          };
        })
        .filter((item): item is ParsedDebtItem => item !== null)
    : [];

  const income = Number(parsed.monthlyIncome || 0);
  return {
    monthlyIncome: Number.isFinite(income) && income >= 0 ? income : undefined,
    debts
  };
}

function parseIncomeExtraction(content: string): { monthlyIncome?: number; reasoning: string } {
  const parsed = JSON.parse(extractJsonObject(content)) as {
    monthlyIncome?: unknown;
    reasoning?: unknown;
  };
  const income = Number(parsed.monthlyIncome || 0);
  return {
    monthlyIncome: Number.isFinite(income) && income > 0 ? income : undefined,
    reasoning: String(parsed.reasoning || '').trim()
  };
}

function getPressureLevel(ratio: number): {
  tone: 'safe' | 'warning' | 'danger';
  label: string;
} {
  if (ratio < 0.3) {
    return { tone: 'safe', label: '健康' };
  }
  if (ratio < 0.6) {
    return { tone: 'warning', label: '关注' };
  }
  return { tone: 'danger', label: '偏高' };
}

export function RepaymentManagementPage() {
  const { debts, monthlyIncome, setMonthlyIncome, addDebt, replaceDebts, removeDebt } =
    useAppPreferences();
  const { baseUrl, apiKey, model } = useAiSettings();
  const transactions = useFinanceStore((state) => state.transactions);
  const [error, setError] = useState('');
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('credit-card');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtAnnualRate, setDebtAnnualRate] = useState('');
  const [debtMonths, setDebtMonths] = useState('');
  const [repaymentAdvice, setRepaymentAdvice] = useState('');
  const [repaymentReasoning, setRepaymentReasoning] = useState('');
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [repaymentCacheHint, setRepaymentCacheHint] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [incomeHint, setIncomeHint] = useState('');
  const [debtImagePreview, setDebtImagePreview] = useState('');
  const [debtFormError, setDebtFormError] = useState('');
  const [debtToastVisible, setDebtToastVisible] = useState(false);
  const [addDebtSuccess, setAddDebtSuccess] = useState(false);
  const [newDebtId, setNewDebtId] = useState('');
  const [listTransitioning, setListTransitioning] = useState(false);
  const debtIdsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const debtSummary = useMemo(
    () => calculateDebtSummary(debts, monthlyIncome),
    [debts, monthlyIncome]
  );
  const pressureLevel = useMemo(
    () => getPressureLevel(debtSummary.pressureRatio),
    [debtSummary.pressureRatio]
  );

  const incomeSamples = useMemo(
    () =>
      transactions
        .filter((item) => item.type === 'income' && Number.isFinite(Number(item.amount)))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, INCOME_SAMPLE_LIMIT)
        .map((item) => ({
          date: item.date,
          type: item.type,
          amount: Number(item.amount),
          note: item.note || ''
        })),
    [transactions]
  );

  const isLoanType = debtType === 'loan';
  const trimmedDebtName = debtName.trim();
  const balance = Number(debtBalance);
  const annualRate = Number(debtAnnualRate);
  const months = Number(debtMonths);
  const annualRateRaw = debtAnnualRate.trim();
  const isAnnualRateNumeric = annualRateRaw === '' || /^\d+(\.\d+)?$/.test(annualRateRaw);
  const canSubmitDebt =
    trimmedDebtName.length > 0 &&
    Number.isFinite(balance) &&
    balance > 0 &&
    (!isLoanType ||
      (annualRateRaw.length > 0 &&
        isAnnualRateNumeric &&
        Number.isFinite(annualRate) &&
        annualRate >= 0)) &&
    (!isLoanType ||
      (debtMonths.trim().length > 0 &&
        Number.isFinite(months) &&
        Number.isInteger(months) &&
        months > 0));

  useEffect(() => {
    const previousIds = debtIdsRef.current;
    const nextIds = debts.map((item) => item.id);
    const insertedId = nextIds.find((id) => !previousIds.includes(id));
    if (insertedId) {
      setNewDebtId(insertedId);
      setListTransitioning(true);
      window.setTimeout(() => setNewDebtId(''), 220);
      window.setTimeout(() => setListTransitioning(false), 220);
    }
    debtIdsRef.current = nextIds;
  }, [debts]);

  async function resolveMonthlyIncomeByAi(forceRefresh = false): Promise<number | null> {
    if (incomeSamples.length === 0) {
      setIncomeHint('账单详情里暂无收入记录，暂无法估算月收入。');
      return null;
    }

    const snapshotKey = buildIncomeSnapshotKey({
      model,
      transactions: incomeSamples
    });
    const cache = readIncomeCache();
    const cached = cache[snapshotKey];

    if (!forceRefresh && cached?.value > 0) {
      setMonthlyIncome(cached.value);
      setIncomeHint(
        `月收入已命中缓存：¥${cached.value.toFixed(2)}（${new Date(cached.createdAt).toLocaleString()}）`
      );
      return cached.value;
    }

    if (!apiKey.trim()) {
      setIncomeHint('未配置 AI Key，无法自动估算月收入。');
      return null;
    }

    setIncomeLoading(true);

    try {
      const sampleLines = incomeSamples
        .map(
          (item) =>
            `${item.date.slice(0, 10)} | ¥${item.amount.toFixed(2)} | ${item.note || '无备注'}`
        )
        .join('\n');

      const result = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt:
          '你是账单分析助手。你需要根据收入流水估算可用于还款管理的月收入平均值。只输出 JSON，不要输出其它说明。',
        messages: [
          {
            role: 'user',
            text: `请根据以下收入流水估算“月收入平均值”，输出 JSON：{"monthlyIncome": number, "reasoning": string}。\n要求：\n1) 仅依据输入流水；\n2) monthlyIncome 必须是正数；\n3) reasoning 用一句话说明估算依据。\n\n收入流水：\n${sampleLines}`
          }
        ]
      });

      const payload = parseIncomeExtraction(result.content);
      if (!payload.monthlyIncome || payload.monthlyIncome <= 0) {
        setIncomeHint('AI 未返回有效月收入，请检查账单详情中的收入数据。');
        return null;
      }

      setMonthlyIncome(payload.monthlyIncome);
      setIncomeHint(`月收入已由大模型估算并写入缓存：¥${payload.monthlyIncome.toFixed(2)}`);

      writeIncomeCache({
        ...cache,
        [snapshotKey]: {
          key: snapshotKey,
          value: payload.monthlyIncome,
          reasoning: payload.reasoning,
          createdAt: new Date().toISOString()
        }
      });

      return payload.monthlyIncome;
    } catch (err) {
      setError((err as Error).message || '月收入估算失败，请稍后重试。');
      return null;
    } finally {
      setIncomeLoading(false);
    }
  }

  function onAddDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedDebtName || !debtBalance.trim()) {
      setDebtFormError('请填写完整的负债名称和剩余本金。');
      return;
    }
    if (!Number.isFinite(balance) || balance <= 0) {
      setDebtFormError('剩余本金需为大于 0 的数字。');
      return;
    }
    if (isLoanType && !annualRateRaw) {
      setDebtFormError('请填写年利率。');
      return;
    }
    if (isLoanType && !isAnnualRateNumeric) {
      setDebtFormError('年利率只能输入数字。');
      return;
    }
    if (isLoanType && (!debtMonths.trim() || !Number.isInteger(months) || months <= 0)) {
      setDebtFormError('剩余期数需为大于 0 的整数。');
      return;
    }

    addDebt({
      name: trimmedDebtName,
      type: debtType,
      balance,
      annualRate: isLoanType ? annualRate : undefined,
      remainingMonths: isLoanType ? months : undefined
    });

    setDebtName('');
    setDebtBalance('');
    setDebtAnnualRate('');
    setDebtMonths('');
    setDebtFormError('');
    setDebtToastVisible(true);
    setAddDebtSuccess(true);
    window.setTimeout(() => setAddDebtSuccess(false), 800);
    setError('');
  }

  async function onExtractDebtFromScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!apiKey.trim()) {
      setError('请先在设置页配置 AI API Key。');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('仅支持上传图片文件。');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const maxSizeMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      setError(`图片过大，请上传不超过 ${maxSizeMb}MB 的截图。`);
      return;
    }

    setExtractLoading(true);
    setError('');

    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setDebtImagePreview(imageDataUrl);

      const result = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt:
          '你是负债信息识别助手。请从截图中提取负债数据，只输出 JSON，不要输出额外说明。',
        messages: [
          {
            role: 'user',
            text: '请识别截图中的负债信息，并按以下 JSON 输出：{"monthlyIncome": number, "debts": [{"name": string, "type": "credit-card"|"consumer-loan"|"loan", "balance": number, "annualRate": number, "remainingMonths": number}] }。\n要求：\n1) 未提及的字段可省略；\n2) 金额使用数字；\n3) 如果无法确定 type，默认 credit-card。',
            imageDataUrl
          }
        ]
      });

      const payload = parseDebtExtraction(result.content);
      if (payload.debts.length === 0) {
        setError('未识别到有效负债数据，请更换更清晰的截图再试。');
        return;
      }

      replaceDebts(payload.debts);
      if (typeof payload.monthlyIncome === 'number') {
        setMonthlyIncome(payload.monthlyIncome);
      }

      setRepaymentAdvice('');
      setRepaymentReasoning('');
      setRepaymentCacheHint('已根据截图更新负债信息，请点击“生成 AI 还款建议”。');
    } catch (err) {
      setError((err as Error).message || '截图识别失败，请稍后再试。');
    } finally {
      setExtractLoading(false);
    }
  }

  async function onGenerateRepaymentAdvice() {
    if (debts.length === 0) {
      setError('请先新增至少一条负债记录，再让 AI 生成建议。');
      return;
    }

    const activeIncome = monthlyIncome > 0 ? monthlyIncome : await resolveMonthlyIncomeByAi(false);
    if (!activeIncome || activeIncome <= 0) {
      setError('无法获得有效月收入，请先导入账单详情里的收入数据。');
      return;
    }

    setError('');
    setRepaymentAdvice('');
    setRepaymentReasoning('');
    setRepaymentCacheHint('');

    const summary = calculateDebtSummary(debts, activeIncome);

    const snapshotKey = buildRepaymentSnapshotKey({
      debts,
      monthlyIncome: activeIncome,
      model
    });
    const cache = readCache();
    const cached = cache[snapshotKey];
    if (cached) {
      setRepaymentAdvice(cached.advice);
      setRepaymentReasoning(cached.reasoning);
      setRepaymentCacheHint(`已命中缓存（${new Date(cached.createdAt).toLocaleString()} 生成）`);
      return;
    }

    setRepaymentLoading(true);

    try {
      const debtLines = debts
        .map((item) => {
          const minimum = calculateDebtMinimumPayment(item);
          const typeLabel =
            item.type === 'credit-card'
              ? '信用卡'
              : item.type === 'consumer-loan'
                ? '消费贷'
                : '贷款';
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
            text: `请基于以下负债情况给我一个未来 3 个月还款方案，并输出：\n1) 优先级排序\n2) 每月执行动作\n3) 风险提醒\n\n月收入（AI 估算）：¥${activeIncome.toFixed(2)}\n总负债：¥${summary.totalDebt.toFixed(2)}\n每月最低还款：¥${summary.totalMinimumPayment.toFixed(2)}\n负债压力：${(summary.pressureRatio * 100).toFixed(1)}%\n\n负债列表：\n${debtLines}`
          }
        ]
      });

      setRepaymentAdvice(result.content);
      setRepaymentReasoning(result.reasoning || '');

      const nextCache: RepaymentAdviceCache = {
        ...cache,
        [snapshotKey]: {
          key: snapshotKey,
          advice: result.content,
          reasoning: result.reasoning || '',
          createdAt: new Date().toISOString()
        }
      };
      writeCache(nextCache);
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
        <p className="muted">支持信用卡、消费贷、贷款，自动计算每月最低还款额与总负债压力。</p>

        <div className="card" style={{ marginBottom: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>📷 上传截图并自动填写</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            上传账单截图后，AI 会自动识别负债信息并填充到下方列表。
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={extractLoading}
            >
              {extractLoading ? '识别中...' : '上传负债截图'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onExtractDebtFromScreenshot}
            />
            <span className="muted">支持支付宝/银行/信用卡账单截图。</span>
          </div>
          {debtImagePreview ? (
            <img
              src={debtImagePreview}
              alt="负债截图预览"
              style={{
                marginTop: 10,
                maxWidth: 260,
                borderRadius: 8,
                border: '1px solid var(--color-border)'
              }}
            />
          ) : null}
        </div>

        <div className="card" style={{ marginBottom: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>💡 月收入（由大模型接管）</h3>
          <p className="muted" style={{ margin: '0 0 8px 0' }}>
            还款管理不再手填月收入，将基于账单详情中的收入记录由大模型估算平均值并写入缓存。
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            当前月收入：{monthlyIncome > 0 ? `¥${monthlyIncome.toFixed(2)}` : '尚未估算'}
          </p>
          <button
            type="button"
            onClick={() => void resolveMonthlyIncomeByAi(true)}
            disabled={incomeLoading}
          >
            {incomeLoading ? '估算中...' : '刷新 AI 月收入'}
          </button>
          {incomeHint ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {incomeHint}
            </p>
          ) : null}
        </div>

        <div
          className="card finance-secondary-panel finance-debt-entry-card"
          style={{ marginBottom: 12, padding: 24 }}
        >
          <div className="finance-debt-entry-header">
            <div>
              <h3 style={{ margin: 0 }}>添加负债</h3>
              <p className="muted" style={{ margin: '4px 0 0 0' }}>
                手动填写负债信息
              </p>
            </div>
            <span className="finance-debt-entry-icon" aria-hidden>
              💳
            </span>
          </div>
          <p className="muted" style={{ margin: '0 0 8px 0' }}>
            用于补充识别失败或新增账单，贷款支持年化利率与期数输入。
          </p>
          <form onSubmit={onAddDebt} className="finance-debt-form-grid">
            <div className="finance-debt-form-row finance-debt-form-row-primary">
              <input
                className="finance-debt-form-control"
                value={debtName}
                onChange={(event) => {
                  setDebtName(event.target.value);
                  setDebtFormError('');
                }}
                placeholder="如 招商银行信用卡"
              />
              <select
                className="finance-debt-form-control"
                value={debtType}
                onChange={(event) => setDebtType(event.target.value as DebtType)}
              >
                <option value="credit-card">信用卡</option>
                <option value="consumer-loan">消费贷</option>
                <option value="loan">贷款</option>
              </select>
            </div>
            <div className="finance-debt-form-row finance-debt-form-row-detail">
              <input
                className="finance-debt-form-control"
                type="number"
                min={0}
                step="0.01"
                value={debtBalance}
                onChange={(event) => {
                  setDebtBalance(event.target.value);
                  setDebtFormError('');
                }}
                placeholder="如 12000"
              />
              <input
                className="finance-debt-form-control"
                type="number"
                min={0}
                step="0.01"
                value={debtAnnualRate}
                onChange={(event) => {
                  setDebtAnnualRate(event.target.value);
                  setDebtFormError('');
                }}
                inputMode="decimal"
                placeholder="如 15"
                disabled={!isLoanType}
              />
              <input
                className="finance-debt-form-control"
                type="number"
                min={1}
                value={debtMonths}
                onChange={(event) => {
                  setDebtMonths(event.target.value);
                  setDebtFormError('');
                }}
                placeholder="如 12"
                disabled={!isLoanType}
              />
            </div>
            {debtFormError ? (
              <p className="muted finance-debt-form-error">{debtFormError}</p>
            ) : null}
            <div className="finance-debt-form-actions">
              <button
                type="submit"
                className="primary finance-debt-submit"
                disabled={!canSubmitDebt}
              >
                {addDebtSuccess ? '✔ 已添加' : '+ 添加负债'}
              </button>
            </div>
          </form>
        </div>

        <div
          className={`finance-debt-list ${listTransitioning ? 'finance-debt-list-shift' : ''}`}
          style={{ marginTop: 12, display: 'grid', gap: 8 }}
        >
          {debts.length === 0 ? <p className="muted">还没有负债记录，先新增一条吧。</p> : null}
          {debts.map((item) => {
            const minimum = calculateDebtMinimumPayment(item);
            return (
              <div
                key={item.id}
                className={item.id === newDebtId ? 'finance-debt-item-enter' : ''}
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
                      : item.type === 'consumer-loan'
                        ? '消费贷'
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

        <div className="card finance-overview-panel" style={{ marginTop: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>📊 负债压力总览</h3>
          <div className="finance-overview-grid">
            <article className="finance-overview-metric-card">
              <p className="finance-overview-label">总负债</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">{debtSummary.totalDebt.toFixed(2)}</span>
                <span className="finance-overview-unit">¥</span>
              </p>
            </article>
            <article className="finance-overview-metric-card">
              <p className="finance-overview-label">每月最低还款</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">
                  {debtSummary.totalMinimumPayment.toFixed(2)}
                </span>
                <span className="finance-overview-unit">¥</span>
              </p>
            </article>
            <article
              className={`finance-overview-metric-card finance-overview-pressure-card finance-overview-pressure-${pressureLevel.tone}`}
            >
              <p className="finance-overview-label">负债率（{pressureLevel.label}）</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">
                  {(debtSummary.pressureRatio * 100).toFixed(1)}
                </span>
                <span className="finance-overview-unit">%</span>
              </p>
            </article>
          </div>
          {monthlyIncome <= 0 ? (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              负债率待 AI 从账单详情估算月收入后会更准确。
            </p>
          ) : null}
        </div>

        <div className="card finance-primary-panel" style={{ marginTop: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>🤖 AI 还款策略</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            结合当前负债与 AI 估算月收入，生成未来 3 个月分步还款建议。
          </p>
          <button type="button" onClick={onGenerateRepaymentAdvice} disabled={repaymentLoading}>
            {repaymentLoading ? '生成中...' : '生成 AI 还款建议'}
          </button>
          {repaymentCacheHint ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {repaymentCacheHint}
            </p>
          ) : null}
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
        <Toast
          visible={debtToastVisible}
          message="负债已添加"
          variant="success"
          duration={1200}
          onClose={() => setDebtToastVisible(false)}
        />
      </section>
    </div>
  );
}
