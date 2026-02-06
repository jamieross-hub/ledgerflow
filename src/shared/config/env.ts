export const ENV = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  requestTimeoutMs: Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || 8000),
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'info'
};
