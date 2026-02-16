import { beforeEach, describe, expect, it } from 'vitest';
import { useAppPreferences } from './useAppPreferences';

describe('useAppPreferences RSS subscriptions', () => {
  beforeEach(() => {
    localStorage.removeItem('ledgerflow-preferences');
    useAppPreferences.setState({
      theme: 'system',
      rssSubscriptions: [
        {
          id: 'rss-financial-times-markets',
          title: 'Financial Times · Markets',
          url: 'https://www.ft.com/markets?format=rss',
          enabled: true
        },
        {
          id: 'rss-yahoo-finance-top',
          title: 'Yahoo Finance · Top News',
          url: 'https://finance.yahoo.com/news/rssindex',
          enabled: true
        }
      ]
    });
  });

  it('should add a valid RSS feed and reject duplicates', () => {
    const first = useAppPreferences.getState().addRssSubscription({
      title: 'Reuters Markets',
      url: 'https://www.reutersagency.com/feed/?best-topics=business-finance'
    });
    const second = useAppPreferences.getState().addRssSubscription({
      title: 'Reuters Markets 2',
      url: 'https://www.reutersagency.com/feed/?best-topics=business-finance'
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toContain('已订阅');
  });

  it('should toggle and remove RSS subscription', () => {
    const current = useAppPreferences.getState().rssSubscriptions[0];
    useAppPreferences.getState().toggleRssSubscription(current.id);
    const toggled = useAppPreferences
      .getState()
      .rssSubscriptions.find((item) => item.id === current.id);

    expect(toggled?.enabled).toBe(false);

    useAppPreferences.getState().removeRssSubscription(current.id);
    const removed = useAppPreferences
      .getState()
      .rssSubscriptions.find((item) => item.id === current.id);

    expect(removed).toBeUndefined();
  });
});
