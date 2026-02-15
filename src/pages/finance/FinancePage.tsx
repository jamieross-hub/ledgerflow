import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAppPreferences } from '../../shared/store/useAppPreferences';

type FinanceNewsItem = {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  summary?: string;
};

const FALLBACK_NEWS: FinanceNewsItem[] = [
  {
    id: 'fallback-1',
    title: '央行公开市场操作保持流动性合理充裕，短端利率维持平稳',
    source: '宏观观察',
    link: 'https://www.gov.cn/',
    publishedAt: '今日',
    summary: '关注流动性投放节奏与短端利率变化，利于理解市场风险偏好。'
  },
  {
    id: 'fallback-2',
    title: '多家机构上调全年 GDP 增速预测，消费修复成为核心变量',
    source: '机构研报摘要',
    link: 'https://www.stats.gov.cn/',
    publishedAt: '今日',
    summary: '观察社零、就业与居民信心等指标是否持续共振，避免只看单一数据。'
  },
  {
    id: 'fallback-3',
    title: '黄金与原油波动加剧，资产配置更强调分散化与现金流质量',
    source: '资产配置周报',
    link: 'https://www.safe.gov.cn/',
    publishedAt: '本周',
    summary: '在高波动阶段保持仓位纪律与流动性缓冲，优先保证家庭现金流稳定。'
  }
];

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
  const { rssSubscriptions, addRssSubscription, removeRssSubscription, toggleRssSubscription } =
    useAppPreferences();
  const [news, setNews] = useState<FinanceNewsItem[]>(FALLBACK_NEWS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedTitle, setFeedTitle] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [activeNewsId, setActiveNewsId] = useState('');

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
        setNews(FALLBACK_NEWS);
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
          setActiveNewsId((current) => current || sorted[0].id);
        } else {
          setNews(FALLBACK_NEWS);
          setError('订阅源暂无可读内容，已展示内置财经资讯。');
        }

        if (loadedLists.every((result) => result.status === 'rejected')) {
          setError('RSS 订阅源暂不可用，已切换到内置财经内容。');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('RSS 订阅源暂不可用，已切换到内置财经内容。');
          setNews(FALLBACK_NEWS);
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

  return (
    <div className="page-stack">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>📰 金融资讯</h2>
        <p className="muted">支持 RSS 订阅与阅读，便于按自己的信息源持续跟踪财经动态。</p>

        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>RSS 订阅管理</h3>
          <form onSubmit={onAddFeed} style={{ display: 'grid', gap: 8 }}>
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
            <button type="submit">新增订阅</button>
          </form>

          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
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
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                    {item.url}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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

        {loading ? <p className="muted">正在加载 RSS 资讯...</p> : null}
        {error ? <p className="muted">{error}</p> : null}

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
      </section>

      {activeNews ? (
        <section className="card">
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
