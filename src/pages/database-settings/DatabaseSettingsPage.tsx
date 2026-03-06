import { ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  applyBillImportMode,
  BillImportMode,
  parseBillFileToTransactions
} from '../../shared/lib/billImport';
import { resolveImportDefaultAccountId } from '../../shared/lib/importAccount';
import {
  BackupWebdavConfig,
  createFinanceBackupPayload,
  downloadBackupJson,
  listWebdavBackupVersions,
  loadWebdavConfig,
  parseFinanceBackupPayload,
  saveWebdavConfig,
  WebdavBackupVersionItem,
  webdavDownloadBackup,
  webdavUploadBackup,
  sanitizeWebdavConfig
} from '../../shared/lib/backup';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { Toast, ToastVariant } from '../../shared/ui/Toast';

type BillSource = 'wechat' | 'alipay';

const MAX_BACKUP_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_BILL_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const BACKUP_ACCEPTED_MIME_TYPES = new Set(['application/json', 'text/json']);
const BILL_ACCEPTED_EXTENSIONS = new Set(['.csv', '.txt', '.xlsx']);

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  if (index < 0) return '';
  return fileName.slice(index).toLowerCase();
}

function validateBackupFile(file: File): void {
  const ext = getFileExtension(file.name);
  const hasValidMime = !file.type || BACKUP_ACCEPTED_MIME_TYPES.has(file.type);
  const hasValidExt = ext === '.json';

  if (!hasValidMime && !hasValidExt) {
    throw new Error('备份导入失败：仅支持 JSON 文件（.json）');
  }

  if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
    throw new Error('备份导入失败：文件过大，请上传不超过 5MB 的 JSON 备份');
  }
}

function validateBillFile(file: File): void {
  const ext = getFileExtension(file.name);
  if (!BILL_ACCEPTED_EXTENSIONS.has(ext)) {
    throw new Error('账单导入失败：仅支持 CSV/TXT/XLSX 文件');
  }

  if (file.size > MAX_BILL_FILE_SIZE_BYTES) {
    throw new Error('账单导入失败：文件过大，请上传不超过 10MB 的账单文件');
  }
}

