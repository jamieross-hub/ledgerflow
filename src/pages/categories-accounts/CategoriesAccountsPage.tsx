import { FormEvent, useState } from 'react';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

export function CategoriesAccountsPage() {
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const removeAccount = useFinanceStore((s) => s.removeAccount);

  const [categoryName, setCategoryName] = useState('');
  const [accountName, setAccountName] = useState('');

  function submitCategory(e: FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;
    addCategory(categoryName);
    setCategoryName('');
  }

  function submitAccount(e: FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) return;
    addAccount(accountName);
    setAccountName('');
  }

  return (
    <div className="grid grid-2">
      <section className="panel">
        <h2>分类管理</h2>
        <form onSubmit={submitCategory} className="row" style={{ marginBottom: 16 }}>
          <input
            placeholder="新增分类名称"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit">添加</button>
        </form>
        {categories.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 16 }}>暂无分类，请添加第一个分类。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {categories.map((item) => (
              <li key={item.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ flex: 1 }}>{item.name}</span>
                <button className="danger" onClick={() => removeCategory(item.id)}>删除</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>账户管理</h2>
        <form onSubmit={submitAccount} className="row" style={{ marginBottom: 16 }}>
          <input
            placeholder="新增账户名称"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit">添加</button>
        </form>
        {accounts.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 16 }}>暂无账户，请添加第一个账户。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {accounts.map((item) => (
              <li key={item.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ flex: 1 }}>{item.name}</span>
                <button className="danger" onClick={() => removeAccount(item.id)}>删除</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
