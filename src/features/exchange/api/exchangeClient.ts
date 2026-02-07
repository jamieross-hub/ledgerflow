import { ENV } from '../../../shared/config/env';
import type { ExchangeApiResponse } from '../model/types';

/**
 * 从公共 API 获取最新汇率
 * 默认使用 frankfurter.app（免费、无需 key、支持 CORS）
 * 可通过 VITE_EXCHANGE_API_BASE 覆盖
 */
export async function fetchLatestRates(base: string): Promise<ExchangeApiResponse> {
  const apiBase = ENV.exchangeApiBase || 'https://api.frankfurter.app';
  const timeout = ENV.exchangeApiTimeoutMs || 10000;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${apiBase}/latest?base=${encodeURIComponent(base)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`汇率 API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data: ExchangeApiResponse = await response.json();
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}
