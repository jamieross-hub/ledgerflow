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

async function requestJson<T>(url: string, payload: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ENV.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
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
      throw new Error(body.detail ? `${message}：${body.detail}` : message);
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

export async function postSyncLocalData(payload: SyncLocalDataRequest): Promise<SyncLocalDataResponse> {
  return requestJson<SyncLocalDataResponse>(`${ENV.apiBaseUrl}/sync-local-data`, payload);
}

export async function postSyncChange(payload: SyncChangeRequest): Promise<SyncChangeResponse> {
  return requestJson<SyncChangeResponse>(`${ENV.apiBaseUrl}/sync-change`, payload);
}
