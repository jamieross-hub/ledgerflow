import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import { TransactionItem } from '../../entities/transaction/types';
import { ENV } from '../config/env';

export interface FinanceSyncData {
  transactions: TransactionItem[];
  accounts: Account[];
  categories: Category[];
}

export interface SyncLocalDataRequest {
  source: 'manual' | 'auto';
  strategy?: 'append' | 'upsert';
  data: FinanceSyncData;
}

export interface SyncLocalDataResponse {
  ok: boolean;
  message: string;
  synced?: number;
  detail?: string;
}

export interface SyncChangeRequest {
  entity: 'transactions' | 'accounts' | 'categories';
  action: 'insert' | 'update' | 'delete';
  row?: unknown;
  id?: string;
  happenedAt: string;
}

export interface SyncChangeResponse {
  ok: boolean;
  message: string;
  detail?: string;
}

class HttpRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpRequestError';
    this.status = status;
  }
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeBase(base: string) {
  if (!base) return '';
  if (base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

async function requestJson<T>(url: string, payload: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ENV.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      detail?: string;
    };

    if (!response.ok) {
      const message = body.error || body.message || `HTTP ${response.status}`;
      throw new HttpRequestError(response.status, body.detail ? `${message}：${body.detail}` : message);
    }

    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请检查数据库连接或网络状态');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestWithFallback<T>(
  paths: string[],
  payload: unknown,
  methods: Array<'POST' | 'PUT'> = ['POST']
): Promise<T> {
  let lastError: unknown;
  const attempts: string[] = [];
  const baseCandidates = Array.from(new Set([normalizeBase(ENV.apiBaseUrl), '']));

  for (const base of baseCandidates) {
    for (const path of paths) {
      const url = `${base}${normalizePath(path)}`;

      for (const method of methods) {
        try {
          attempts.push(`${method} ${url}`);
          return await requestJson<T>(url, payload, method);
        } catch (error) {
          lastError = error;
          if (error instanceof HttpRequestError && (error.status === 404 || error.status === 405)) {
            continue;
          }
          throw error;
        }
      }
    }
  }

  if (lastError instanceof HttpRequestError && (lastError.status === 404 || lastError.status === 405)) {
    const tested = attempts.join(' | ');
    throw new Error(`同步接口不可用（HTTP 404/405）。已尝试：${tested}`);
  }

  throw lastError instanceof Error ? lastError : new Error('同步请求失败');
}

export async function postSyncLocalData(payload: SyncLocalDataRequest): Promise<SyncLocalDataResponse> {
  return requestWithFallback<SyncLocalDataResponse>(
    [ENV.syncLocalDataPath, '/conn/sync-local-data', '/sync/local-data'],
    payload,
    ['POST', 'PUT']
  );
}

export async function postSyncChange(payload: SyncChangeRequest): Promise<SyncChangeResponse> {
  return requestWithFallback<SyncChangeResponse>([ENV.syncChangePath, '/conn/sync-change', '/sync/change'], payload, ['POST', 'PUT']);
}
