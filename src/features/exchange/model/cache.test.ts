import { describe, it, expect, beforeEach } from 'vitest';
import { readCache, writeCache, clearCache, CACHE_TTL_MS } from './cache';

describe('exchange cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('写入后应能读取缓存', () => {
    const rates = { USD: 0.14, EUR: 0.13 };
    writeCache('CNY', '2026-02-07', rates);

    const cached = readCache('CNY');
    expect(cached).not.toBeNull();
    expect(cached!.base).toBe('CNY');
    expect(cached!.date).toBe('2026-02-07');
    expect(cached!.rates.USD).toBe(0.14);
    expect(cached!.rates.EUR).toBe(0.13);
  });

  it('不同 base 的缓存应互不干扰', () => {
    writeCache('CNY', '2026-02-07', { USD: 0.14 });
    writeCache('USD', '2026-02-07', { CNY: 7.1 });

    const cnyCached = readCache('CNY');
    const usdCached = readCache('USD');
    expect(cnyCached!.rates.USD).toBe(0.14);
    expect(usdCached!.rates.CNY).toBe(7.1);
  });

  it('过期缓存应返回 null', () => {
    writeCache('CNY', '2026-02-07', { USD: 0.14 });

    // 手动篡改 cachedAt 使其过期
    const raw = localStorage.getItem('ledgerflow-exchange-cache');
    const map = JSON.parse(raw!);
    map['CNY'].cachedAt = Date.now() - CACHE_TTL_MS - 1000;
    localStorage.setItem('ledgerflow-exchange-cache', JSON.stringify(map));

    expect(readCache('CNY')).toBeNull();
  });

  it('clearCache 应清除所有缓存', () => {
    writeCache('CNY', '2026-02-07', { USD: 0.14 });
    writeCache('USD', '2026-02-07', { CNY: 7.1 });
    clearCache();

    expect(readCache('CNY')).toBeNull();
    expect(readCache('USD')).toBeNull();
  });
});
