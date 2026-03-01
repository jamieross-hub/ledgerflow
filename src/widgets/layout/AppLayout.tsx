import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '../../features/theme-switcher/ThemeSwitcher';
import { formatCurrency } from '../../shared/lib/format';
import { summarizeTransactions } from '../../shared/lib/transactionMetrics';
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
    title: '智能助手',
    items: [
      { to: '/assistant', label: '记账助手', icon: '🤖' },
      { to: '/smart-budget', label: '智能预算', icon: '🧠' }
    ]
  },
  {
    title: '收支管理',
    items: [
      { to: '/transactions', label: '交易流水', icon: '📋' },
      { to: '/', label: '数据概览', icon: '📊', end: true }
    ]
  },
  {
    title: '资产负债',
    items: [
      { to: '/categories-accounts', label: '账户与分类', icon: '🗂️' },
      { to: '/repayment-management', label: '还款管理', icon: '💳' }
    ]
  },
  {
    title: '工具资讯',
    items: [
      { to: '/settings', label: '设置', icon: '⚙️' },
      { to: '/database-settings', label: '备份设置', icon: '🗄️' },
      { to: '/exchange', label: '汇率工具', icon: '💱' },
      { to: '/finance', label: '市场资讯', icon: '📰' },
      { to: '/about', label: '关于', icon: 'ℹ️' }
    ]
  }
];

/**
 * 移动抽屉中的快捷入口分组。
 *
 * 目标是把高频功能放在首屏，降低小屏设备的操作路径。
 */
const mobileQuickGroups: Array<{ title: string; items: QuickEntry[] }> = [
  {
    title: '常用功能',
    items: [
      { label: '记账助手', icon: '🤖', to: '/assistant' },
      { label: '智能预算', icon: '🧠', to: '/smart-budget' },
      { label: '交易流水', icon: '📋', to: '/transactions' },
      { label: '数据概览', icon: '📊', to: '/', end: true },
      { label: '账户与分类', icon: '🗂️', to: '/categories-accounts' },
      { label: '还款管理', icon: '💳', to: '/repayment-management' },
      { label: '市场资讯', icon: '📰', to: '/finance' },
      { label: '汇率工具', icon: '💱', to: '/exchange' }
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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.title, true]))
  );

  const draggingRef = useRef(false);
  const transactions = useFinanceStore((s) => s.transactions);

  const thisMonth = new Date();
  const monthTransactions = transactions.filter((item) => {
    const date = new Date(item.date);
    return (
      date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear()
    );
  });
  const monthSummary = summarizeTransactions(monthTransactions);
  const monthIncome = monthSummary.incomeTotal;
  const monthExpense = monthSummary.expenseTotal;
  const monthBalance = monthSummary.netTotal;

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
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'N' || event.key === 'n') {
        event.preventDefault();
        navigate('/transactions/new?quick=1');
      }

      if (event.key === 'B' || event.key === 'b') {
        event.preventDefault();
        navigate('/smart-budget');
      }

      if (event.key === '/') {
        event.preventDefault();
        navigate('/transactions');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const onViewportChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', onViewportChange);
    };
  }, []);

  const shouldShowTopbar = collapsed || isMobileViewport;

  return (
    <div
      className={`layout-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`.trim()}
      style={{
        ['--sidebar-width' as string]: `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`
      }}
    >
      <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
        <div className="sidebar-header">
          {!collapsed ? (
            <Link to="/" className="brand" title="LedgerFlow">
              LedgerFlow
            </Link>
          ) : null}
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
            <p>① 添加账目 ② 设置预算 ③ 查看分析</p>
            <div className="sidebar-overview-actions">
              <Link to="/transactions/new?quick=1" className="sidebar-overview-action">
                记一笔
              </Link>
              <Link to="/smart-budget" className="sidebar-overview-action">
                去预算
              </Link>
              <Link to="/" className="sidebar-overview-action">
                看分析
              </Link>
            </div>
          </section>
        )}

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              {collapsed ? null : (
                <button
                  type="button"
                  className="sidebar-section-toggle"
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [section.title]: !prev[section.title]
                    }))
                  }
                >
                  <span className="sidebar-section-title">{section.title}</span>
                  <span>{expandedSections[section.title] ? '▾' : '▸'}</span>
                </button>
              )}
              {(collapsed || expandedSections[section.title]) &&
                section.items.map((item) => {
                  if (!item.to || item.disabled) {
                    return (
                      <div
                        key={`${section.title}-${item.label}`}
                        className="sidebar-link disabled"
                        title={item.label}
                      >
                        <span className="sidebar-link-icon">{item.icon}</span>
                        {collapsed ? null : (
                          <span className="sidebar-link-label">{item.label}</span>
                        )}
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
        {shouldShowTopbar ? (
          <header className="workspace-topbar">
            <div className="topbar-left">
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
                  <button type="button" className="logo-circle" aria-label="用户头像">
                    👤
                  </button>

                  <div className="topbar-brand-copy compact">
                    <h1>LedgerFlow</h1>
                    <span>智能记账工作台</span>
                  </div>
                </>
              ) : null}
            </div>
          </header>
        ) : null}

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
