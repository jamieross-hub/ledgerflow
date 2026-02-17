import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TransactionStatus } from '../../entities/transaction/types';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { extractJsonString } from '../../features/assistant/workbench/workbenchUtils';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { useAiSettings } from '../../shared/store/useAiSettings';

interface RecognitionSuggestion {
  merchant: string;
  category: string;
  reason: string;
}

const MAX_AMOUNT = 999999999.99;
const MIN_DATE = '2000-01-01T00:00';
const MAX_DATE = '2100-12-31T23:59';

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatLocalDateTime(raw: string): string {
  const d = new Date(raw);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function suggestTags(note: string, merchantOrderNo: string, orderNo: string): string[] {
  const source = `${note} ${merchantOrderNo} ${orderNo}`.toLowerCase();
  const rules: Array<{ keyword: RegExp; tag: string }> = [
    { keyword: /(星巴克|咖啡|奶茶|茶饮)/, tag: '饮品' },
    { keyword: /(超市|便利店|盒马|永辉)/, tag: '日用品' },
    { keyword: /(地铁|公交|打车|滴滴|高铁)/, tag: '出行' },
    { keyword: /(外卖|美团|饿了么|餐)/, tag: '餐饮' },
    { keyword: /(工资|薪资|奖金)/, tag: '工资收入' },
    { keyword: /(淘宝|京东|拼多多)/, tag: '网购' }
  ];
  return rules.filter((item) => item.keyword.test(source)).map((item) => item.tag);
}

function validateAmount(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const normalized = raw.trim();
  if (!normalized) {
    return { ok: false, message: '请输入金额。' };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, message: '金额格式不正确，仅支持最多 2 位小数。' };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: '金额必须大于 0。' };
  }

  if (value > MAX_AMOUNT) {
    return { ok: false, message: `金额过大，请输入不超过 ${MAX_AMOUNT} 的数值。` };
  }

  return { ok: true, value };
}

function validateDate(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  if (!raw) {
    return { ok: false, message: '请输入日期时间。' };
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return { ok: false, message: '日期时间格式不正确。' };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: '日期时间无效，请重新输入。' };
  }

  if (formatLocalDateTime(date.toISOString()) !== raw) {
    return { ok: false, message: '日期时间无效，请检查年月日和时间。' };
  }

  if (raw < MIN_DATE || raw > MAX_DATE) {
    return { ok: false, message: '日期超出允许范围（2000-01-01 ~ 2100-12-31）。' };
  }

  return { ok: true, value: date.toISOString() };
}

