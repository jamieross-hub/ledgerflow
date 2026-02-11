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
  targetDbType?: 'postgresql' | 'mysql';
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
  targetDbType?: 'postgresql' | 'mysql';
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

function joinBaseAndPath(base: string, path: string) {
  const normalizedPath = normalizePath(path);
  if (!base) return normalizedPath;

  // 避免 /api + /api/** 变成 /api/api/**
  if (
    (base === '/api' || base.endsWith('/api')) &&
    (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))
  ) {
    const trimmed = normalizedPath.slice(4) || '/';
    return `${base}${trimmed}`;
  }

  return `${base}${normalizedPath}`;
}

async function requestJson<T>(
  url: string,
  payload: unknown,
  method: 'POST' | 'PUT' = 'POST'
): Promise<T> {
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
      throw new HttpRequestError(
        response.status,
        body.detail ? `${message}：${body.detail}` : message
      );
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
  const attemptedSet = new Set<string>();
  const normalizedBase = normalizeBase(ENV.apiBaseUrl);
  const baseCandidates = Array.from(new Set([normalizedBase, '']));

  for (const base of baseCandidates) {
    for (const path of paths) {
      const url = joinBaseAndPath(base, path);

      for (const method of methods) {
        const attemptKey = `${method} ${url}`;
        if (attemptedSet.has(attemptKey)) continue;
        attemptedSet.add(attemptKey);

        try {
          attempts.push(attemptKey);
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

  if (
    lastError instanceof HttpRequestError &&
    (lastError.status === 404 || lastError.status === 405)
  ) {
    const tested = attempts.join(' | ');
    throw new Error(`同步接口不可用（HTTP 404/405）。已尝试：${tested}`);
  }

  throw lastError instanceof Error ? lastError : new Error('同步请求失败');
}

export async function postSyncLocalData(
  payload: SyncLocalDataRequest
): Promise<SyncLocalDataResponse> {
  return requestWithFallback<SyncLocalDataResponse>(
    [
      ENV.syncLocalDataPath,
      '/sync-local-data',
      '/api/sync-local-data',
      '/conn/sync-local-data',
      '/api/conn/sync-local-data',
      '/sync/local-data',
      '/api/sync/local-data'
    ],
    payload,
    ['POST', 'PUT']
  );
}

export async function postSyncChange(payload: SyncChangeRequest): Promise<SyncChangeResponse> {
  return requestWithFallback<SyncChangeResponse>(
    [
      ENV.syncChangePath,
      '/sync-change',
      '/api/sync-change',
      '/conn/sync-change',
      '/api/conn/sync-change',
      '/sync/change',
      '/api/sync/change'
    ],
    payload,
    ['POST', 'PUT']
  );
}
