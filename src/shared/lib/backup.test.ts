import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadWebdavConfig,
  parseFinanceBackupPayload,
  sanitizeWebdavConfig,
  saveWebdavConfig,
  webdavUploadFile,
  type BackupWebdavConfig
} from './backup';

const BACKUP_KEY = 'ledgerflow-backup-webdav-v1';
const BACKUP_PASSWORD_SESSION_KEY = 'ledgerflow-backup-webdav-password';

const baseConfig: BackupWebdavConfig = {
  endpoint: 'https://dav.example.com/remote.php/dav/files/user',
  username: 'alice',
  password: 'secret',
  remoteFilePath: '账本备份/2026 02 backup.json',
  retainedVersions: 3,
  proxyEnabled: true,
  proxyBasePath: '/api/webdav'
};

beforeEach(() => {
  localStorage.removeItem(BACKUP_KEY);
  sessionStorage.removeItem(BACKUP_PASSWORD_SESSION_KEY);
});

describe('parseFinanceBackupPayload', () => {
  it('支持带 UTF-8 BOM 的 JSON 备份', () => {
    const payload = parseFinanceBackupPayload(
      '\uFEFF{\n"version":1,"data":{"transactions":[],"categories":[],"accounts":[]}}'
    );

    expect(payload.version).toBe(1);
    expect(payload.data.transactions).toEqual([]);
  });

  it('当交易字段类型错误时应拒绝导入', () => {
    expect(() =>
      parseFinanceBackupPayload(
        JSON.stringify({
          version: 1,
          data: {
            transactions: [
              {
                id: 'tx-1',
                type: 'expense',
                categoryId: 'cat-1',
                accountId: 'acc-1',
                amount: '88.8',
                date: '2026-02-10',
                note: '午餐',
                tags: ['餐饮']
              }
            ],
            categories: [],
            accounts: []
          }
        })
      )
    ).toThrow('data.transactions[0].amount 应为有限数字');
  });

  it('当枚举字段不合法时应拒绝导入', () => {
    expect(() =>
      parseFinanceBackupPayload(
        JSON.stringify({
          version: 1,
          data: {
            transactions: [
              {
                id: 'tx-1',
                type: 'oops',
                categoryId: 'cat-1',
                accountId: 'acc-1',
                amount: 88.8,
                date: '2026-02-10',
                note: '午餐',
                tags: ['餐饮']
              }
            ],
            categories: [],
            accounts: []
          }
        })
      )
    ).toThrow('data.transactions[0].type 枚举值不合法');
  });

  it('当分类与账户字段类型合法时可正常通过并归一化', () => {
    const payload = parseFinanceBackupPayload(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-02-26T10:00:00.000Z',
        data: {
          transactions: [
            {
              id: 'tx-1',
              type: 'expense',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 88.8,
              date: '2026-02-10',
              note: '午餐',
              tags: ['餐饮', '  工作日  '],
              source: 'manual',
              status: 'completed'
            }
          ],
          categories: [{ id: 'cat-1', name: ' 餐饮 ', kind: 'expense', sortOrder: 1 }],
          accounts: [{ id: 'acc-1', name: ' 招商银行卡 ', type: 'debit', balance: 1000 }]
        }
      })
    );

    expect(payload.data.transactions[0].tags).toEqual(['餐饮', '工作日']);
    expect(payload.data.categories[0].name).toBe('餐饮');
    expect(payload.data.accounts[0].name).toBe('招商银行卡');
  });
});

describe('webdav config storage hardening', () => {
  it('should not persist WebDAV password in localStorage', () => {
    saveWebdavConfig(baseConfig);

    const persisted = localStorage.getItem(BACKUP_KEY) || '';
    expect(persisted).not.toContain(baseConfig.password);
    expect(persisted).toContain('"password":""');

    expect(sessionStorage.getItem(BACKUP_PASSWORD_SESSION_KEY)).toBe(baseConfig.password);
  });

  it('should restore password from sessionStorage when loading config', () => {
    saveWebdavConfig(baseConfig);

    const loaded = loadWebdavConfig();
    expect(loaded.password).toBe(baseConfig.password);
  });
});

describe('sanitizeWebdavConfig', () => {
  it('仅允许 HTTPS 且拒绝本地/内网地址', () => {
    expect(() =>
      sanitizeWebdavConfig({
        ...baseConfig,
        endpoint: 'http://dav.example.com/remote.php/dav/files/user'
      })
    ).toThrow('WebDAV 地址仅支持 HTTPS 协议');

    expect(() =>
      sanitizeWebdavConfig({
        ...baseConfig,
        endpoint: 'https://127.0.0.1/remote.php/dav/files/user'
      })
    ).toThrow('WebDAV 地址不允许使用本地或内网地址');
  });

  it('应规范化代理路径与远程文件路径', () => {
    const sanitized = sanitizeWebdavConfig({
      ...baseConfig,
      proxyBasePath: '/api/webdav///',
      remoteFilePath: ' /账本备份/2026 02 backup.json/ '
    });

    expect(sanitized.proxyBasePath).toBe('/api/webdav');
    expect(sanitized.remoteFilePath).toBe('账本备份/2026 02 backup.json');
    expect(sanitized.retainedVersions).toBe(3);
  });

  it('远程文件路径包含空段时应拒绝', () => {
    expect(() =>
      sanitizeWebdavConfig({
        ...baseConfig,
        remoteFilePath: '账本备份//2026 02 backup.json'
      })
    ).toThrow('远程文件路径不合法，请避免使用空段或 . / ..');
  });
});

describe('webdavUploadFile', () => {
  it('附件上传时即使目录预创建返回 400，只要最终 PUT 成功也应视为成功', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, status: 201 });

    vi.stubGlobal('fetch', fetchMock);

    const file = new Blob(['hello'], { type: 'text/plain' });
    const result = await webdavUploadFile(
      baseConfig,
      '账本备份/attachments/tx-1/test file.txt',
      file,
      'text/plain'
    );

    expect(result.remotePath).toBe('账本备份/attachments/tx-1/test file.txt');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      '/api/webdav/%E8%B4%A6%E6%9C%AC%E5%A4%87%E4%BB%BD/attachments/tx-1/test%20file.txt'
    );

    vi.unstubAllGlobals();
  });
});
