import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

const MAX_AMOUNT = 999999999.99;

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

  const current = useMemo(() => transactions.find((item) => item.id === id), [transactions, id]);
  const [type, setType] = useState<'income' | 'expense'>(current?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? categories[0]?.id ?? '');
  const [accountId, setAccountId] = useState(current?.accountId ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState(String(current?.amount ?? ''));
  const [date, setDate] = useState(() => {
    const raw = current?.date ?? new Date().toISOString();
    return formatLocalDateTime(raw);
  });
  const [note, setNote] = useState(current?.note ?? '');
  const [tags, setTags] = useState(current?.tags.join(',') ?? '');
  const [amountError, setAmountError] = useState('');
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAmountError('');
    setDateError('');
    setFormError('');

    if (!categoryId || !accountId) {
      setFormError('请先选择分类和账户。');
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

    const payload = {
      type,
      categoryId,
      accountId,
      amount: amountResult.value,
      date: dateResult.value,
      note,
      tags: parseTags(tags)
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
      <h2>{id ? '编辑账目' : '新增账目'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>类型</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>

        <div className="field">
          <label>分类</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
          />
          {dateError ? <small className="error">{dateError}</small> : null}
        </div>

        <div className="field">
          <label>备注</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="field">
          <label>标签（逗号分隔）</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        {formError ? <p className="error">{formError}</p> : null}

        <button className="primary" type="submit">
          保存
        </button>
      </form>
    </section>
  );
}
