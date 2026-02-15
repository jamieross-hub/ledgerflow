import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import {
  calculateDebtMinimumPayment,
  calculateDebtSummary,
  DebtType
} from '../../features/debt/model/debtMetrics';

type FinanceNewsItem = {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  summary?: string;
};

const FINANCE_NEWS_CACHE_KEY = 'ledgerflow.finance.news-cache.v1';

const FINANCE_IDEAS = [
  '📌 每周固定 10 分钟复盘：本周最值得关注的 3 条财经事件是什么？',
  '📈 建一个“利率观察”清单：LPR、10Y 国债、美元指数，形成自己的宏观体感。',
  '💡 记账时给大额支出打标签（如教育/医疗/旅行），月末更容易做预算优化。',
  '🧠 避免追涨杀跌：先写下交易理由，再决定是否执行。',
  '🛟 保留 3~6 个月应急资金，投资前先保证现金流安全。'
];

function formatTimeLabel(value?: string): string {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
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

function parseRssItems(xmlText: string, fallbackSource: string): FinanceNewsItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('RSS 解析失败');
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
        '未命名资讯';
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
        publishedAt: formatTimeLabel(publishedRaw),
        summary: cleanHtml(summaryRaw)
      };
    })
    .filter((item) => item.title && item.link)
    .slice(0, 8);
}

