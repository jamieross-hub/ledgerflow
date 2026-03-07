import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const SIDEBAR_COLLAPSED_WIDTH = 76;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  const navSections: Array<{ title: string; items: NavItem[] }> = useMemo(
    () => [
      {
        title: t('nav.assistant'),
        items: [
          { to: '/assistant', label: t('nav.assistantBookkeeping'), icon: '🤖' },
          { to: '/smart-budget', label: t('nav.smartBudget'), icon: '🧠' },
          { to: '/global-memory', label: '全局记忆', icon: '🗃️' }
        ]
      },
      {
        title: t('nav.incomeExpense'),
        items: [
          { to: '/transactions', label: t('nav.transactions'), icon: '📋' },
          { to: '/', label: t('nav.dashboard'), icon: '📊', end: true }
        ]
      },
      {
        title: t('nav.assetsDebt'),
        items: [
          { to: '/categories-accounts', label: t('nav.categoriesAccounts'), icon: '🗂️' },
          { to: '/repayment-management', label: t('nav.repayment'), icon: '💳' }
        ]
      },
      {
        title: t('nav.toolsInfo'),
        items: [
          { to: '/help', label: '帮助', icon: '❓' },
          { to: '/settings', label: t('nav.settings'), icon: '⚙️' },
          { to: '/database-settings', label: t('nav.dbSettings'), icon: '🗄️' },
          { to: '/exchange', label: t('nav.exchange'), icon: '💱' },
          { to: '/finance', label: t('nav.finance'), icon: '📰' },
          { to: '/about', label: t('nav.about'), icon: 'ℹ️' }
        ]
      }
    ],
    [t]
  );

  const mobileQuickGroups: Array<{ title: string; items: QuickEntry[] }> = useMemo(
    () => [
      {
        title: t('nav.commonFeatures'),
        items: [
          { label: t('nav.assistantBookkeeping'), icon: '🤖', to: '/assistant' },
          { label: t('nav.smartBudget'), icon: '🧠', to: '/smart-budget' },
          { label: '全局记忆', icon: '🗃️', to: '/global-memory' },
          { label: t('nav.transactions'), icon: '📋', to: '/transactions' },
          { label: t('nav.dashboard'), icon: '📊', to: '/', end: true },
          { label: t('nav.categoriesAccounts'), icon: '🗂️', to: '/categories-accounts' },
          { label: t('nav.repayment'), icon: '💳', to: '/repayment-management' },
          { label: t('nav.finance'), icon: '📰', to: '/finance' },
          { label: t('nav.exchange'), icon: '💱', to: '/exchange' }
        ]
      },
      {
        title: t('nav.systemFeatures'),
        items: [
          { label: '帮助', icon: '❓', to: '/help' },
          { label: t('nav.settings'), icon: '⚙️', to: '/settings' },
          { label: t('nav.dbSettings'), icon: '🗄️', to: '/database-settings' },
          { label: t('nav.about'), icon: 'ℹ️', to: '/about' }
        ]
      }
    ],
    [t]
  );

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.title, true]))
  );

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = Object.fromEntries(navSections.map((section) => [section.title, true]));
      for (const section of navSections) {
        if (prev[section.title] !== undefined) {
          next[section.title] = prev[section.title];
        }
      }
      return next;
    });
  }, [navSections]);

  const draggingRef = useRef(false);
  const transactions = useFinanceStore((s) => s.transactions);

  const monthLabel = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long'
  }).format(new Date());

  const todayLabel = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

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

  const todayTransactions = transactions.filter((item) => {
    const date = new Date(item.date);
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
  const todaySummary = summarizeTransactions(todayTransactions);

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
        navigate('/transactions?quickAdd=1&entry=layout');
      }

      if (event.key === 'B' || event.key === 'b') {
        event.preventDefault();
        navigate('/smart-budget');
      }

      if (event.key === 'A' || event.key === 'a') {
        event.preventDefault();
        navigate('/assistant');
      }

      if (event.key === 'G' || event.key === 'g') {
        event.preventDefault();
        navigate('/');
      }

      if (event.key === 'H' || event.key === 'h') {
        event.preventDefault();
        navigate('/help');
      }

      if (event.key === 'D' || event.key === 'd') {
        event.preventDefault();
        navigate('/database-settings');
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
            <Link to="/" className="brand" title={t('layout.brand')}>
              {t('layout.brand')}
            </Link>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={
              collapsed ? t('layout.toggleSidebarExpand') : t('layout.toggleSidebarCollapse')
            }
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {collapsed ? null : (
          <section className="sidebar-assistant-today-card" aria-label={t('layout.assistantTodayAria')}>
            <h4>{t('layout.assistantTodayTitle')}</h4>
            <p>
              <span>{t('layout.todayIncome')}</span>
              <strong>{formatCurrency(todaySummary.incomeTotal)}</strong>
            </p>
            <p>
              <span>{t('layout.todayExpense')}</span>
              <strong>{formatCurrency(todaySummary.expenseTotal)}</strong>
            </p>
            <p>
              <span>{t('layout.todayNet')}</span>
              <strong className={todaySummary.netTotal >= 0 ? 'text-income' : 'text-expense'}>
                {formatCurrency(todaySummary.netTotal)}
              </strong>
            </p>
          </section>
        )}

        {collapsed ? null : (
          <section className="sidebar-overview-card">
            <h3>{monthLabel}</h3>
            <p>{t('layout.overviewHint')}</p>
            <div className="sidebar-overview-actions">
              <Link to="/assistant" className="sidebar-overview-action">
                {t('layout.actionAi')}
              </Link>
              <Link to="/transactions?quickAdd=1&entry=layout" className="sidebar-overview-action">
                {t('layout.actionQuickAdd')}
              </Link>
              <Link to="/transactions" className="sidebar-overview-action">
                {t('layout.actionTaskList')}
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
                aria-label={t('layout.openDrawer')}
              >
                ☰
              </button>
              {collapsed ? (
                <>
                  <button type="button" className="logo-circle" aria-label={t('layout.userAvatar')}>
                    👤
                  </button>

                  <div className="topbar-brand-copy compact">
                    <h1>{t('layout.brand')}</h1>
                    <span>{t('layout.workspaceTitle')}</span>
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
            aria-label={t('layout.drawerAria')}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mobile-nav-header mobile-nav-profile">
              <div>
                <p className="mobile-nav-name">{t('layout.drawerUser')}</p>
                <p className="mobile-nav-subtitle">{t('layout.drawerSubtitle', { today: todayLabel })}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMobileNavOpen(false)}
                aria-label={t('layout.closeDrawer')}
              >
                ✕
              </button>
            </header>

            <section className="mobile-nav-summary-card">
              <h3>{monthLabel}</h3>
              <p>{t('layout.monthlyBalance', { amount: formatCurrency(monthBalance) })}</p>
              <p>
                {t('layout.monthlyIncomeExpense', {
                  income: formatCurrency(monthIncome),
                  expense: formatCurrency(monthExpense)
                })}
              </p>
            </section>

            <div className="mobile-nav-tip-banner">{t('layout.tip')}</div>

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
              <span>{t('layout.themeMode')}</span>
              <ThemeSwitcher />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
