import { Account } from '../../entities/account/types';
import { Category } from '../../entities/category/types';
import {
  SubscriptionBillingCycle,
  SubscriptionItem,
  SubscriptionKind,
  SubscriptionStatus
} from '../../entities/subscription/types';
import {
  BalanceChangeEntry,
  TransactionAttachmentItem,
  TransactionItem
} from '../../entities/transaction/types';
import {
  GlobalMemoryItem,
  sanitizePersistedGlobalMemoryItem
} from '../store/globalMemory';
import type { FinanceDataSnapshot } from '../store/useFinanceStore';

const BACKUP_KEY = 'ledgerflow-backup-webdav-v1';
const BACKUP_PASSWORD_SESSION_KEY = 'ledgerflow-backup-webdav-password';

export interface BackupWebdavConfig {
  /** 真实 WebDAV 服务地址，例如：https://dav.example.com/remote.php/dav/files/user */
  endpoint: string;
  username: string;
  password: string;
  remoteFilePath: string;
  /** 最多保留多少个版本化备份 */
  retainedVersions: number;
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

function normalizeRetainedVersions(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 5;
  }
  return Math.min(50, Math.max(1, Math.round(numeric)));
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
    retainedVersions: normalizeRetainedVersions(config.retainedVersions),
    proxyEnabled: Boolean(config.proxyEnabled),
    proxyBasePath: config.proxyEnabled
      ? normalizeProxyBasePath(config.proxyBasePath)
      : '/api/webdav'
  };
}

