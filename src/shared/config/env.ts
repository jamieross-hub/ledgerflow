const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').trim();

function normalizeApiBaseUrl(url: string) {
  if (!url) return '/api';
  const normalized = url.endsWith('/') ? url.slice(0, -1) : url;
  return normalized || '/api';
}

export const ENV = {
  /**
   * 兼容模式：优先直连远程后端域名；未配置时回退到本地 /api 代理。
   */
  apiBaseUrl: normalizeApiBaseUrl(rawApiBaseUrl),
  requestTimeoutMs: Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || 8000),
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  aiBaseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://ai.shuaihong.fun/v1',
  aiApiKey: import.meta.env.VITE_AI_API_KEY || '',
  aiDefaultModel: import.meta.env.VITE_AI_DEFAULT_MODEL || 'gpt-4o-mini',
  /** 手动全量同步路径（会拼接到 apiBaseUrl 后） */
  syncLocalDataPath: import.meta.env.VITE_SYNC_LOCAL_DATA_PATH || '/sync-local-data',
  /** 自动增量同步路径（会拼接到 apiBaseUrl 后） */
  syncChangePath: import.meta.env.VITE_SYNC_CHANGE_PATH || '/sync-change',
  /** 汇率 API 基础地址，默认 frankfurter.app */
  exchangeApiBase: import.meta.env.VITE_EXCHANGE_API_BASE || 'https://api.frankfurter.app',
  /** 汇率 API 超时时间（ms） */
  exchangeApiTimeoutMs: Number(import.meta.env.VITE_EXCHANGE_API_TIMEOUT_MS || 10000)
};
