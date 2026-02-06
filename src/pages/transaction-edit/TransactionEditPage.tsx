import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
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
  const [date, setDate] = useState((current?.date ?? new Date().toISOString()).slice(0, 10));
  const [note, setNote] = useState(current?.note ?? '');
  const [tags, setTags] = useState(current?.tags.join(',') ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      type,
      categoryId,
      accountId,
      amount: Number(amount),
      date: new Date(date).toISOString(),
      note,
      tags: parseTags(tags)
    };

    if (!payload.categoryId || !payload.accountId || !payload.amount) {
      return;
    }

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
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" />
        </div>

        <div className="field">
          <label>日期</label>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        </div>

        <div className="field">
          <label>备注</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="field">
          <label>标签（逗号分隔）</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <button className="primary" type="submit">
          保存
        </button>
      </form>
    </section>
  );
}