export function TransactionEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const aiBaseUrl = useAiSettings((s) => s.baseUrl);
  const aiApiKey = useAiSettings((s) => s.apiKey);
  const aiModel = useAiSettings((s) => s.model);

  const current = useMemo(() => transactions.find((item) => item.id === id), [transactions, id]);
  const [type, setType] = useState<'income' | 'expense' | 'budget' | 'repayment'>(
    current?.type ?? 'expense'
  );
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? categories[0]?.id ?? '');
  const [accountId, setAccountId] = useState(current?.accountId ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState(String(current?.amount ?? ''));
  const [date, setDate] = useState(() => {
    const raw = current?.date ?? new Date().toISOString();
    return formatLocalDateTime(raw);
  });
  const [note, setNote] = useState(current?.note ?? '');
  const [tags, setTags] = useState(current?.tags.join(',') ?? '');
  const [orderNo, setOrderNo] = useState(current?.orderNo ?? '');
  const [merchantOrderNo, setMerchantOrderNo] = useState(current?.merchantOrderNo ?? '');
  const [status, setStatus] = useState<TransactionStatus>(current?.status ?? 'completed');
  const [amountError, setAmountError] = useState('');
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [suggestion, setSuggestion] = useState<RecognitionSuggestion | null>(null);

  const suggestedTags = useMemo(
    () =>
      suggestTags(note, merchantOrderNo, orderNo).filter((tag) => !parseTags(tags).includes(tag)),
    [note, merchantOrderNo, orderNo, tags]
  );

  const handleBack = useCallback(() => {
    navigate('/transactions');
  }, [navigate]);

  const recognizeMerchant = useCallback(async () => {
    const text = note.trim();
    if (!text || !aiBaseUrl || !aiModel) return;
    setRecognizing(true);
    try {
      const prompt = `请识别交易备注中的商户名称与分类，只返回 JSON：{"merchant":"", "category":"", "reason":""}。备注：${text}`;
      const res = await sendAiChat({
        baseUrl: aiBaseUrl,
        apiKey: aiApiKey,
        model: aiModel,
        messages: [{ role: 'user', text: prompt }]
      });
      const raw = extractJsonString(res?.content || '');
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecognitionSuggestion;
      if (!parsed?.merchant && !parsed?.category) return;
      setSuggestion(parsed);
    } catch {
      // ignore suggestion failures
    } finally {
      setRecognizing(false);
    }
  }, [aiApiKey, aiBaseUrl, aiModel, note]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      handleBack();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBack]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAmountError('');
    setDateError('');
    setFormError('');

    if (!categoryId) {
      setFormError('分类不能为空，请先选择或新建分类。');
      return;
    }

    if (!accountId) {
      setFormError('请先选择账户。');
      return;
    }

    const amountResult = validateAmount(amount);
    if (!amountResult.ok) {
      setAmountError(amountResult.message);
      return;
    }

    const dateResult = validateDate(date);
    if (!dateResult.ok) {
      setDateError(dateResult.message);
      return;
    }

    const mergedTags = Array.from(
      new Set([...parseTags(tags), ...suggestTags(note, merchantOrderNo, orderNo)])
    );
    const payload = {
      type,
      categoryId,
      accountId,
      amount: amountResult.value,
      date: dateResult.value,
      note,
      tags: mergedTags,
      source: current?.source ?? 'manual',
      orderNo: orderNo.trim() || undefined,
      merchantOrderNo: merchantOrderNo.trim() || undefined,
      status
    };

    if (id) {
      updateTransaction(id, payload);
    } else {
      addTransaction(payload);
    }
    navigate('/transactions');
  }

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <button type="button" onClick={handleBack} aria-label="返回交易列表">
          ← 返回
        </button>
        <small style={{ color: 'var(--color-text-secondary)' }}>按 Esc 快速返回</small>
      </div>
      <h2>{id ? '编辑账目' : '新增账目'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>类型</label>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as 'income' | 'expense' | 'budget' | 'repayment')
            }
          >
            <option value="expense">支出</option>
            <option value="income">收入</option>
            <option value="budget">预算</option>
            <option value="repayment">还款</option>
          </select>
        </div>

        <div className="field">
          <label>分类</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.icon || '📁') + ' ' + item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>账户</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>金额</label>
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) {
                setAmountError('');
              }
            }}
            type="text"
            inputMode="decimal"
            placeholder="例如 88.50"
            maxLength={16}
          />
          {amountError ? <small className="error">{amountError}</small> : null}
        </div>

        <div className="field">
          <label>日期时间</label>
          <input
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (dateError) {
                setDateError('');
              }
            }}
            type="datetime-local"
            min={MIN_DATE}
            max={MAX_DATE}
          />
          {dateError ? <small className="error">{dateError}</small> : null}
        </div>

        <div className="field">
          <label>交易订单号</label>
          <input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="如：202602100001"
          />
        </div>

        <div className="field">
          <label>商家订单号</label>
          <input
            value={merchantOrderNo}
            onChange={(e) => setMerchantOrderNo(e.target.value)}
            placeholder="如：MCH-20260210-01"
          />
        </div>

        <div className="field">
          <label>交易状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)}>
            <option value="pending">待处理</option>
            <option value="completed">已完成</option>
            <option value="refunded">已退款</option>
            <option value="closed">已关闭</option>
            <option value="failed">失败</option>
          </select>
        </div>

        <div className="field">
          <label>备注</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => void recognizeMerchant()} disabled={recognizing}>
              {recognizing ? 'AI 识别中...' : 'AI 识别商户与分类'}
            </button>
          </div>
          {suggestion ? (
            <small>
              建议：商户「{suggestion.merchant || '未识别'}」，分类「
              {suggestion.category || '未识别'}」。
              <button
                type="button"
                onClick={() => {
                  if (suggestion.merchant) {
                    setNote((prev) =>
                      prev.includes(suggestion.merchant)
                        ? prev
                        : `${suggestion.merchant} ${prev}`.trim()
                    );
                  }
                  if (suggestion.category) {
                    const matched = categories.find((item) =>
                      item.name.includes(suggestion.category)
                    );
                    if (matched) setCategoryId(matched.id);
                  }
                }}
              >
                应用建议
              </button>
            </small>
          ) : null}
        </div>

        <div className="field">
          <label>标签（逗号分隔）</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
          {suggestedTags.length > 0 ? (
            <small style={{ color: 'var(--color-text-secondary)' }}>
              自动建议：
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag-count-chip"
                  onClick={() => setTags((prev) => [...parseTags(prev), tag].join(','))}
                  style={{ marginLeft: 6 }}
                >
                  {tag}
                </button>
              ))}
            </small>
          ) : null}
        </div>

        {formError ? <p className="error">{formError}</p> : null}

        <button className="primary" type="submit">
          保存
        </button>
      </form>
    </section>
  );
}
