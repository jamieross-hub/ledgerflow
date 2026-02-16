import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ThemeSwitcher } from '../../features/theme-switcher/ThemeSwitcher';
import { formatCurrency } from '../../shared/lib/format';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

type NavItem = {
  label: string;
  icon: string;
  to?: string;
  end?: boolean;
  disabled?: boolean;
};

type QuickEntry = {
  label: string;
  icon: string;
  to: string;
  end?: boolean;
};

const navSections: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'AI 助手',
    items: [
      { to: '/assistant', label: '记账助手', icon: '🤖' },
      { to: '/smart-budget', label: '智能预算', icon: '🧠' }
    ]
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
    items: [
      { to: '/categories-accounts', label: '账户/分类/标签', icon: '🗂️' },
      { to: '/repayment-management', label: '还款管理', icon: '💳' }
    ]
  },
  {
    title: '杂项',
    items: [
      { to: '/settings', label: '设置', icon: '⚙️' },
      { to: '/exchange', label: '汇率数据', icon: '💱' },
      { to: '/finance', label: '金融资讯', icon: '📰' },
      { to: '/about', label: '关于', icon: 'ℹ️' }
    ]
  }
];

const logoMenuItems = [
  { to: '/settings', label: '设置', icon: '⚙️' },
  { to: '/about', label: '关于', icon: 'ℹ️' },
  { to: '/database-settings', label: '备份设置', icon: '🗄️' }
];

/**
 * 移动抽屉中的快捷入口分组。
 *
 * 目标是把高频功能放在首屏，降低小屏设备的操作路径。
 */
const mobileQuickGroups: Array<{ title: string; items: QuickEntry[] }> = [
  {
    title: '高频入口',
    items: [
      { label: '记账助手', icon: '🤖', to: '/assistant' },
      { label: '智能预算', icon: '🧠', to: '/smart-budget' },
      { label: '交易详情', icon: '📋', to: '/transactions' },
      { label: '统计分析', icon: '📊', to: '/', end: true },
      { label: '分类账户', icon: '🗂️', to: '/categories-accounts' },
      { label: '还款管理', icon: '💳', to: '/repayment-management' },
      { label: '金融资讯', icon: '📰', to: '/finance' },
      { label: '汇率数据', icon: '💱', to: '/exchange' }
    ]
  },
  {
    title: '系统功能',
    items: [
      { label: '设置', icon: '⚙️', to: '/settings' },
      { label: '备份设置', icon: '🗄️', to: '/database-settings' },
      { label: '关于', icon: 'ℹ️', to: '/about' }
    ]
  }
];

const SIDEBAR_COLLAPSED_WIDTH = 76;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const monthLabel = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long'
}).format(new Date());

const todayLabel = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const draggingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const transactions = useFinanceStore((s) => s.transactions);

  const thisMonth = new Date();
  const monthTransactions = transactions.filter((item) => {
    const date = new Date(item.date);
    return (
      date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear()
    );
  });
  const monthIncome = monthTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const monthExpense = monthTransactions
    .filter((item) => item.type !== 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const monthBalance = monthIncome - monthExpense;

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
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!collapsed && menuOpen) {
      setMenuOpen(false);
    }
  }, [collapsed, menuOpen]);

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

  return (
    <div
      className={`layout-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`.trim()}
      style={{
        ['--sidebar-width' as string]: `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`
      }}
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

        {collapsed ? null : (
          <section className="sidebar-overview-card">
            <h3>{monthLabel}</h3>
            <p>先记账，再看趋势，账本更清晰。</p>
          </section>
        )}

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              {collapsed ? null : <p className="sidebar-section-title">{section.title}</p>}
              {section.items.map((item) => {
                if (!item.to || item.disabled) {
                  return (
                    <div
                      key={`${section.title}-${item.label}`}
                      className="sidebar-link disabled"
                      title={item.label}
                    >
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
                    className={({ isActive }) =>
                      isActive ? 'sidebar-link active' : 'sidebar-link'
                    }
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

        {!collapsed ? (
          <div className="sidebar-resize-handle" onMouseDown={() => (draggingRef.current = true)} />
        ) : null}
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
            {collapsed ? (
              <>
                <button
                  type="button"
                  className="logo-circle"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="打开项目菜单"
                >
                  👤
                </button>
                {menuOpen ? (
                  <div className="logo-menu" role="menu">
                    {logoMenuItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="logo-menu-item"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="logo-menu-icon">{item.icon}</span> {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="topbar-brand-copy compact">
                  <h1>LedgerFlow</h1>
                  <span>智能记账工作台</span>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {mobileNavOpen ? (
        <div
          className="mobile-nav-overlay"
          role="presentation"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside
            className="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="功能抽屉"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mobile-nav-header mobile-nav-profile">
              <div>
                <p className="mobile-nav-name">LedgerFlow 用户</p>
                <p className="mobile-nav-subtitle">{todayLabel} · 今天也要轻松记一笔</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMobileNavOpen(false)}
                aria-label="关闭功能抽屉"
              >
                ✕
              </button>
            </header>

            <section className="mobile-nav-summary-card">
              <h3>{monthLabel}</h3>
              <p>结余 {formatCurrency(monthBalance)}</p>
              <p>
                收入 {formatCurrency(monthIncome)} · 支出 {formatCurrency(monthExpense)}
              </p>
            </section>

            <div className="mobile-nav-tip-banner">
              💡 小提示：先用 AI 助手录入，再去统计页看趋势。
            </div>

            {mobileQuickGroups.map((group) => (
              <section key={group.title} className="mobile-nav-grid-card">
                <h3>{group.title}</h3>
                <div className="mobile-nav-grid">
                  {group.items.map((item) => (
                    <NavLink
                      key={`${group.title}-${item.label}`}
                      to={item.to}
                      end={item.end}
                      className="mobile-nav-grid-item"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <span>{item.icon}</span>
                      <strong>{item.label}</strong>
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}

            <div className="mobile-nav-footer">
              <span>主题模式</span>
              <ThemeSwitcher />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