export function DatabaseSettingsPage() {
  const hasHydrated = useFinanceStore((s) => s.hasHydrated);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const replaceAllData = useFinanceStore((s) => s.replaceAllData);
  const clearAllAccountBills = useFinanceStore((s) => s.clearAllAccountBills);

  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const billInputRef = useRef<HTMLInputElement | null>(null);

  const [importSource, setImportSource] = useState<BillSource | null>(null);
  const [importMode, setImportMode] = useState<BillImportMode>('incremental');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string }>({
    visible: false,
    variant: 'success',
    message: ''
  });

  const [webdav, setWebdav] = useState<BackupWebdavConfig>(() => loadWebdavConfig());
  const [clearBillsOpen, setClearBillsOpen] = useState(false);
  const [webdavRestoreDialogOpen, setWebdavRestoreDialogOpen] = useState(false);
  const [webdavRestoreVersions, setWebdavRestoreVersions] = useState<WebdavBackupVersionItem[]>([]);
  const [selectedRestorePath, setSelectedRestorePath] = useState('');

  const totalRows = useMemo(
    () => transactions.length + categories.length + accounts.length,
    [transactions.length, categories.length, accounts.length]
  );

  const showToast = (message: string, variant: ToastVariant) => {
    setToast({ visible: true, message, variant });
  };

  const ensureDefaultRefs = (source?: BillSource) => {
    const categoryId = categories[0]?.id || addCategory('默认分类');
    const fallbackAccountId = accounts[0]?.id || addAccount('默认账户', undefined, 0);
    const accountId = source
      ? resolveImportDefaultAccountId(accounts, source, fallbackAccountId)
      : fallbackAccountId;
    return { categoryId, accountId };
  };

  const handleExportJson = () => {
    const payload = createFinanceBackupPayload({ transactions, categories, accounts });
    downloadBackupJson(payload);
    showToast('备份导出成功（JSON）', 'success');
  };

  const handleBackupFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      validateBackupFile(file);
      ensureHydrated();
      const text = await file.text();
      const payload = parseFinanceBackupPayload(text);
      replaceAllData(payload.data);
      showToast(
        `备份导入成功：交易 ${payload.data.transactions.length} 条，分类 ${payload.data.categories.length} 条，账户 ${payload.data.accounts.length} 条。`,
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : '备份导入失败', 'error');
    }
  };

  const handleImportBillFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const source = importSource;
    event.target.value = '';
    setImportSource(null);

    if (!file || !source) {
      return;
    }

    try {
      validateBillFile(file);
      ensureHydrated();
      const refs = ensureDefaultRefs(source);
      const rows = await parseBillFileToTransactions({
        file,
        source,
        defaultCategoryId: refs.categoryId,
        defaultAccountId: refs.accountId
      });

      if (rows.length === 0) {
        showToast('未识别到可导入账单记录', 'warning');
        return;
      }

      const result = applyBillImportMode({
        mode: importMode,
        existing: transactions,
        incoming: rows
      });

      if (result.shouldClearBeforeImport) {
        clearAllAccountBills();
      }

      result.update.forEach((row) => updateTransaction(row.id, row.payload));
      result.append.forEach((row) => addTransaction(row));

      const changedCount = result.append.length + result.update.length;
      if (changedCount === 0) {
        showToast('导入完成：增量模式下未发现可新增或更新的账单', 'warning');
        return;
      }

      showToast(
        `${source === 'wechat' ? '微信' : '支付宝'}账单导入成功：新增 ${result.append.length} 条，更新 ${result.update.length} 条${result.skipped ? `，跳过 ${result.skipped} 条` : ''}`,
        'success'
      );
    } catch {
      showToast('账单导入失败：文件解析异常', 'error');
    }
  };

  const handleSaveWebdavConfig = () => {
    saveWebdavConfig(webdav);
    showToast('WebDAV 配置已保存', 'success');
  };

  const validateWebdav = () => {
    if (!webdav.endpoint.trim()) {
      throw new Error(
        webdav.proxyEnabled ? '请填写真实 WebDAV 地址（用于代理转发）' : '请填写 WebDAV 地址'
      );
    }
    if (!webdav.username.trim()) {
      throw new Error('请填写 WebDAV 用户名');
    }
    if (!webdav.password.trim()) {
      throw new Error('请填写 WebDAV 密码');
    }
    if (!webdav.remoteFilePath.trim()) {
      throw new Error('请填写远程文件路径');
    }

    try {
      sanitizeWebdavConfig(webdav);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'WebDAV 配置不合法');
    }
  };

  const ensureHydrated = () => {
    if (!hasHydrated) {
      throw new Error('本地数据仍在加载中，请稍后重试');
    }
  };

  const handleWebdavUpload = async () => {
    try {
      ensureHydrated();
      validateWebdav();
      setBusy(true);
      const payload = createFinanceBackupPayload({ transactions, categories, accounts });
      await webdavUploadBackup(webdav, payload);
      saveWebdavConfig(webdav);
      showToast('WebDAV 上传成功', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'WebDAV 上传失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleWebdavDownload = async () => {
    try {
      ensureHydrated();
      validateWebdav();
      setBusy(true);
      const versions = await listWebdavBackupVersions(webdav);
      setWebdavRestoreVersions(versions);
      setSelectedRestorePath(versions[0]?.remotePath || '');
      setWebdavRestoreDialogOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'WebDAV 下载失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmWebdavRestore = async () => {
    try {
      ensureHydrated();
      validateWebdav();
      if (!selectedRestorePath) {
        throw new Error('请选择一个可恢复版本');
      }
      setBusy(true);
      const payload = await webdavDownloadBackup(webdav, selectedRestorePath);
      replaceAllData(payload.data);
      saveWebdavConfig(webdav);
      setWebdavRestoreDialogOpen(false);
      showToast('WebDAV 下载并恢复成功', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'WebDAV 下载失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <section className="panel">
        <h2>备份设置</h2>
        <p>已移除在线数据库连接配置，当前统一使用备份与恢复方案。</p>
        <ul style={{ marginTop: 10, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <li>支持本地 JSON 一键导出与导入。</li>
          <li>支持导入微信 / 支付宝账单 CSV / XLSX。</li>
          <li>支持 WebDAV 远程同步（上传与下载恢复）。</li>
        </ul>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>本地备份导入导出</h3>
        <p className="sync-tip">当前总数据量：{totalRows} 条（交易+分类+账户）</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="primary" onClick={handleExportJson}>
            导出 JSON 备份
          </button>
          <button type="button" onClick={() => backupInputRef.current?.click()}>
            导入 JSON 备份
          </button>
          <input
            ref={backupInputRef}
            type="file"
            title="导入 JSON 备份"
            aria-label="导入 JSON 备份"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleBackupFileImport}
          />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>账单导入</h3>
        <p className="sync-tip">支持微信、支付宝官方账单 CSV / TXT（含制表符）与微信 XLSX 格式。</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            导入模式
            <select
              aria-label="账单导入模式"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as BillImportMode)}
            >
              <option value="incremental">增量（跳过重复）</option>
              <option value="merge">合并（覆盖重复）</option>
              <option value="overwrite">覆盖（清空后导入）</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setImportSource('wechat');
              billInputRef.current?.click();
            }}
            disabled={!hasHydrated}
          >
            导入微信账单
          </button>
          <button
            type="button"
            onClick={() => {
              setImportSource('alipay');
              billInputRef.current?.click();
            }}
            disabled={!hasHydrated}
          >
            导入支付宝账单
          </button>
          <input
            ref={billInputRef}
            type="file"
            title="导入账单文件"
            aria-label="导入账单文件"
            accept=".csv,text/csv,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={handleImportBillFile}
          />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>数据重制</h3>
        <p className="sync-tip">清空所有账户账单（交易记录），保留账户与分类。</p>
        <button type="button" className="danger" onClick={() => setClearBillsOpen(true)}>
          一键清空所有账户账单
        </button>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>WebDAV 同步</h3>
        <p className="sync-tip" style={{ marginTop: 0 }}>
          浏览器直连 WebDAV 常因 CORS 失败。默认开启同源代理：前端请求本站路径（如 /api/webdav），
          再由服务端反向代理到真实 WebDAV。安全策略：仅允许 HTTPS，且拒绝 localhost/内网地址。
        </p>
        <div className="field" style={{ marginBottom: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={webdav.proxyEnabled}
              onChange={(e) => setWebdav((prev) => ({ ...prev, proxyEnabled: e.target.checked }))}
            />
            启用同源代理（推荐）
          </label>
        </div>

        <div className="grid grid-2" style={{ gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{webdav.proxyEnabled ? '真实 WebDAV 地址（代理目标）' : 'WebDAV 地址'}</label>
            <input
              title={webdav.proxyEnabled ? '真实 WebDAV 地址（代理目标）' : 'WebDAV 地址'}
              placeholder="https://dav.example.com/remote.php/dav/files/user"
              value={webdav.endpoint}
              onChange={(e) => setWebdav((prev) => ({ ...prev, endpoint: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>远程文件路径</label>
            <input
              title="远程文件路径"
              placeholder="ledgerflow/backup.json"
              value={webdav.remoteFilePath}
              onChange={(e) => setWebdav((prev) => ({ ...prev, remoteFilePath: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>保留版本数</label>
            <input
              title="保留版本数"
              type="number"
              min={1}
              max={50}
              value={webdav.retainedVersions}
              onChange={(e) =>
                setWebdav((prev) => ({ ...prev, retainedVersions: Number(e.target.value) || 1 }))
              }
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>用户名</label>
            <input
              title="WebDAV 用户名"
              placeholder="请输入用户名"
              value={webdav.username}
              onChange={(e) => setWebdav((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>密码</label>
            <input
              title="WebDAV 密码"
              placeholder="请输入密码"
              type="password"
              value={webdav.password}
              onChange={(e) => setWebdav((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>代理入口路径（同源）</label>
            <input
              title="代理入口路径"
              placeholder="/api/webdav"
              value={webdav.proxyBasePath}
              onChange={(e) => setWebdav((prev) => ({ ...prev, proxyBasePath: e.target.value }))}
              disabled={!webdav.proxyEnabled}
            />
          </div>
        </div>

        <p className="sync-tip" style={{ margin: '10px 0 0 0' }}>
          {webdav.proxyEnabled
            ? '当前已启用代理：浏览器请求代理入口路径，代理服务再转发到上方“真实 WebDAV 地址”。'
            : '当前为浏览器直连 WebDAV：目标服务必须允许当前站点跨域访问。'}
          {' '}当前上传将生成带时间戳的备份文件，并按保留版本数自动清理旧版本；下载恢复默认优先取最新版本。
        </p>

        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSaveWebdavConfig} disabled={busy}>
            保存配置
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void handleWebdavUpload()}
            disabled={busy}
          >
            上传到 WebDAV
          </button>
          <button type="button" onClick={() => void handleWebdavDownload()} disabled={busy}>
            从 WebDAV 下载并恢复
          </button>
        </div>
      </section>

      {webdavRestoreDialogOpen ? (
        <div className="dialog-overlay" role="presentation" onClick={() => setWebdavRestoreDialogOpen(false)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="选择 WebDAV 恢复版本"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dialog-header">选择要恢复的 WebDAV 备份版本</header>
            <div className="dialog-body">
              <div className="webdav-restore-list">
                {webdavRestoreVersions.map((item) => (
                  <label className="webdav-restore-item" key={item.remotePath}>
                    <input
                      type="radio"
                      name="webdav-restore-version"
                      checked={selectedRestorePath === item.remotePath}
                      onChange={() => setSelectedRestorePath(item.remotePath)}
                    />
                    <span className="webdav-restore-item-copy">
                      <strong>
                        {item.label}
                        {item.isLatest ? '（最新）' : ''}
                      </strong>
                      <small>{item.fileName}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <footer className="dialog-footer">
              <button type="button" onClick={() => setWebdavRestoreDialogOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void handleConfirmWebdavRestore()}
                disabled={busy || !selectedRestorePath}
              >
                恢复所选版本
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <Toast
        visible={toast.visible}
        variant={toast.variant}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <ConfirmDialog
        open={clearBillsOpen}
        title="确认清空账单"
        description={`将清空全部 ${transactions.length} 条交易，账户余额会按初始值重算。此操作不可恢复。`}
        confirmText="确认清空"
        cancelText="取消"
        danger
        onCancel={() => setClearBillsOpen(false)}
        onConfirm={() => {
          clearAllAccountBills();
          setClearBillsOpen(false);
          showToast('已清空所有账户账单', 'success');
        }}
      />
    </div>
  );
}
