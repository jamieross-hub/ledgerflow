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
    <div className="grid grid-3">
      <section className="panel">
        <h3>分类管理</h3>
        <form onSubmit={submitCategory} className="row">
          <input
            placeholder="新增分类名称"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <button className="primary" type="submit">
            添加
          </button>
        </form>
        <ul>
          {categories.map((item) => (
            <li key={item.id} className="row" style={{ marginTop: 8 }}>
              <span>{item.name}</span>
              <button className="danger" onClick={() => removeCategory(item.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>账户管理</h3>
        <form onSubmit={submitAccount} className="row">
          <input
            placeholder="新增账户名称"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <button className="primary" type="submit">
            添加
          </button>
        </form>
        <ul>
          {accounts.map((item) => (
            <li key={item.id} className="row" style={{ marginTop: 8 }}>
              <span>{item.name}</span>
              <button className="danger" onClick={() => removeAccount(item.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
