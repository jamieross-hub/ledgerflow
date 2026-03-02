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

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
  [0x00000000, 0x00ffffff] // 0.0.0.0/8
];

function ipv4ToInt(hostname: string): number | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((item) => Number(item));
  if (nums.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    return null;
  }
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  const ipv4 = ipv4ToInt(lower);
  if (ipv4 === null) return false;
  return PRIVATE_IPV4_RANGES.some(([start, end]) => ipv4 >= start && ipv4 <= end);
}

function normalizeProxyBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error('已启用同源代理，请填写代理入口路径');
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('代理入口路径必须以 / 开头，例如 /api/webdav');
  }
  if (trimmed.startsWith('//') || trimmed.includes('://')) {
    throw new Error('代理入口路径仅允许同源相对路径，例如 /api/webdav');
  }
  return trimmed.replace(/\/+$/, '') || '/api/webdav';
}

function normalizeWebdavEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error('请填写 WebDAV 地址');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('WebDAV 地址格式无效，请使用完整 HTTPS URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('WebDAV 地址仅支持 HTTPS 协议');
  }

  if (parsed.username || parsed.password) {
    throw new Error('WebDAV 地址中不应包含用户名或密码');
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    throw new Error('WebDAV 地址不允许使用本地或内网地址');
  }

  return parsed.toString().replace(/\/$/, '');
}

function normalizeRemoteFilePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('请填写远程文件路径');
  }

  const segments = trimmed.split('/').map((item) => item.trim());
  if (segments.some((item) => !item || item === '.' || item === '..')) {
    throw new Error('远程文件路径不合法，请避免使用空段或 . / ..');
  }

  return segments.join('/');
}

