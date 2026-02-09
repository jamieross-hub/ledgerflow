import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ThemeSwitcher } from '../../features/theme-switcher/ThemeSwitcher';
import { useAiSettings } from '../../shared/store/useAiSettings';

/** 当前发布版本号（展示用途，与 package.json 可独立管理） */
const APP_VERSION = '0.1';

type NavItem = {
  label: string;
  icon: string;
  to?: string;
  end?: boolean;
  disabled?: boolean;
};

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'AI 助手',
    items: [{ to: '/assistant', label: '记账助手', icon: '🤖' }]
  },
  {
    title: '交易数据',
    items: [
      { to: '/transactions', label: '交易详情', icon: '📋' },
      { to: '/', label: '统计分析', icon: '📊', end: true }
    ]
  },
  {
    title: '基础数据',
    items: [{ to: '/categories-accounts', label: '账户/分类/标签', icon: '🗂️' }]
  },
  {
    title: '杂项',
    items: [
      { to: '/exchange', label: '汇率数据', icon: '💱' },
      { to: '/about', label: '关于', icon: 'ℹ️' }
    ]
  }
];

const logoMenuItems = [
  { to: '/settings', label: '设置', icon: '⚙️' },
  { to: '/about', label: '关于', icon: 'ℹ️' },
  { to: '/database-settings', label: '数据库设置', icon: '🗄️' }
];

const SIDEBAR_COLLAPSED_WIDTH = 76;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [menuOpen, setMenuOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const draggingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const envRef = useRef<HTMLDivElement | null>(null);

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const model = useAiSettings((s) => s.model);
  const apiKey = useAiSettings((s) => s.apiKey);

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
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (envRef.current && !envRef.current.contains(target)) {
        setEnvOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  const copyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(baseUrl || '');
      setEnvOpen(false);
    } catch {
      setEnvOpen(false);
    }
  };

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
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              {collapsed ? null : <p className="sidebar-section-title">{section.title}</p>}
              {section.items.map((item) => {
                if (!item.to || item.disabled) {
                  return (
                    <div key={`${section.title}-${item.label}`} className="sidebar-link disabled" title={item.label}>
                      <span className="sidebar-link-icon">{item.icon}</span>
                      {collapsed ? null : <span className="sidebar-link-label">{item.label}</span>}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={`${section.title}-${item.label}`}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
                    title={item.label}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    {collapsed ? null : <span className="sidebar-link-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
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
              className="icon-btn mobile-nav-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="打开功能抽屉"
            >
              ☰
            </button>
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
                    <span className="logo-menu-icon">{item.icon}</span> {item.label}
                  </Link>
                ))}
              </div>
            ) : null}

            <div>
              <h1>LedgerFlow</h1>
              <span>v{APP_VERSION} · 现代化前端记账工作台</span>
            </div>
          </div>

          <div className="topbar-right" ref={envRef}>
            <button
              type="button"
              className="env-chip"
              aria-haspopup="dialog"
              aria-expanded={envOpen}
              onClick={() => setEnvOpen((v) => !v)}
            >
              {apiKey ? 'AI 已配置' : 'AI 未配置'}
            </button>
            {envOpen ? (
              <div className="env-popover" role="dialog" aria-label="环境信息">
                <h4>环境信息</h4>
                <p>
                  <strong>模型：</strong>
                  {model || '未设置'}
                </p>
                <p>
                  <strong>Base URL：</strong>
                  <span className="mono-inline">{baseUrl || '未设置'}</span>
                </p>
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => void copyBaseUrl()}>
                    复制 Base URL
                  </button>
                  <Link to="/settings" onClick={() => setEnvOpen(false)}>
                    <button type="button">前往设置</button>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {mobileNavOpen ? (
        <div className="mobile-nav-overlay" role="presentation" onClick={() => setMobileNavOpen(false)}>
          <aside className="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="功能抽屉" onClick={(e) => e.stopPropagation()}>
            <header className="mobile-nav-header">
              <strong>功能抽屉</strong>
              <button type="button" className="icon-btn" onClick={() => setMobileNavOpen(false)} aria-label="关闭功能抽屉">
                ✕
              </button>
            </header>
            <nav className="mobile-nav-list">
              {navSections.map((section) => (
                <div key={section.title} className="mobile-nav-section">
                  <p className="sidebar-section-title">{section.title}</p>
                  {section.items
                    .filter((item) => item.to && !item.disabled)
                    .map((item) => (
                      <NavLink
                        key={`${section.title}-${item.label}`}
                        to={item.to!}
                        end={item.end}
                        className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <span className="sidebar-link-icon">{item.icon}</span>
                        <span className="sidebar-link-label">{item.label}</span>
                      </NavLink>
                    ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
