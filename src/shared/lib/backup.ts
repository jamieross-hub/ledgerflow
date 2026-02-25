import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import { TransactionItem } from '../../entities/transaction/types';

const BACKUP_KEY = 'ledgerflow-backup-webdav-v1';
const BACKUP_PASSWORD_SESSION_KEY = 'ledgerflow-backup-webdav-password';

export interface BackupWebdavConfig {
  /** 真实 WebDAV 服务地址，例如：https://dav.example.com/remote.php/dav/files/user */
  endpoint: string;
  username: string;
  password: string;
  remoteFilePath: string;
  /** 是否通过同源代理请求（用于规避浏览器跨域限制） */
  proxyEnabled: boolean;
  /** 同源代理入口路径，例如：/api/webdav */
  proxyBasePath: string;
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
  const normalizedRaw = raw.replace(/^\uFEFF/, '').trim();
  const parsed = JSON.parse(normalizedRaw) as Partial<FinanceBackupPayload>;
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

function readWebdavPasswordFromSession(): string {
  try {
    return window.sessionStorage.getItem(BACKUP_PASSWORD_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function writeWebdavPasswordToSession(password: string): void {
  try {
    if (password) {
      window.sessionStorage.setItem(BACKUP_PASSWORD_SESSION_KEY, password);
      return;
    }
    window.sessionStorage.removeItem(BACKUP_PASSWORD_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

export function saveWebdavConfig(config: BackupWebdavConfig): void {
  writeWebdavPasswordToSession(config.password);
  window.localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({
      ...config,
      password: ''
    })
  );
}

export function loadWebdavConfig(): BackupWebdavConfig {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) {
      return {
        endpoint: '',
        username: '',
        password: '',
        remoteFilePath: 'ledgerflow/backup.json',
        proxyEnabled: true,
        proxyBasePath: '/api/webdav'
      };
    }
    const parsed = JSON.parse(raw) as Partial<BackupWebdavConfig>;
    return {
      endpoint: String(parsed.endpoint || ''),
      username: String(parsed.username || ''),
      password: readWebdavPasswordFromSession() || String(parsed.password || ''),
      remoteFilePath: String(parsed.remoteFilePath || 'ledgerflow/backup.json'),
      proxyEnabled: parsed.proxyEnabled !== false,
      proxyBasePath: String(parsed.proxyBasePath || '/api/webdav')
    };
  } catch {
    return {
      endpoint: '',
      username: '',
      password: '',
      remoteFilePath: 'ledgerflow/backup.json',
      proxyEnabled: true,
      proxyBasePath: '/api/webdav'
    };
  }
}

function joinWebdavPath(config: BackupWebdavConfig, remoteFilePath: string): string {
  const path = remoteFilePath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (config.proxyEnabled) {
    const proxyBase = config.proxyBasePath.trim().replace(/\/+$/, '') || '/api/webdav';
    return `${proxyBase}/${path}`;
  }

  const base = config.endpoint.trim().replace(/\/+$/, '');
  return `${base}/${path}`;
}

function buildWebdavHeaders(
  config: BackupWebdavConfig,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: buildBasicAuth(config.username, config.password),
    ...extra
  };

  if (config.proxyEnabled) {
    headers['X-WebDAV-Endpoint'] = config.endpoint.trim();
  }

  return headers;
}

function normalizeWebdavError(action: '上传' | '下载' | '创建目录', error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      return new Error(
        `WebDAV ${action}失败：请求被浏览器拦截（常见于跨域 CORS / HTTPS 混合内容）。` +
          `可尝试将 endpoint 改为同源代理地址（例如 /api/webdav）并在服务端转发到真实 WebDAV。`
      );
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
  let current = '';
  for (const segment of folders) {
    current = current ? `${current}/${segment}` : segment;
    let response: Response;
    try {
      response = await fetch(joinWebdavPath(config, current), {
        method: 'MKCOL',
        headers: buildWebdavHeaders(config)
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
    const url = joinWebdavPath(config, config.remoteFilePath);
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildWebdavHeaders(config, {
        'Content-Type': 'application/json;charset=utf-8'
      }),
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
    const url = joinWebdavPath(config, config.remoteFilePath);
    const response = await fetch(url, {
      method: 'GET',
      headers: buildWebdavHeaders(config)
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
