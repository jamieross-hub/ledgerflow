import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import {
  calculateOvertimePay,
  calculateSalaryMetrics,
  getOvertimeInputError,
  getSalaryInputError,
  sanitizePositiveNumberInput
} from './salaryCalculator';

type FinanceNewsItem = {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  summary?: string;
};

const FINANCE_NEWS_CACHE_KEY = 'ledgerflow.finance.news-cache.v1';

function formatTimeLabel(value: string | undefined, t: (k:string)=>string, language: string): string {
  if (!value) return t('finance.ui.justNow');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function cleanHtml(raw?: string | null): string {
  return String(raw || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xmlText: string, fallbackSource: string, t: (k:string)=>string, language: string): FinanceNewsItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(t('finance.ui.rssParseFailed'));
  }

  const sourceTitle =
    cleanHtml(doc.querySelector('channel > title')?.textContent) ||
    cleanHtml(doc.querySelector('feed > title')?.textContent) ||
    fallbackSource;

  const itemNodes = Array.from(doc.querySelectorAll('item, entry'));
  return itemNodes
    .map((node, index) => {
      const title =
        cleanHtml(node.querySelector('title')?.textContent) ||
        cleanHtml(node.querySelector('media\\:title')?.textContent) ||
        t('finance.ui.unnamedNews');
      const directLink = node.querySelector('link')?.textContent?.trim();
      const atomLink =
        (node.querySelector('link[rel="alternate"]') as Element | null)?.getAttribute('href') ||
        node.querySelector('link')?.getAttribute('href');
      const link = directLink || atomLink || 'https://news.google.com/';
      const publishedRaw =
        node.querySelector('pubDate')?.textContent ||
        node.querySelector('published')?.textContent ||
        node.querySelector('updated')?.textContent ||
        '';
      const summaryRaw =
        node.querySelector('description')?.textContent ||
        node.querySelector('summary')?.textContent ||
        node.querySelector('content')?.textContent ||
        '';
      return {
        id: `${fallbackSource}-${index}-${title}`,
        title,
        source: sourceTitle,
        link,
        publishedAt: formatTimeLabel(publishedRaw, t, language),
        summary: cleanHtml(summaryRaw)
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 8);
}

async function fetchRssFeed(feedUrl: string, signal: AbortSignal, t: (k:string)=>string, language: string): Promise<FinanceNewsItem[]> {
  const encodedUrl = encodeURIComponent(feedUrl);
  const response = await fetch(`https://api.allorigins.win/raw?url=${encodedUrl}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xmlText = await response.text();
  return parseRssItems(xmlText, feedUrl, t, language);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const { rssSubscriptions, addRssSubscription, removeRssSubscription, toggleRssSubscription } =
    useAppPreferences();
  const [news, setNews] = useState<FinanceNewsItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const cachedRaw = window.localStorage.getItem(FINANCE_NEWS_CACHE_KEY);
    if (!cachedRaw) return [];

    try {
      const parsed = JSON.parse(cachedRaw) as FinanceNewsItem[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedTitle, setFeedTitle] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [activeNewsId, setActiveNewsId] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('12000');
  const [workingDays, setWorkingDays] = useState('21.75');
  const [dailyHours, setDailyHours] = useState('8');
  const [overtimeHours, setOvertimeHours] = useState('2');

  const enabledFeeds = useMemo(
    () => rssSubscriptions.filter((item) => item.enabled),
    [rssSubscriptions]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFinanceNews() {
      setLoading(true);
      setError('');

      if (enabledFeeds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const loadedLists = await Promise.allSettled(
          enabledFeeds.map((item) => fetchRssFeed(item.url, controller.signal, t, i18n.language))
        );
        const merged = loadedLists
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .slice(0, 20);

        const sorted = [...merged].sort((a, b) => {
          const aTime = Date.parse(a.publishedAt);
          const bTime = Date.parse(b.publishedAt);
          if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
          return bTime - aTime;
        });

        if (sorted.length > 0) {
          setNews(sorted);
          window.localStorage.setItem(FINANCE_NEWS_CACHE_KEY, JSON.stringify(sorted));
          setActiveNewsId((current) => current || sorted[0].id);
        } else {
          setError(t('finance.ui.noReadableContent'));
        }

        if (loadedLists.every((result) => result.status === 'rejected')) {
          setError(t('finance.ui.rssUnavailable'));
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(t('finance.ui.rssUnavailable'));
        }
      } finally {
        setLoading(false);
      }
    }

    loadFinanceNews();
    return () => controller.abort();
  }, [enabledFeeds, i18n.language, t]);

  const dailyIdea = useMemo(() => {
    const day = new Date().getDate();
    const ideas = [
      t('finance.ideas.1'),
      t('finance.ideas.2'),
      t('finance.ideas.3'),
      t('finance.ideas.4'),
      t('finance.ideas.5')
    ];
    return ideas[day % ideas.length];
  }, [t]);

  const activeNews = useMemo(
    () => news.find((item) => item.id === activeNewsId) || news[0] || null,
    [activeNewsId, news]
  );

  const salaryMetrics = useMemo(
    () => calculateSalaryMetrics({ monthlySalary, workingDays, dailyHours }),
    [dailyHours, monthlySalary, workingDays]
  );

  const salaryInputError = useMemo(
    () => getSalaryInputError({ monthlySalary, workingDays, dailyHours }),
    [dailyHours, monthlySalary, workingDays]
  );

  const overtimeResult = useMemo(
    () => calculateOvertimePay(salaryMetrics?.hourlySalary || 0, overtimeHours),
    [overtimeHours, salaryMetrics]
  );

  const overtimeInputError = useMemo(
    () => getOvertimeInputError(salaryMetrics?.hourlySalary || 0, overtimeHours, Boolean(salaryMetrics)),
    [overtimeHours, salaryMetrics]
  );

  function onAddFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addRssSubscription({ title: feedTitle, url: feedUrl });
    if (!result.ok) {
      setError(result.reason || t('finance.ui.addFeedFailed'));
      return;
    }
    setFeedTitle('');
    setFeedUrl('');
  }

  return (
    <div className="page-stack finance-page">
      <section className="card finance-salary-card">
        <h2 style={{ marginTop: 0 }}>💼 工资计算工具</h2>
        <p className="muted">先做基础版：输入月薪、计薪天数、每日工时，实时估算日薪、时薪和周薪参考值。</p>

        <div className="finance-salary-grid">
          <label className="finance-salary-field">
            <span>月薪</span>
            <div className={`finance-unit-input ${monthlySalary ? 'is-filled' : ''}`}>
              <input
                className="finance-debt-form-control"
                inputMode="decimal"
                value={monthlySalary}
                onChange={(event) => setMonthlySalary(sanitizePositiveNumberInput(event.target.value))}
                placeholder="例如 12000"
              />
              <span>元</span>
            </div>
          </label>

          <label className="finance-salary-field">
            <span>计薪天数</span>
            <div className={`finance-unit-input ${workingDays ? 'is-filled' : ''}`}>
              <input
                className="finance-debt-form-control"
                inputMode="decimal"
                value={workingDays}
                onChange={(event) => setWorkingDays(sanitizePositiveNumberInput(event.target.value))}
                placeholder="例如 21.75"
              />
              <span>天</span>
            </div>
          </label>

          <label className="finance-salary-field">
            <span>每日工时</span>
            <div className={`finance-unit-input ${dailyHours ? 'is-filled' : ''}`}>
              <input
                className="finance-debt-form-control"
                inputMode="decimal"
                value={dailyHours}
                onChange={(event) => setDailyHours(sanitizePositiveNumberInput(event.target.value))}
                placeholder="例如 8"
              />
              <span>小时</span>
            </div>
          </label>
        </div>

        {salaryInputError ? <p className="finance-debt-form-error muted">{salaryInputError}</p> : null}

        <div className="finance-salary-result-grid">
          <article className="finance-salary-metric card">
            <p className="finance-overview-label">日薪参考</p>
            <p className="finance-overview-value">
              <span className="finance-overview-number">{salaryMetrics ? formatMoney(salaryMetrics.dailySalary) : '—'}</span>
            </p>
          </article>
          <article className="finance-salary-metric card">
            <p className="finance-overview-label">时薪参考</p>
            <p className="finance-overview-value">
              <span className="finance-overview-number">{salaryMetrics ? formatMoney(salaryMetrics.hourlySalary) : '—'}</span>
            </p>
          </article>
          <article className="finance-salary-metric card">
            <p className="finance-overview-label">周薪参考（按 5 天）</p>
            <p className="finance-overview-value">
              <span className="finance-overview-number">{salaryMetrics ? formatMoney(salaryMetrics.weeklySalary) : '—'}</span>
            </p>
          </article>
        </div>

        <div className="finance-overtime-section">
          <div className="finance-overtime-header">
            <div>
              <h3 style={{ margin: 0 }}>⏱️ 加班工资估算</h3>
              <p className="muted finance-salary-hint">按当前时薪估算工作日 1.5 倍、休息日 2 倍、法定节假日 3 倍。</p>
            </div>
            <label className="finance-salary-field finance-overtime-input">
              <span>加班时长</span>
              <div className={`finance-unit-input ${overtimeHours ? 'is-filled' : ''}`}>
                <input
                  className="finance-debt-form-control"
                  inputMode="decimal"
                  value={overtimeHours}
                  onChange={(event) => setOvertimeHours(sanitizePositiveNumberInput(event.target.value))}
                  placeholder="例如 2"
                />
                <span>小时</span>
              </div>
            </label>
          </div>

          {overtimeInputError ? <p className="finance-debt-form-error muted">{overtimeInputError}</p> : null}

          <div className="finance-salary-result-grid">
            <article className="finance-salary-metric card">
              <p className="finance-overview-label">工作日加班费（1.5x）</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">{overtimeResult ? formatMoney(overtimeResult.workdayOvertimePay) : '—'}</span>
              </p>
            </article>
            <article className="finance-salary-metric card">
              <p className="finance-overview-label">休息日加班费（2x）</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">{overtimeResult ? formatMoney(overtimeResult.restDayOvertimePay) : '—'}</span>
              </p>
            </article>
            <article className="finance-salary-metric card">
              <p className="finance-overview-label">法定节假日加班费（3x）</p>
              <p className="finance-overview-value">
                <span className="finance-overview-number">{overtimeResult ? formatMoney(overtimeResult.holidayOvertimePay) : '—'}</span>
              </p>
            </article>
          </div>
        </div>

        <p className="finance-salary-hint muted">
          说明：这里是估算工具，默认不含社保、个税、补贴、提成与特殊排班。
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>📰 {t('finance.ui.title')}</h2>
        <p className="muted">{t('finance.ui.subtitle')}</p>

        <details className="card" style={{ padding: 12, marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            {t('finance.ui.rssManage')}（{rssSubscriptions.length}）
          </summary>

          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <form onSubmit={onAddFeed} className="finance-feed-form-grid">
              <input
                value={feedTitle}
                onChange={(event) => setFeedTitle(event.target.value)}
                placeholder={t('finance.ui.feedTitlePlaceholder')}
              />
              <input
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://example.com/feed.xml"
              />
              <button type="submit">{t('finance.ui.add')}</button>
            </form>

            <div
              style={{
                maxHeight: 210,
                overflowY: 'auto',
                display: 'grid',
                gap: 8,
                paddingRight: 4
              }}
            >
              {rssSubscriptions.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: 8
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong>{item.title}</strong>
                    <p
                      className="muted"
                      style={{
                        margin: 0,
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={item.url}
                    >
                      {item.url}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => toggleRssSubscription(item.id)}>
                      {item.enabled ? t('finance.ui.disable') : t('finance.ui.enable')}
                    </button>
                    <button type="button" onClick={() => removeRssSubscription(item.id)}>
                      {t('finance.ui.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {loading ? <p className="muted">{t('finance.ui.loading')}</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        {news.length === 0 ? (
          <p className="muted">{t('finance.ui.noCachedNews')}</p>
        ) : (
          <div className="finance-news-compact-list">
            {news.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`finance-news-compact-item ${activeNews?.id === item.id ? 'is-active' : ''}`}
                onClick={() => setActiveNewsId(item.id)}
              >
                <strong>{item.title}</strong>
                <p className="muted">
                  {item.source} · {item.publishedAt}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {activeNews ? (
        <section
          className="card"
          style={{ border: '2px solid var(--color-primary-border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <h3 style={{ marginTop: 0 }}>🧾 {t('finance.ui.readerTitle')}</h3>
          <h4>{activeNews.title}</h4>
          <p className="muted" style={{ marginTop: 0 }}>
            {activeNews.source} · {activeNews.publishedAt}
          </p>
          <p>{activeNews.summary || t('finance.ui.noSummary')}</p>
          <a href={activeNews.link} target="_blank" rel="noreferrer">
            {t('finance.ui.openOriginal')}
          </a>
        </section>
      ) : null}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>💡 {t('finance.ui.dailyIdeaTitle')}</h3>
        <p>{dailyIdea}</p>
      </section>
    </div>
  );
}
