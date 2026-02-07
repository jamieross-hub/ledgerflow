import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { exportTransactionsCsv } from '../../shared/lib/csv';
import { parseBillCsvToTransactions } from '../../shared/lib/billImport';

const PAGE_SIZE = 8;
type BillSource = 'wechat' | 'alipay';

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);

  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [page, setPage] = useState(1);
  const [importSource, setImportSource] = useState<BillSource | null>(null);
  const [importMessage, setImportMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const triggerImport = (source: BillSource) => {
    setImportSource(source);
    setImportMessage('');
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importSource) {
      return;
    }

    try {
      const csvText = await file.text();
      const defaultCategoryId = categories[0]?.id;
      const defaultAccountId = accounts[0]?.id;

      if (!defaultCategoryId || !defaultAccountId) {
        setImportMessage('⚠️ 导入失败：请先在"分类/账户"页面至少创建 1 个分类和 1 个账户。');
        return;
      }

      const parsed = parseBillCsvToTransactions({
        csvText,
        source: importSource,
        defaultCategoryId,
        defaultAccountId
      });

      if (parsed.length === 0) {
        setImportMessage('⚠️ 未识别到可导入账单，请确认 CSV 为微信/支付宝账单导出文件。');
        return;
      }

      parsed.forEach((item) => addTransaction(item));
      setImportMessage(
        `✅ 导入成功：${importSource === 'wechat' ? '微信' : '支付宝'}账单 ${parsed.length} 条。`
      );
      setPage(1);
    } catch {
      setImportMessage('❌ 导入失败：文件解析异常，请检查 CSV 编码与格式。');
    } finally {
      event.target.value = '';
      setImportSource(null);
    }
  };

  return (
    <div>
      {/* 筛选与操作栏 */}
      <section className="panel">
        <h2>交易记录</h2>
        <div className="row">
          <input
            placeholder="搜索备注或标签"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{ flex: 1, maxWidth: 240 }}
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
          <button type="button" onClick={() => triggerImport('wechat')}>导入微信账单</button>
          <button type="button" onClick={() => triggerImport('alipay')}>导入支付宝账单</button>
          <Link to="/transactions/new">
            <button className="primary">新增账目</button>
          </Link>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        {importMessage ? (
          <p style={{ marginTop: 12, fontSize: 'var(--font-sm)' }}>{importMessage}</p>
        ) : null}
      </section>

      {/* 数据表格 */}
      <section className="panel">
        {list.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state-icon">📋</div>
            <h3>暂无交易记录</h3>
            <p>添加第一笔交易，或使用筛选条件查看已有记录。</p>
          </div>
        ) : (
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
                  <td>
                    <span className={item.type === 'income' ? 'badge badge-success' : 'badge badge-danger'}>
                      {item.type === 'income' ? '收入' : '支出'}
                    </span>
                  </td>
                  <td>{categories.find((c) => c.id === item.categoryId)?.name ?? '-'}</td>
                  <td>{accounts.find((a) => a.id === item.accountId)?.name ?? '-'}</td>
                  <td style={{ fontWeight: 600, color: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)' }}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td>{item.note}</td>
                  <td className="row">
                    <Link to={`/transactions/${item.id}`}>
                      <button>编辑</button>
                    </Link>
                    <button className="danger" onClick={() => removeTransaction(item.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <small style={{ color: 'var(--color-text-secondary)' }}>
            第 {page} / {pages} 页 · 共 {filtered.length} 条
          </small>
          <button disabled={page === pages} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </section>
    </div>
  );
}
