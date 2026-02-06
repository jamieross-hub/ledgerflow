import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { exportTransactionsCsv } from '../../shared/lib/csv';

const PAGE_SIZE = 8;

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);

  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      const byType = type === 'all' ? true : item.type === type;
      const byKeyword =
        keyword.trim().length === 0 ||
        item.note.toLowerCase().includes(keyword.toLowerCase()) ||
        item.tags.join(',').toLowerCase().includes(keyword.toLowerCase());
      return byType && byKeyword;
    });
  }, [keyword, type, transactions]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const list = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <section className="panel">
        <div className="row">
          <input
            placeholder="搜索备注或标签"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as 'all' | 'income' | 'expense');
              setPage(1);
            }}
          >
            <option value="all">全部</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
          <button onClick={() => exportTransactionsCsv(filtered)}>导出 CSV</button>
          <Link to="/transactions/new">
            <button className="primary">新增账目</button>
          </Link>
        </div>
      </section>

      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>分类</th>
              <th>账户</th>
              <th>金额</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.date)}</td>
                <td>{item.type === 'income' ? '收入' : '支出'}</td>
                <td>{categories.find((c) => c.id === item.categoryId)?.name ?? '-'}</td>
                <td>{accounts.find((a) => a.id === item.accountId)?.name ?? '-'}</td>
                <td>{formatCurrency(item.amount)}</td>
                <td>{item.note}</td>
                <td className="row">
                  <Link to={`/transactions/${item.id}`}>
                    <button>编辑</button>
                  </Link>
                  <button className="danger" onClick={() => removeTransaction(item.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 12 }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <small>
            第 {page} / {pages} 页
          </small>
          <button disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      </section>
    </div>
  );
}
