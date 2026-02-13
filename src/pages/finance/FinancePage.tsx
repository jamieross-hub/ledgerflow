import { useEffect, useMemo, useState } from 'react';

type FinanceNewsItem = {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
};

const FALLBACK_NEWS: FinanceNewsItem[] = [
  {
    id: 'fallback-1',
    title: '央行公开市场操作保持流动性合理充裕，短端利率维持平稳',
    source: '宏观观察',
    link: 'https://www.gov.cn/',
    publishedAt: '今日'
  },
  {
    id: 'fallback-2',
    title: '多家机构上调全年 GDP 增速预测，消费修复成为核心变量',
    source: '机构研报摘要',
    link: 'https://www.stats.gov.cn/',
    publishedAt: '今日'
  },
  {
    id: 'fallback-3',
    title: '黄金与原油波动加剧，资产配置更强调分散化与现金流质量',
    source: '资产配置周报',
    link: 'https://www.safe.gov.cn/',
    publishedAt: '本周'
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

export function FinancePage() {
  const [news, setNews] = useState<FinanceNewsItem[]>(FALLBACK_NEWS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadFinanceNews() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          'https://api.allorigins.win/raw?url=https://www.cnbeta.com/backend/getArticlesByEndless?type=all&page=1',
          {
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as {
          result?: {
            list?: Array<{ article_id?: string; title?: string; url?: string; pub_time?: string }>;
          };
        };
        const list = payload?.result?.list || [];
        const mapped = list
          .filter((item) => typeof item.title === 'string' && item.title.trim())
          .slice(0, 8)
          .map((item, index) => ({
            id: item.article_id || `remote-${index}`,
            title: item.title || '未命名资讯',
            source: '实时资讯',
            link: item.url ? `https://www.cnbeta.com${item.url}` : 'https://www.cnbeta.com/',
            publishedAt: formatTimeLabel(item.pub_time)
          }));

        if (mapped.length > 0) {
          setNews(mapped);
        } else {
          setNews(FALLBACK_NEWS);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('实时资讯暂不可用，已切换到内置财经内容。');
          setNews(FALLBACK_NEWS);
        }
      } finally {
        setLoading(false);
      }
    }

    loadFinanceNews();
    return () => controller.abort();
  }, []);

  const dailyIdea = useMemo(() => {
    const day = new Date().getDate();
    return FINANCE_IDEAS[day % FINANCE_IDEAS.length];
  }, []);

  return (
    <div className="page-stack">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>📰 金融资讯</h2>
        <p className="muted">给「杂项」增加一个能随手浏览的财经信息区，避免空闲时无内容可看。</p>
        {loading ? <p className="muted">正在加载近期资讯...</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        <div style={{ display: 'grid', gap: 10 }}>
          {news.map((item) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="card"
              style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}
            >
              <strong>{item.title}</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                {item.source} · {item.publishedAt}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>💡 今日金融小建议</h3>
        <p>{dailyIdea}</p>
      </section>
    </div>
  );
}
