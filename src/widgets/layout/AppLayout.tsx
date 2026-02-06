import { Link, NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '仪表盘', end: true },
  { to: '/transactions', label: '账目列表' },
  { to: '/categories-accounts', label: '分类/账户' },
  { to: '/settings', label: '设置' },
  { to: '/about', label: '关于/帮助' }
];

export function AppLayout() {
  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/" className="brand">
          LedgerFlow
        </Link>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
