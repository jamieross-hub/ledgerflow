import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import { TransactionItem } from '../../entities/transaction/types';

const BACKUP_KEY = 'ledgerflow-backup-webdav-v1';

export interface BackupWebdavConfig {
  endpoint: string;
  username: string;
  password: string;
  remoteFilePath: string;
}

export interface FinanceBackupPayload {
  version: number;
  exportedAt: string;
  data: {
    transactions: TransactionItem[];
    categories: Category[];
    accounts: Account[];
  };
}

export function createFinanceBackupPayload(input: {
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
}): FinanceBackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      transactions: input.transactions,
      categories: input.categories,
      accounts: input.accounts
    }
  };
}

export function parseFinanceBackupPayload(raw: string): FinanceBackupPayload {
  const parsed = JSON.parse(raw) as Partial<FinanceBackupPayload>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式无效');
  }

  const data = parsed.data;
  if (!data || typeof data !== 'object') {
    throw new Error('备份文件缺少 data 字段');
  }

  const transactions = Array.isArray(data.transactions) ? data.transactions : null;
  const categories = Array.isArray(data.categories) ? data.categories : null;
  const accounts = Array.isArray(data.accounts) ? data.accounts : null;

  if (!transactions || !categories || !accounts) {
    throw new Error('备份文件缺少必要数据（transactions/categories/accounts）');
  }

  return {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    data: {
      transactions: transactions as TransactionItem[],
      categories: categories as Category[],
      accounts: accounts as Account[]
    }
  };
}

export function downloadBackupJson(payload: FinanceBackupPayload): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ledgerflow-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function saveWebdavConfig(config: BackupWebdavConfig): void {
  window.localStorage.setItem(BACKUP_KEY, JSON.stringify(config));
}

export function loadWebdavConfig(): BackupWebdavConfig {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) {
      return {
        endpoint: '',
        username: '',
        password: '',
        remoteFilePath: 'ledgerflow/backup.json'
      };
    }
    const parsed = JSON.parse(raw) as Partial<BackupWebdavConfig>;
    return {
      endpoint: String(parsed.endpoint || ''),
      username: String(parsed.username || ''),
      password: String(parsed.password || ''),
      remoteFilePath: String(parsed.remoteFilePath || 'ledgerflow/backup.json')
    };
  } catch {
    return {
      endpoint: '',
      username: '',
      password: '',
      remoteFilePath: 'ledgerflow/backup.json'
    };
  }
}

function joinWebdavPath(endpoint: string, remoteFilePath: string): string {
  const base = endpoint.replace(/\/+$/, '');
  const path = remoteFilePath.replace(/^\/+/, '');
  return `${base}/${path}`;
}

function normalizeWebdavError(action: '上传' | '下载' | '创建目录', error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return new Error(`WebDAV ${action}失败：网络连接或跨域(CORS)被拦截，请检查地址与服务端配置`);
    }
    return error;
  }
  return new Error(`WebDAV ${action}失败，请稍后重试`);
}

async function ensureWebdavDirectories(config: BackupWebdavConfig): Promise<void> {
  const normalizedPath = config.remoteFilePath.replace(/^\/+/, '').split('/').filter(Boolean);
  if (normalizedPath.length <= 1) {
    return;
  }

  const folders = normalizedPath.slice(0, -1);
  const base = config.endpoint.replace(/\/+$/, '');
  let current = '';
  for (const segment of folders) {
    current = current ? `${current}/${segment}` : segment;
    let response: Response;
    try {
      response = await fetch(`${base}/${current}`, {
        method: 'MKCOL',
        headers: {
          Authorization: buildBasicAuth(config.username, config.password)
        }
      });
    } catch {
      // 某些 WebDAV 服务不允许跨域 MKCOL（但允许 PUT），目录创建失败时交给后续 PUT 决定。
      continue;
    }

    if (![200, 201, 204, 301, 302, 405].includes(response.status)) {
      throw new Error(`WebDAV 目录创建失败（${current}，HTTP ${response.status}）`);
    }
  }
}

function buildBasicAuth(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const bytes = new TextEncoder().encode(raw);
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return `Basic ${window.btoa(binary)}`;
}

export async function webdavUploadBackup(
  config: BackupWebdavConfig,
  payload: FinanceBackupPayload
): Promise<void> {
  try {
    await ensureWebdavDirectories(config);
    const url = joinWebdavPath(config.endpoint, config.remoteFilePath);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: buildBasicAuth(config.username, config.password),
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(payload, null, 2)
    });

    if (!response.ok) {
      throw new Error(`WebDAV 上传失败（HTTP ${response.status}）`);
    }
  } catch (error) {
    throw normalizeWebdavError('上传', error);
  }
}

export async function webdavDownloadBackup(
  config: BackupWebdavConfig
): Promise<FinanceBackupPayload> {
  try {
    const url = joinWebdavPath(config.endpoint, config.remoteFilePath);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: buildBasicAuth(config.username, config.password)
      }
    });

    if (!response.ok) {
      throw new Error(`WebDAV 下载失败（HTTP ${response.status}）`);
    }

    const text = await response.text();
    return parseFinanceBackupPayload(text);
  } catch (error) {
    throw normalizeWebdavError('下载', error);
  }
}
