import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  const location = useLocation();

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const suggestCategoryByLearning = useFinanceStore((s) => s.suggestCategoryByLearning);
  const recordCategoryCorrection = useFinanceStore((s) => s.recordCategoryCorrection);
  const categoryLearningEvents = useFinanceStore((s) => s.categoryLearningEvents);
  const undoLatestCategoryLearning = useFinanceStore((s) => s.undoLatestCategoryLearning);
  const aiBaseUrl = useAiSettings((s) => s.baseUrl);
  const aiApiKey = useAiSettings((s) => s.apiKey);
  const aiModel = useAiSettings((s) => s.model);

  const current = useMemo(() => transactions.find((item) => item.id === id), [transactions, id]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const presetTypeRaw = searchParams.get('type');
  const presetType =
    presetTypeRaw === 'income' ||
    presetTypeRaw === 'expense' ||
    presetTypeRaw === 'budget' ||
    presetTypeRaw === 'repayment'
      ? presetTypeRaw
      : null;
  const quickMode = !id && searchParams.get('quick') === '1';

  const [type, setType] = useState<'income' | 'expense' | 'budget' | 'repayment'>(
    current?.type ?? presetType ?? 'expense'
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
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [learningFeedback, setLearningFeedback] = useState('');

  const suggestedTags = useMemo(
    () =>
      suggestTags(note, merchantOrderNo, orderNo).filter((tag) => !parseTags(tags).includes(tag)),
    [note, merchantOrderNo, orderNo, tags]
  );

  const learningSuggestion = useMemo(
    () =>
      suggestCategoryByLearning({
        type,
        note,
        merchantOrderNo: merchantOrderNo.trim(),
        orderNo: orderNo.trim()
      }),
    [merchantOrderNo, note, orderNo, suggestCategoryByLearning, type]
  );

  const categoryNameMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name] as const)),
    [categories]
  );

  const recentLearningEvents = useMemo(
    () => categoryLearningEvents.slice(-5).reverse(),
    [categoryLearningEvents]
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

  useEffect(() => {
    if (!quickMode || id) {
      return;
    }

    const timer = window.requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(timer);
  }, [id, quickMode]);

  useEffect(() => {
    if (id || categoryTouched || !learningSuggestion) {
      return;
    }
    if (learningSuggestion.categoryId === categoryId) {
      return;
    }
    setCategoryId(learningSuggestion.categoryId);
    setLearningFeedback(
      `已按学习记录自动推荐分类：${categoryNameMap.get(learningSuggestion.categoryId) || '未命名分类'}（置信度 ${Math.round(learningSuggestion.confidence * 100)}%）`
    );
  }, [categoryId, categoryNameMap, categoryTouched, id, learningSuggestion]);

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

    const learningInput = {
      type,
      note,
      merchantOrderNo: merchantOrderNo.trim(),
      orderNo: orderNo.trim()
    };
    const recommendation = suggestCategoryByLearning(learningInput);
    if (recommendation && recommendation.categoryId !== categoryId) {
      recordCategoryCorrection({
        ...learningInput,
        fromCategoryId: recommendation.categoryId,
        toCategoryId: categoryId
      });
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
      <h2>{id ? '编辑账目' : quickMode ? '秒速记账' : '新增账目'}</h2>
      {quickMode && !id ? (
        <small style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 10 }}>
          快速模式：仅需填写金额与必要字段，保存后自动返回交易页。
        </small>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="tx-type">类型</label>
          <select
            id="tx-type"
            aria-label="交易类型"
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
          <label htmlFor="tx-category">分类</label>
          <select
            id="tx-category"
            aria-label="交易分类"
            value={categoryId}
            onChange={(e) => {
              setCategoryTouched(true);
              setCategoryId(e.target.value);
            }}
            required
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {(item.icon || '📁') + ' ' + item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tx-account">账户</label>
          <select
            id="tx-account"
            aria-label="交易账户"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tx-amount">金额</label>
          <input
            id="tx-amount"
            aria-label="交易金额"
            ref={amountInputRef}
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
          <label htmlFor="tx-date">日期时间</label>
          <input
            id="tx-date"
            aria-label="交易日期时间"
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
          <label htmlFor="tx-order-no">交易订单号</label>
          <input
            id="tx-order-no"
            aria-label="交易订单号"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="如：202602100001"
          />
        </div>

        <div className="field">
          <label htmlFor="tx-merchant-order-no">商家订单号</label>
          <input
            id="tx-merchant-order-no"
            aria-label="商家订单号"
            value={merchantOrderNo}
            onChange={(e) => setMerchantOrderNo(e.target.value)}
            placeholder="如：MCH-20260210-01"
          />
        </div>

        <div className="field">
          <label htmlFor="tx-status">交易状态</label>
          <select
            id="tx-status"
            aria-label="交易状态"
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus)}
          >
            <option value="pending">待处理</option>
            <option value="completed">已完成</option>
            <option value="refunded">已退款</option>
            <option value="closed">已关闭</option>
            <option value="failed">失败</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="tx-note">备注</label>
          <textarea
            id="tx-note"
            aria-label="交易备注"
            placeholder="例如：工作日午餐"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
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
          <label htmlFor="tx-tags">标签（逗号分隔）</label>
          <input
            id="tx-tags"
            aria-label="交易标签"
            placeholder="如：餐饮,工作日"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
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
        {learningFeedback ? (
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>{learningFeedback}</p>
        ) : null}

        <button className="primary" type="submit">
          保存
        </button>
      </form>

      <section
        style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}
        aria-label="分类学习记录"
      >
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>最近分类学习</strong>
          <button
            type="button"
            onClick={() => {
              const ok = undoLatestCategoryLearning();
              setLearningFeedback(ok ? '已撤销最近一次分类学习。' : '暂无可撤销的学习记录。');
            }}
          >
            撤销最近一次
          </button>
        </div>
        {recentLearningEvents.length === 0 ? (
          <small style={{ color: 'var(--color-text-secondary)' }}>暂无学习记录。</small>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {recentLearningEvents.map((item) => (
              <li key={item.id} style={{ marginBottom: 6 }}>
                {categoryNameMap.get(item.fromCategoryId) || '未知分类'} →{' '}
                {categoryNameMap.get(item.toCategoryId) || '未知分类'}
                <small style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                  关键词：{item.tokens.slice(0, 3).join(' / ') || '无'}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
