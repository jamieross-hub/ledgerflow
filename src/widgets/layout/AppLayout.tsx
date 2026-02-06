import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ThemeSwitcher } from '../../features/theme-switcher/ThemeSwitcher';

/** 当前发布版本号（展示用途，与 package.json 可独立管理） */
const APP_VERSION = '0.1';

const navItems = [
  { to: '/', label: '仪表盘', end: true },
  { to: '/transactions', label: '账目列表' },
  { to: '/categories-accounts', label: '分类/账户' },
  { to: '/assistant', label: '记账助手' }
];

const logoMenuItems = [
  { to: '/settings', label: '设置' },
  { to: '/about', label: '关于' },
  { to: '/database-settings', label: '数据库设置' }
];

const SIDEBAR_COLLAPSED_WIDTH = 76;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;

export function AppLayout() {
  // 抽屉状态：折叠/展开
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [menuOpen, setMenuOpen] = useState(false);
  // 拖拽过程用 ref 避免频繁触发重渲染
  const draggingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current || collapsed) {
        return;
      }

      const nextWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, event.clientX));
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [collapsed]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div
      className="layout-shell"
      style={{ ['--sidebar-width' as string]: `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px` }}
    >
      <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
        <div className="sidebar-header">
          <Link to="/" className="brand" title="LedgerFlow">
            {collapsed ? 'LF' : 'LedgerFlow'}
          </Link>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
              title={item.label}
            >
              {collapsed ? item.label.slice(0, 2) : item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeSwitcher />
        </div>

        {!collapsed ? <div className="sidebar-resize-handle" onMouseDown={() => (draggingRef.current = true)} /> : null}
      </aside>

      <div className="workspace">
        <header className="workspace-topbar">
          <div className="topbar-left" ref={menuRef}>
            <button
              type="button"
              className="logo-circle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="打开项目菜单"
            >
              LF
            </button>
            {menuOpen ? (
              <div className="logo-menu" role="menu">
                {logoMenuItems.map((item) => (
                  <Link key={item.to} to={item.to} className="logo-menu-item" onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}

            <div>
              <h1>LedgerFlow</h1>
              <span>v{APP_VERSION} · 现代化前端记账工作台</span>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
