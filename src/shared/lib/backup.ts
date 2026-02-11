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

function buildBasicAuth(username: string, password: string): string {
  return `Basic ${window.btoa(`${username}:${password}`)}`;
}

export async function webdavUploadBackup(
  config: BackupWebdavConfig,
  payload: FinanceBackupPayload
): Promise<void> {
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
}

export async function webdavDownloadBackup(
  config: BackupWebdavConfig
): Promise<FinanceBackupPayload> {
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
}