async function fetchRssFeed(feedUrl: string, signal: AbortSignal): Promise<FinanceNewsItem[]> {
  const encodedUrl = encodeURIComponent(feedUrl);
  const response = await fetch(`https://api.allorigins.win/raw?url=${encodedUrl}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xmlText = await response.text();
  return parseRssItems(xmlText, feedUrl);
}

export function FinancePage() {
  const {
    rssSubscriptions,
    addRssSubscription,
    removeRssSubscription,
    toggleRssSubscription,
    debts,
    monthlyIncome,
    setMonthlyIncome,
    addDebt,
    removeDebt
  } = useAppPreferences();
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
  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('credit-card');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtAnnualRate, setDebtAnnualRate] = useState('');
  const [debtMonths, setDebtMonths] = useState('');

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
          enabledFeeds.map((item) => fetchRssFeed(item.url, controller.signal))
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
          setError('订阅源暂无可读内容，已展示上次缓存资讯。');
        }

        if (loadedLists.every((result) => result.status === 'rejected')) {
          setError('RSS 订阅源暂不可用，已展示上次缓存资讯。');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('RSS 订阅源暂不可用，已展示上次缓存资讯。');
        }
      } finally {
        setLoading(false);
      }
    }

    loadFinanceNews();
    return () => controller.abort();
  }, [enabledFeeds]);

  const dailyIdea = useMemo(() => {
    const day = new Date().getDate();
    return FINANCE_IDEAS[day % FINANCE_IDEAS.length];
  }, []);

  const activeNews = useMemo(
    () => news.find((item) => item.id === activeNewsId) || news[0] || null,
    [activeNewsId, news]
  );
  const debtSummary = useMemo(
    () => calculateDebtSummary(debts, monthlyIncome),
    [debts, monthlyIncome]
  );

  function onAddFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = addRssSubscription({ title: feedTitle, url: feedUrl });
    if (!result.ok) {
      setError(result.reason || '新增 RSS 失败。');
      return;
    }
    setFeedTitle('');
    setFeedUrl('');
  }

  function onAddDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const balance = Number(debtBalance);
    if (!debtName.trim() || !Number.isFinite(balance) || balance <= 0) {
      setError('请填写有效的负债名称和金额。');
      return;
    }

    addDebt({
      name: debtName.trim(),
      type: debtType,
      balance,
      annualRate: debtType === 'loan' ? Number(debtAnnualRate) || 0 : undefined,
      remainingMonths: debtType === 'loan' ? Number(debtMonths) || 12 : undefined
    });

    setDebtName('');
    setDebtBalance('');
    setDebtAnnualRate('');
    setDebtMonths('');
  }

  return (
    <div className="page-stack">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>💳 负债管理</h2>
        <p className="muted">支持信用卡、花呗、贷款，自动计算每月最低还款额与总负债压力。</p>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="muted">月收入（用于计算负债压力）</span>
            <input
              type="number"
              min={0}
              value={monthlyIncome || ''}
              onChange={(event) => setMonthlyIncome(Number(event.target.value) || 0)}
              placeholder="例如 15000"
            />
          </label>
        </div>

        <form
          onSubmit={onAddDebt}
          style={{ display: 'grid', gap: 8, gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto' }}
        >
          <input
            value={debtName}
            onChange={(event) => setDebtName(event.target.value)}
            placeholder="负债名称"
          />
          <select
            value={debtType}
            onChange={(event) => setDebtType(event.target.value as DebtType)}
          >
            <option value="credit-card">信用卡</option>
            <option value="huabei">花呗</option>
            <option value="loan">贷款</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={debtBalance}
            onChange={(event) => setDebtBalance(event.target.value)}
            placeholder="剩余本金"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={debtAnnualRate}
            onChange={(event) => setDebtAnnualRate(event.target.value)}
            placeholder="年化利率%"
            disabled={debtType !== 'loan'}
          />
          <input
            type="number"
            min={1}
            value={debtMonths}
            onChange={(event) => setDebtMonths(event.target.value)}
            placeholder="剩余期数"
            disabled={debtType !== 'loan'}
          />
          <button type="submit">新增</button>
        </form>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {debts.length === 0 ? <p className="muted">还没有负债记录，先新增一条吧。</p> : null}
          {debts.map((item) => {
            const minimum = calculateDebtMinimumPayment(item);
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div>
                  <strong>
                    {item.name} ·
                    {item.type === 'credit-card'
                      ? '信用卡'
                      : item.type === 'huabei'
                        ? '花呗'
                        : '贷款'}
                  </strong>
                  <p className="muted" style={{ margin: 0 }}>
                    剩余本金 ¥{item.balance.toFixed(2)} · 最低还款 ¥{minimum.toFixed(2)}
                  </p>
                </div>
                <button type="button" onClick={() => removeDebt(item.id)}>
                  删除
                </button>
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>负债压力总览</h3>
          <p style={{ margin: '4px 0' }}>总负债：¥{debtSummary.totalDebt.toFixed(2)}</p>
          <p style={{ margin: '4px 0' }}>
            每月最低还款：¥{debtSummary.totalMinimumPayment.toFixed(2)}
          </p>
          <p style={{ margin: '4px 0' }}>
            负债压力：{(debtSummary.pressureRatio * 100).toFixed(1)}%
            {monthlyIncome <= 0 ? '（请填写月收入）' : ''}
          </p>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>📰 金融资讯</h2>
        <p className="muted">支持 RSS 订阅与阅读，便于按自己的信息源持续跟踪财经动态。</p>

        <details className="card" style={{ padding: 12, marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            RSS 订阅管理（{rssSubscriptions.length}）
          </summary>

          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <form
              onSubmit={onAddFeed}
              style={{
                display: 'grid',
                gap: 8,
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) auto',
                alignItems: 'center'
              }}
            >
              <input
                value={feedTitle}
                onChange={(event) => setFeedTitle(event.target.value)}
                placeholder="订阅名称（可选）"
              />
              <input
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://example.com/feed.xml"
              />
              <button type="submit">新增</button>
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
                      {item.enabled ? '停用' : '启用'}
                    </button>
                    <button type="button" onClick={() => removeRssSubscription(item.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        {loading ? <p className="muted">正在加载 RSS 资讯...</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        {news.length === 0 ? (
          <p className="muted">暂无可展示的 RSS 缓存资讯，请检查订阅源后重试。</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {news.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card"
                onClick={() => setActiveNewsId(item.id)}
                style={{
                  padding: 12,
                  textAlign: 'left',
                  border:
                    activeNews?.id === item.id
                      ? '1px solid var(--color-primary, #2563eb)'
                      : '1px solid var(--color-border)',
                  background: 'transparent'
                }}
              >
                <strong>{item.title}</strong>
                <p className="muted" style={{ marginBottom: 0 }}>
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
          <h3 style={{ marginTop: 0 }}>🧾 RSS 阅读器</h3>
          <h4>{activeNews.title}</h4>
          <p className="muted" style={{ marginTop: 0 }}>
            {activeNews.source} · {activeNews.publishedAt}
          </p>
          <p>{activeNews.summary || '该订阅源未提供摘要，请点击下方链接阅读原文。'}</p>
          <a href={activeNews.link} target="_blank" rel="noreferrer">
            打开原文
          </a>
        </section>
      ) : null}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>💡 今日金融小建议</h3>
        <p>{dailyIdea}</p>
      </section>
    </div>
  );
}
