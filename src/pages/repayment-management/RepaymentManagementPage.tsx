import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import {
  calculateDebtMinimumPayment,
  calculateDebtSummary,
  DebtType
} from '../../features/debt/model/debtMetrics';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const REPAYMENT_CACHE_KEY = 'ledgerflow-repayment-advice-cache-v1';

interface RepaymentAdviceCacheItem {
  key: string;
  advice: string;
  reasoning: string;
  createdAt: string;
}

type RepaymentAdviceCache = Record<string, RepaymentAdviceCacheItem>;

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
  if (value === 'credit-card' || value === 'huabei' || value === 'loan') return value;
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

export function RepaymentManagementPage() {
  const { debts, monthlyIncome, setMonthlyIncome, addDebt, replaceDebts, removeDebt } =
    useAppPreferences();
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
  const [repaymentCacheHint, setRepaymentCacheHint] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [debtImagePreview, setDebtImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            text: '请识别截图中的负债信息，并按以下 JSON 输出：{"monthlyIncome": number, "debts": [{"name": string, "type": "credit-card"|"huabei"|"loan", "balance": number, "annualRate": number, "remainingMonths": number}] }。\n要求：\n1) 未提及的字段可省略；\n2) 金额使用数字；\n3) 如果无法确定 type，默认 credit-card。',
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

    setError('');
    setRepaymentAdvice('');
    setRepaymentReasoning('');
    setRepaymentCacheHint('');

    const snapshotKey = buildRepaymentSnapshotKey({
      debts,
      monthlyIncome,
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
        <p className="muted">支持信用卡、花呗、贷款，自动计算每月最低还款额与总负债压力。</p>

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
      </section>
    </div>
  );
}