export function sanitizeWebdavConfig(config: BackupWebdavConfig): BackupWebdavConfig {
  const endpoint = normalizeWebdavEndpoint(config.endpoint);
  const remoteFilePath = normalizeRemoteFilePath(config.remoteFilePath);

  return {
    ...config,
    endpoint,
    username: config.username.trim(),
    password: config.password,
    remoteFilePath,
    proxyEnabled: Boolean(config.proxyEnabled),
    proxyBasePath: config.proxyEnabled
      ? normalizeProxyBasePath(config.proxyBasePath)
      : '/api/webdav'
  };
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

const TRANSACTION_TYPES = new Set<TransactionItem['type']>([
  'expense',
  'income',
  'budget',
  'repayment'
]);
const TRANSACTION_SOURCES = new Set<NonNullable<TransactionItem['source']>>([
  'manual',
  'wechat',
  'alipay',
  'ai'
]);
const TRANSACTION_STATUS = new Set<NonNullable<TransactionItem['status']>>([
  'pending',
  'completed',
  'refunded',
  'closed',
  'failed'
]);
const CATEGORY_KINDS = new Set<NonNullable<Category['kind']>>(['income', 'expense']);
const ACCOUNT_TYPES = new Set<NonNullable<Account['type']>>([
  'cash',
  'debit',
  'savings',
  'credit',
  'virtual',
  'liability',
  'receivable'
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assertString(
  value: unknown,
  path: string,
  { required = true }: { required?: boolean } = {}
) {
  if (typeof value === 'string') {
    return;
  }
  if (!required && (value === undefined || value === null)) {
    return;
  }
  throw new Error(`备份文件字段无效：${path} 应为字符串`);
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return;
  }
  throw new Error(`备份文件字段无效：${path} 应为有限数字`);
}

function assertDateString(
  value: unknown,
  path: string,
  { required = true }: { required?: boolean } = {}
) {
  if (!required && (value === undefined || value === null)) {
    return;
  }
  assertString(value, path, { required });
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) {
    throw new Error(`备份文件字段无效：${path} 应为日期字符串（YYYY-MM-DD）`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`备份文件字段无效：${path} 应为字符串数组`);
  }
}

function validateTransactionItem(item: unknown, index: number): TransactionItem {
  if (!isObjectRecord(item)) {
    throw new Error(`备份文件字段无效：data.transactions[${index}] 应为对象`);
  }

  assertString(item.id, `data.transactions[${index}].id`);
  assertString(item.categoryId, `data.transactions[${index}].categoryId`);
  assertString(item.accountId, `data.transactions[${index}].accountId`);
  assertString(item.note, `data.transactions[${index}].note`);
  assertDateString(item.date, `data.transactions[${index}].date`);
  assertNumber(item.amount, `data.transactions[${index}].amount`);
  assertStringArray(item.tags, `data.transactions[${index}].tags`);

  if (
    typeof item.type !== 'string' ||
    !TRANSACTION_TYPES.has(item.type as TransactionItem['type'])
  ) {
    throw new Error(`备份文件字段无效：data.transactions[${index}].type 枚举值不合法`);
  }

  if (
    item.source !== undefined &&
    (typeof item.source !== 'string' ||
      !TRANSACTION_SOURCES.has(item.source as NonNullable<TransactionItem['source']>))
  ) {
    throw new Error(`备份文件字段无效：data.transactions[${index}].source 枚举值不合法`);
  }

  if (
    item.status !== undefined &&
    (typeof item.status !== 'string' ||
      !TRANSACTION_STATUS.has(item.status as NonNullable<TransactionItem['status']>))
  ) {
    throw new Error(`备份文件字段无效：data.transactions[${index}].status 枚举值不合法`);
  }

  assertString(item.orderNo, `data.transactions[${index}].orderNo`, { required: false });
  assertString(item.merchantOrderNo, `data.transactions[${index}].merchantOrderNo`, {
    required: false
  });

  return {
    id: asSafeString(item.id),
    type: item.type as TransactionItem['type'],
    categoryId: asSafeString(item.categoryId),
    accountId: asSafeString(item.accountId),
    amount: Number(item.amount),
    date: asSafeString(item.date),
    note: asSafeString(item.note),
    tags: (item.tags as string[]).map((tag) => tag.trim()).filter(Boolean),
    source: item.source as TransactionItem['source'] | undefined,
    orderNo: asSafeString(item.orderNo) || undefined,
    merchantOrderNo: asSafeString(item.merchantOrderNo) || undefined,
    status: item.status as TransactionItem['status'] | undefined
  };
}

function validateCategoryItem(item: unknown, index: number): Category {
  if (!isObjectRecord(item)) {
    throw new Error(`备份文件字段无效：data.categories[${index}] 应为对象`);
  }

  assertString(item.id, `data.categories[${index}].id`);
  assertString(item.name, `data.categories[${index}].name`);
  assertString(item.color, `data.categories[${index}].color`, { required: false });
  assertString(item.icon, `data.categories[${index}].icon`, { required: false });

  if (item.sortOrder !== undefined) {
    assertNumber(item.sortOrder, `data.categories[${index}].sortOrder`);
  }

  if (
    item.kind !== undefined &&
    (typeof item.kind !== 'string' ||
      !CATEGORY_KINDS.has(item.kind as NonNullable<Category['kind']>))
  ) {
    throw new Error(`备份文件字段无效：data.categories[${index}].kind 枚举值不合法`);
  }

  return {
    id: asSafeString(item.id),
    name: asSafeString(item.name),
    kind: item.kind as Category['kind'] | undefined,
    color: asSafeString(item.color) || undefined,
    icon: asSafeString(item.icon) || undefined,
    sortOrder: typeof item.sortOrder === 'number' ? Number(item.sortOrder) : undefined
  };
}

function validateAccountItem(item: unknown, index: number): Account {
  if (!isObjectRecord(item)) {
    throw new Error(`备份文件字段无效：data.accounts[${index}] 应为对象`);
  }

  assertString(item.id, `data.accounts[${index}].id`);
  assertString(item.name, `data.accounts[${index}].name`);

  if (item.initialBalance !== undefined) {
    assertNumber(item.initialBalance, `data.accounts[${index}].initialBalance`);
  }
  if (item.balance !== undefined) {
    assertNumber(item.balance, `data.accounts[${index}].balance`);
  }

  if (
    item.type !== undefined &&
    (typeof item.type !== 'string' || !ACCOUNT_TYPES.has(item.type as NonNullable<Account['type']>))
  ) {
    throw new Error(`备份文件字段无效：data.accounts[${index}].type 枚举值不合法`);
  }

  return {
    id: asSafeString(item.id),
    name: asSafeString(item.name),
    type: item.type as Account['type'] | undefined,
    initialBalance:
      typeof item.initialBalance === 'number' ? Number(item.initialBalance) : undefined,
    balance: typeof item.balance === 'number' ? Number(item.balance) : undefined
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
  let parsed: unknown;

  try {
    parsed = JSON.parse(normalizedRaw);
  } catch {
    throw new Error('备份文件格式无效：JSON 解析失败');
  }

  if (!isObjectRecord(parsed)) {
    throw new Error('备份文件格式无效');
  }

  const data = parsed.data;
  if (!isObjectRecord(data)) {
    throw new Error('备份文件缺少 data 字段');
  }

  if (
    !Array.isArray(data.transactions) ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.accounts)
  ) {
    throw new Error('备份文件缺少必要数据（transactions/categories/accounts）');
  }

  const transactions = data.transactions.map((item, index) => validateTransactionItem(item, index));
  const categories = data.categories.map((item, index) => validateCategoryItem(item, index));
  const accounts = data.accounts.map((item, index) => validateAccountItem(item, index));

  return {
    version:
      typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? parsed.version : 1,
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    data: {
      transactions,
      categories,
      accounts
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
  const sanitized = sanitizeWebdavConfig(config);
  writeWebdavPasswordToSession(sanitized.password);
  window.localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({
      ...sanitized,
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
    return sanitizeWebdavConfig({
      endpoint: String(parsed.endpoint || ''),
      username: String(parsed.username || ''),
      password: readWebdavPasswordFromSession() || String(parsed.password || ''),
      remoteFilePath: String(parsed.remoteFilePath || 'ledgerflow/backup.json'),
      proxyEnabled: parsed.proxyEnabled !== false,
      proxyBasePath: String(parsed.proxyBasePath || '/api/webdav')
    });
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
  const path = normalizeRemoteFilePath(remoteFilePath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (config.proxyEnabled) {
    const proxyBase = normalizeProxyBasePath(config.proxyBasePath);
    return `${proxyBase}/${path}`;
  }

  const base = normalizeWebdavEndpoint(config.endpoint);
  return `${base}/${path}`;
}

function buildWebdavHeaders(
  config: BackupWebdavConfig,
  extra?: Record<string, string>
): Record<string, string> {
  const sanitized = sanitizeWebdavConfig(config);
  const headers: Record<string, string> = {
    Authorization: buildBasicAuth(sanitized.username, sanitized.password),
    ...extra
  };

  if (sanitized.proxyEnabled) {
    headers['X-WebDAV-Endpoint'] = sanitized.endpoint;
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