export interface FinanceBackupPayload {
  version: number;
  exportedAt: string;
  data: FinanceDataSnapshot & {
    globalMemories: GlobalMemoryItem[];
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
const TRANSACTION_ADJUSTMENT_KINDS = new Set<NonNullable<TransactionItem['adjustmentKind']>>([
  'normal',
  'refund',
  'reversal'
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

const SUBSCRIPTION_KINDS = new Set<SubscriptionKind>(['digital', 'mobile', 'membership', 'other']);
const SUBSCRIPTION_BILLING_CYCLES = new Set<SubscriptionBillingCycle>([
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
  'custom'
]);
const SUBSCRIPTION_STATUS = new Set<SubscriptionStatus>(['active', 'due-soon', 'expired', 'paused']);
const BALANCE_CHANGE_TYPES = new Set<BalanceChangeEntry['type']>([
  'transaction-income',
  'transaction-expense',
  'transaction-budget',
  'transaction-repayment',
  'transaction-refund',
  'manual-adjustment'
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

function validateSubscriptionItem(item: unknown, index: number): SubscriptionItem {
  if (!isObjectRecord(item)) {
    throw new Error(`备份文件字段无效：data.subscriptions[${index}] 应为对象`);
  }

  assertString(item.id, `data.subscriptions[${index}].id`);
  assertString(item.name, `data.subscriptions[${index}].name`);
  assertNumber(item.amount, `data.subscriptions[${index}].amount`);
  assertString(item.currency, `data.subscriptions[${index}].currency`);
  assertString(item.createdAt, `data.subscriptions[${index}].createdAt`);
  assertString(item.updatedAt, `data.subscriptions[${index}].updatedAt`);
  assertString(item.accountId, `data.subscriptions[${index}].accountId`, { required: false });
  assertString(item.provider, `data.subscriptions[${index}].provider`, { required: false });
  assertString(item.note, `data.subscriptions[${index}].note`, { required: false });
  assertDateString(item.renewalDate, `data.subscriptions[${index}].renewalDate`, { required: false });
  assertDateString(item.expireDate, `data.subscriptions[${index}].expireDate`, { required: false });
  assertDateString(item.lastGeneratedAt, `data.subscriptions[${index}].lastGeneratedAt`, {
    required: false
  });
  assertString(item.lastGeneratedTransactionId, `data.subscriptions[${index}].lastGeneratedTransactionId`, {
    required: false
  });
  assertDateString(item.trashedAt, `data.subscriptions[${index}].trashedAt`, { required: false });

  if (
    typeof item.kind !== 'string' ||
    !SUBSCRIPTION_KINDS.has(item.kind as SubscriptionKind)
  ) {
    throw new Error(`备份文件字段无效：data.subscriptions[${index}].kind 枚举值不合法`);
  }

  if (
    typeof item.billingCycle !== 'string' ||
    !SUBSCRIPTION_BILLING_CYCLES.has(item.billingCycle as SubscriptionBillingCycle)
  ) {
    throw new Error(`备份文件字段无效：data.subscriptions[${index}].billingCycle 枚举值不合法`);
  }

  if (
    typeof item.status !== 'string' ||
    !SUBSCRIPTION_STATUS.has(item.status as SubscriptionStatus)
  ) {
    throw new Error(`备份文件字段无效：data.subscriptions[${index}].status 枚举值不合法`);
  }

  if (item.customCycleDays !== undefined) {
    assertNumber(item.customCycleDays, `data.subscriptions[${index}].customCycleDays`);
  }

  if (item.autoRenew !== undefined && typeof item.autoRenew !== 'boolean') {
    throw new Error(`备份文件字段无效：data.subscriptions[${index}].autoRenew 应为布尔值`);
  }

  return {
    id: asSafeString(item.id),
    name: asSafeString(item.name),
    kind: item.kind as SubscriptionKind,
    amount: Number(item.amount),
    currency: asSafeString(item.currency),
    billingCycle: item.billingCycle as SubscriptionBillingCycle,
    customCycleDays:
      typeof item.customCycleDays === 'number' ? Number(item.customCycleDays) : undefined,
    accountId: asSafeString(item.accountId) || undefined,
    provider: asSafeString(item.provider) || undefined,
    note: asSafeString(item.note) || undefined,
    renewalDate: asSafeString(item.renewalDate) || undefined,
    expireDate: asSafeString(item.expireDate) || undefined,
    autoRenew: typeof item.autoRenew === 'boolean' ? item.autoRenew : undefined,
    status: item.status as SubscriptionStatus,
    lastGeneratedAt: asSafeString(item.lastGeneratedAt) || undefined,
    lastGeneratedTransactionId: asSafeString(item.lastGeneratedTransactionId) || undefined,
    trashedAt: asSafeString(item.trashedAt) || undefined,
    createdAt: asSafeString(item.createdAt),
    updatedAt: asSafeString(item.updatedAt)
  };
}

export function createFinanceBackupPayload(input: {
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  subscriptions?: SubscriptionItem[];
  globalMemories?: GlobalMemoryItem[];
}): FinanceBackupPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      transactions: input.transactions,
      categories: input.categories,
      accounts: input.accounts,
      subscriptions: Array.isArray(input.subscriptions) ? input.subscriptions : [],
      globalMemories: Array.isArray(input.globalMemories) ? input.globalMemories : []
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

  if (data.subscriptions !== undefined && !Array.isArray(data.subscriptions)) {
    throw new Error('备份文件字段无效：data.subscriptions 应为数组');
  }

  if (data.globalMemories !== undefined && !Array.isArray(data.globalMemories)) {
    throw new Error('备份文件字段无效：data.globalMemories 应为数组');
  }

  const transactions = data.transactions.map((item, index) => validateTransactionItem(item, index));
  const categories = data.categories.map((item, index) => validateCategoryItem(item, index));
  const accounts = data.accounts.map((item, index) => validateAccountItem(item, index));
  const subscriptions = (Array.isArray(data.subscriptions) ? data.subscriptions : []).map((item, index) =>
    validateSubscriptionItem(item, index)
  );
  const globalMemories = (Array.isArray(data.globalMemories) ? data.globalMemories : [])
    .map((item, index) => sanitizePersistedGlobalMemoryItem(item, index))
    .filter((item): item is GlobalMemoryItem => Boolean(item));

  return {
    version:
      typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? parsed.version : 1,
    exportedAt:
      typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    data: {
      transactions,
      categories,
      accounts,
      subscriptions,
      globalMemories
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
        retainedVersions: 5,
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
      retainedVersions: Number(parsed.retainedVersions || 5),
      proxyEnabled: parsed.proxyEnabled !== false,
      proxyBasePath: String(parsed.proxyBasePath || '/api/webdav')
    });
  } catch {
    return {
      endpoint: '',
      username: '',
      password: '',
      remoteFilePath: 'ledgerflow/backup.json',
      retainedVersions: 5,
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

async function ensureWebdavDirectoriesByPath(
  config: BackupWebdavConfig,
  remoteFilePath: string
): Promise<void> {
  const normalizedPath = remoteFilePath.replace(/^\/+/, '').split('/').filter(Boolean);
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

    if (![200, 201, 204, 301, 302, 400, 403, 405, 409].includes(response.status)) {
      throw new Error(`WebDAV 目录创建失败（${current}，HTTP ${response.status}）`);
    }
  }
}

function buildVersionedBackupPath(remoteFilePath: string, exportedAt: string): string {
  const normalizedPath = normalizeRemoteFilePath(remoteFilePath);
  const parts = normalizedPath.split('/');
  const fileName = parts.pop() || 'backup.json';
  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '.json';
  const stamp = exportedAt.slice(0, 19).replace(/:/g, '-').replace('T', '_');
  return [...parts, `${baseName}-${stamp}${ext}`].join('/');
}

function splitRemoteDirAndFile(remoteFilePath: string): { dir: string; file: string } {
  const normalizedPath = normalizeRemoteFilePath(remoteFilePath);
  const parts = normalizedPath.split('/');
  const file = parts.pop() || normalizedPath;
  return { dir: parts.join('/'), file };
}

function buildBackupFileMatchers(remoteFilePath: string): { targetFile: string; versionedPattern: RegExp } {
  const { file: targetFile } = splitRemoteDirAndFile(remoteFilePath);
  const dotIndex = targetFile.lastIndexOf('.');
  const baseName = dotIndex > 0 ? targetFile.slice(0, dotIndex) : targetFile;
  const ext = dotIndex > 0 ? targetFile.slice(dotIndex) : '.json';
  return {
    targetFile,
    versionedPattern: new RegExp(
      `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
    )
  };
}

function isBackupCandidateMatch(candidatePath: string, remoteFilePath: string): boolean {
  const candidate = normalizeRemoteFilePath(candidatePath);
  const target = normalizeRemoteFilePath(remoteFilePath);
  const candidateParts = candidate.split('/');
  const targetParts = target.split('/');
  const candidateFile = candidateParts.pop() || '';
  const targetFile = targetParts.pop() || '';
  const { versionedPattern } = buildBackupFileMatchers(remoteFilePath);

  if (candidateParts.join('/') === targetParts.join('/')) {
    if (candidateFile === targetFile) {
      return true;
    }
    if (versionedPattern.test(candidateFile)) {
      return true;
    }
  }

  return candidateFile === targetFile || versionedPattern.test(candidateFile);
}

function isVersionedBackupMatch(candidatePath: string, remoteFilePath: string): boolean {
  const candidate = normalizeRemoteFilePath(candidatePath);
  const candidateFile = candidate.split('/').pop() || '';
  const { targetFile, versionedPattern } = buildBackupFileMatchers(remoteFilePath);
  if (candidateFile === targetFile) {
    return false;
  }
  return versionedPattern.test(candidateFile);
}

function extractHrefText(value: string): string {
  return value.replace(/&amp;/g, '&').trim();
}

function resolveRemotePathFromHref(
  href: string,
  endpoint: string,
  remoteFilePath: string
): string {
  const parsed = new URL(href, endpoint);
  const endpointUrl = new URL(endpoint);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const endpointPath = decodeURIComponent(endpointUrl.pathname).replace(/\/+$/, '');

  if (decodedPath.startsWith(`${endpointPath}/`)) {
    return normalizeRemoteFilePath(decodedPath.slice(endpointPath.length + 1));
  }

  const { dir } = splitRemoteDirAndFile(remoteFilePath);
  const dirSegments = dir ? dir.split('/') : [];
  const pathSegments = decodedPath.split('/').filter(Boolean);
  const startIndex = dirSegments.length > 0 ? pathSegments.lastIndexOf(dirSegments[0]) : -1;

  if (startIndex >= 0) {
    return normalizeRemoteFilePath(pathSegments.slice(startIndex).join('/'));
  }

  return normalizeRemoteFilePath(pathSegments.slice(-((dir ? dirSegments.length : 0) + 1)).join('/'));
}

function extractVersionedBackupPathsFromXml(text: string, remoteFilePath: string): string[] {
  const { dir } = splitRemoteDirAndFile(remoteFilePath);
  const normalizedDir = normalizeRemoteFilePath(dir);
  const { targetFile, versionedPattern } = buildBackupFileMatchers(remoteFilePath);
  const candidates = Array.from(new Set(text.match(/[^\s<>"']+/g) || []))
    .map((item) => extractHrefText(item))
    .map((item) => {
      try {
        return decodeURIComponent(item);
      } catch {
        return item;
      }
    });

  const matched = candidates
    .map((item) => item.split('?')[0].split('#')[0])
    .map((item) => item.replace(/^.*\//, ''))
    .filter((fileName) => fileName === targetFile || versionedPattern.test(fileName))
    .map((fileName) => (normalizedDir ? `${normalizedDir}/${fileName}` : fileName));

  return Array.from(new Set(matched));
}

async function listWebdavRemoteFiles(config: BackupWebdavConfig, remoteFilePath: string): Promise<string[]> {
  const sanitized = sanitizeWebdavConfig(config);
  const { dir } = splitRemoteDirAndFile(remoteFilePath);
  const listTarget = dir || remoteFilePath;
  const response = await fetch(joinWebdavPath(sanitized, listTarget), {
    method: 'PROPFIND',
    headers: buildWebdavHeaders(sanitized, {
      Depth: '1'
    })
  });

  if (!response.ok) {
    throw new Error(`WebDAV 列目录失败（HTTP ${response.status}）`);
  }

  const text = await response.text();
  const matches = Array.from(text.matchAll(/<d:href>(.*?)<\/d:href>|<href>(.*?)<\/href>/g));
  const paths = matches
    .map((match) => extractHrefText(match[1] || match[2] || ''))
    .map((href) => {
      try {
        return resolveRemotePathFromHref(href, sanitized.endpoint, remoteFilePath);
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  const fallbackPaths = extractVersionedBackupPathsFromXml(text, remoteFilePath);
  return Array.from(new Set([...paths, ...fallbackPaths]));
}

async function deleteWebdavFile(config: BackupWebdavConfig, remoteFilePath: string): Promise<void> {
  const sanitized = sanitizeWebdavConfig(config);
  const response = await fetch(joinWebdavPath(sanitized, remoteFilePath), {
    method: 'DELETE',
    headers: buildWebdavHeaders(sanitized)
  });
  if (![200, 202, 204, 404].includes(response.status)) {
    throw new Error(`WebDAV 删除失败（${remoteFilePath}，HTTP ${response.status}）`);
  }
}

async function pruneWebdavBackupVersions(config: BackupWebdavConfig): Promise<void> {
  const sanitized = sanitizeWebdavConfig(config);
  const files = await listWebdavRemoteFiles(sanitized, sanitized.remoteFilePath);
  const matched = files
    .filter((item) => isVersionedBackupMatch(item, sanitized.remoteFilePath))
    .sort((a, b) => b.localeCompare(a, 'en'));
  const obsolete = matched.slice(sanitized.retainedVersions);
  await Promise.all(obsolete.map((item) => deleteWebdavFile(sanitized, item)));
}

export interface WebdavBackupVersionItem {
  remotePath: string;
  fileName: string;
  label: string;
  isLatest: boolean;
}

function buildWebdavBackupVersionLabel(remotePath: string, baseRemoteFilePath: string): string {
  const normalized = normalizeRemoteFilePath(remotePath);
  const { file: targetFile } = splitRemoteDirAndFile(baseRemoteFilePath);
  const fileName = normalized.split('/').pop() || normalized;
  const dotIndex = targetFile.lastIndexOf('.');
  const baseName = dotIndex > 0 ? targetFile.slice(0, dotIndex) : targetFile;
  const stamp = fileName
    .replace(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-`), '')
    .replace(/\.json$/i, '');
  const matched = stamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return fileName;
  }
  return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

function extractWebdavBackupVersionTimeLabel(remotePath: string, baseRemoteFilePath: string): string | null {
  const normalized = normalizeRemoteFilePath(remotePath);
  const { file: targetFile } = splitRemoteDirAndFile(baseRemoteFilePath);
  const fileName = normalized.split('/').pop() || normalized;
  const dotIndex = targetFile.lastIndexOf('.');
  const baseName = dotIndex > 0 ? targetFile.slice(0, dotIndex) : targetFile;
  const stamp = fileName
    .replace(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-`), '')
    .replace(/\.json$/i, '');
  const matched = stamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }
  return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

export async function listWebdavBackupVersions(
  config: BackupWebdavConfig
): Promise<WebdavBackupVersionItem[]> {
  const sanitized = sanitizeWebdavConfig(config);
  try {
    const files = await listWebdavRemoteFiles(sanitized, sanitized.remoteFilePath);
    const matched = files
      .filter((item) => isBackupCandidateMatch(item, sanitized.remoteFilePath))
      .sort((a, b) => b.localeCompare(a, 'en'));

    if (matched.length === 0) {
      return [
        {
          remotePath: sanitized.remoteFilePath,
          fileName: splitRemoteDirAndFile(sanitized.remoteFilePath).file,
          label: '当前固定备份文件',
          isLatest: true
        }
      ];
    }

    const latestVersioned = matched.find((item) => isVersionedBackupMatch(item, sanitized.remoteFilePath));
    const latestVersionedLabel = latestVersioned
      ? extractWebdavBackupVersionTimeLabel(latestVersioned, sanitized.remoteFilePath)
      : null;

    return matched.map((item, index) => {
      const fileName = item.split('/').pop() || item;
      const isFixedEntry = normalizeRemoteFilePath(item) === sanitized.remoteFilePath;
      return {
        remotePath: item,
        fileName,
        label: isFixedEntry
          ? latestVersionedLabel
            ? `${latestVersionedLabel} · 固定入口`
            : '当前固定备份文件'
          : buildWebdavBackupVersionLabel(item, sanitized.remoteFilePath),
        isLatest: index === 0
      };
    });
  } catch {
    return [
      {
        remotePath: sanitized.remoteFilePath,
        fileName: splitRemoteDirAndFile(sanitized.remoteFilePath).file,
        label: '当前固定备份文件（目录列表不可用）',
        isLatest: true
      }
    ];
  }
}

async function resolveLatestWebdavBackupPath(config: BackupWebdavConfig): Promise<string> {
  const sanitized = sanitizeWebdavConfig(config);
  try {
    const files = await listWebdavRemoteFiles(sanitized, sanitized.remoteFilePath);
    const matched = files
      .filter((item) => isVersionedBackupMatch(item, sanitized.remoteFilePath))
      .sort((a, b) => b.localeCompare(a, 'en'));
    if (matched.length > 0) {
      return matched[0];
    }
  } catch {
    // 某些 WebDAV / 代理不支持 PROPFIND，回退到固定路径下载。
  }
  return sanitized.remoteFilePath;
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
  payload: FinanceBackupPayload,
  onProgress?: (stage: string) => void
): Promise<void> {
  try {
    const sanitized = sanitizeWebdavConfig(config);
    onProgress?.('准备 WebDAV 备份...');
    const versionedRemotePath = buildVersionedBackupPath(sanitized.remoteFilePath, payload.exportedAt);
    const latestRemotePath = sanitized.remoteFilePath;
    await ensureWebdavDirectoriesByPath(sanitized, versionedRemotePath);
    const body = JSON.stringify(payload, null, 2);
    const versionedUrl = joinWebdavPath(sanitized, versionedRemotePath);
    onProgress?.('上传版本备份...');
    const response = await fetch(versionedUrl, {
      method: 'PUT',
      headers: buildWebdavHeaders(sanitized, {
        'Content-Type': 'application/json;charset=utf-8'
      }),
      body
    });

    if (!response.ok) {
      throw new Error(`WebDAV 上传失败（HTTP ${response.status}）`);
    }

    if (latestRemotePath !== versionedRemotePath) {
      await ensureWebdavDirectoriesByPath(sanitized, latestRemotePath);
      const latestUrl = joinWebdavPath(sanitized, latestRemotePath);
      onProgress?.('更新最新版本...');
      const latestResponse = await fetch(latestUrl, {
        method: 'PUT',
        headers: buildWebdavHeaders(sanitized, {
          'Content-Type': 'application/json;charset=utf-8'
        }),
        body
      });

      if (!latestResponse.ok) {
        throw new Error(`WebDAV 上传失败（HTTP ${latestResponse.status}）`);
      }
    }

    try {
      onProgress?.('清理旧版本...');
      await pruneWebdavBackupVersions(sanitized);
    } catch {
      // 版本清理失败不阻断主上传成功，避免代理 / WebDAV 实现差异导致上传整体失败。
    }
  } catch (error) {
    throw normalizeWebdavError('上传', error);
  }
}

export async function webdavUploadFile(
  config: BackupWebdavConfig,
  remoteFilePath: string,
  file: Blob,
  contentType?: string
): Promise<{ remotePath: string }> {
  try {
    const sanitized = sanitizeWebdavConfig(config);
    const normalizedRemotePath = normalizeRemoteFilePath(remoteFilePath);
    await ensureWebdavDirectoriesByPath(sanitized, normalizedRemotePath);
    const url = joinWebdavPath(sanitized, normalizedRemotePath);
    const response = await fetch(url, {
      method: 'PUT',
      headers: buildWebdavHeaders(sanitized, {
        'Content-Type': contentType || 'application/octet-stream'
      }),
      body: file
    });

    if (!response.ok) {
      throw new Error(`WebDAV 上传失败（HTTP ${response.status}）`);
    }

    return { remotePath: normalizedRemotePath };
  } catch (error) {
    throw normalizeWebdavError('上传', error);
  }
}

export async function webdavDownloadBackup(
  config: BackupWebdavConfig,
  remotePath?: string
): Promise<FinanceBackupPayload> {
  try {
    const sanitized = sanitizeWebdavConfig(config);
    const resolvedRemotePath = remotePath
      ? normalizeRemoteFilePath(remotePath)
      : await resolveLatestWebdavBackupPath(sanitized);
    const url = joinWebdavPath(sanitized, resolvedRemotePath);
    const response = await fetch(url, {
      method: 'GET',
      headers: buildWebdavHeaders(sanitized)
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
