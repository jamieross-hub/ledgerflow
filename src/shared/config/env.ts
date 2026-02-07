export const ENV = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  requestTimeoutMs: Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || 8000),
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  aiBaseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://ai.shuaihong.fun/v1',
  aiApiKey: import.meta.env.VITE_AI_API_KEY || '',
  aiDefaultModel: import.meta.env.VITE_AI_DEFAULT_MODEL || 'gpt-4o-mini',
  /** 汇率 API 基础地址，默认 frankfurter.app */
  exchangeApiBase: import.meta.env.VITE_EXCHANGE_API_BASE || 'https://api.frankfurter.app',
  /** 汇率 API 超时时间（ms） */
  exchangeApiTimeoutMs: Number(import.meta.env.VITE_EXCHANGE_API_TIMEOUT_MS || 10000)
};
