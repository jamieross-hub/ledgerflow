import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLatestRates } from '../api/exchangeClient';
import { readCache, writeCache } from '../model/cache';
import type { ExchangeRate } from '../model/types';
import { getCurrencyName } from '../model/types';

interface UseExchangeRatesReturn {
  /** 汇率列表（已排序） */
  rates: ExchangeRate[];
  /** 基准货币 */
  base: string;
  /** 数据日期 */
  date: string;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 切换基准货币 */
  setBase: (code: string) => void;
  /** 手动刷新 */
  refresh: () => void;
}

function toSortedRates(
  ratesMap: Record<string, number>,
  previousMap?: Record<string, number>
): ExchangeRate[] {
  return Object.entries(ratesMap)
    .map(([code, rate]) => {
      const previousRate = previousMap?.[code];
      const trend: ExchangeRate['trend'] =
        typeof previousRate !== 'number'
          ? undefined
          : rate > previousRate
            ? 'up'
            : rate < previousRate
              ? 'down'
              : 'flat';
      return { code, name: getCurrencyName(code), rate, trend };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function useExchangeRates(initialBase = 'CNY'): UseExchangeRatesReturn {
  const [base, setBase] = useState(initialBase);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const mountedRef = useRef(true);
  const latestRatesMapRef = useRef<Record<string, number>>({});

  const load = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      // 1. 尝试读缓存
      if (!forceRefresh) {
        const cached = readCache(base);
        if (cached) {
          latestRatesMapRef.current = cached.rates;
          setRates(toSortedRates(cached.rates));
          setDate(cached.date);
          setFromCache(true);
          setLoading(false);
          return;
        }
      }

      // 2. 请求 API
      try {
        const data = await fetchLatestRates(base);
        if (!mountedRef.current) return;
        writeCache(base, data.date, data.rates);
        setRates(toSortedRates(data.rates, latestRatesMapRef.current));
        latestRatesMapRef.current = data.rates;
        setDate(data.date);
        setFromCache(false);
      } catch (err) {
        if (!mountedRef.current) return;
        // 3. 离线回退：尝试过期缓存
        const stale = readCache(base);
        if (stale) {
          latestRatesMapRef.current = stale.rates;
          setRates(toSortedRates(stale.rates));
          setDate(stale.date);
          setFromCache(true);
        } else {
          setError(err instanceof Error ? err.message : '获取汇率失败');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [base]
  );

  useEffect(() => {
    mountedRef.current = true;
    latestRatesMapRef.current = {};
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => void load(true), [load]);

  return { rates, base, date, loading, error, fromCache, setBase, refresh };
}
