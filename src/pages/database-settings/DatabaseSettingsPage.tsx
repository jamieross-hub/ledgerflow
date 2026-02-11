import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { parseBillCsvToTransactions } from '../../shared/lib/billImport';
import {
  BackupWebdavConfig,
  createFinanceBackupPayload,
  downloadBackupJson,
  loadWebdavConfig,
  parseFinanceBackupPayload,
  saveWebdavConfig,
  webdavDownloadBackup,
  webdavUploadBackup
} from '../../shared/lib/backup';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { Toast, ToastVariant } from '../../shared/ui/Toast';

type BillSource = 'wechat' | 'alipay';

export function DatabaseSettingsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const replaceAllData = useFinanceStore((s) => s.replaceAllData);

  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const billInputRef = useRef<HTMLInputElement | null>(null);

  const [importSource, setImportSource] = useState<BillSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string }>({
    visible: false,
    variant: 'success',
    message: ''
  });

  const [webdav, setWebdav] = useState<BackupWebdavConfig>(() => loadWebdavConfig());

  const totalRows = useMemo(
    () => transactions.length + categories.length + accounts.length,
    [transactions.length, categories.length, accounts.length]
  );

  const showToast = (message: string, variant: ToastVariant) => {
    setToast({ visible: true, message, variant });
  };

  const ensureDefaultRefs = () => {
    const categoryId = categories[0]?.id || addCategory('默认分类');
    const accountId = accounts[0]?.id || addAccount('默认账户', undefined, 0);
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
      const csvText = await file.text();
      const refs = ensureDefaultRefs();
      const rows = parseBillCsvToTransactions({
        csvText,
        source,
        defaultCategoryId: refs.categoryId,
        defaultAccountId: refs.accountId
      });

      if (rows.length === 0) {
        showToast('未识别到可导入账单记录', 'warning');
        return;
      }

      rows.forEach((row) => addTransaction(row));
      showToast(
        `${source === 'wechat' ? '微信' : '支付宝'}账单导入成功：${rows.length} 条`,
        'success'
      );
    } catch {
      showToast('账单导入失败：CSV 解析异常', 'error');
    }
  };

  const handleSaveWebdavConfig = () => {
    saveWebdavConfig(webdav);
    showToast('WebDAV 配置已保存', 'success');
  };

  const validateWebdav = () => {
    if (!webdav.endpoint.trim()) {
      throw new Error('请填写 WebDAV 地址');
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
  };

  const handleWebdavUpload = async () => {
    try {
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
      validateWebdav();
      setBusy(true);
      const payload = await webdavDownloadBackup(webdav);
      replaceAllData(payload.data);
      saveWebdavConfig(webdav);
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
        <p>已移除 MySQL / PostgreSQL / Redis 连接配置，当前统一使用备份与恢复方案。</p>
        <ul style={{ marginTop: 10, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <li>支持本地 JSON 一键导出与导入。</li>
          <li>支持导入微信 / 支付宝账单 CSV。</li>
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
        <h3 style={{ marginTop: 0 }}>账单 CSV 导入</h3>
        <p className="sync-tip">支持微信、支付宝官方账单 CSV / TXT（含制表符）格式。</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setImportSource('wechat');
              billInputRef.current?.click();
            }}
          >
            导入微信账单
          </button>
          <button
            type="button"
            onClick={() => {
              setImportSource('alipay');
              billInputRef.current?.click();
            }}
          >
            导入支付宝账单
          </button>
          <input
            ref={billInputRef}
            type="file"
            title="导入账单 CSV"
            aria-label="导入账单 CSV"
            accept=".csv,text/csv,.txt,text/plain"
            style={{ display: 'none' }}
            onChange={handleImportBillFile}
          />
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>WebDAV 同步</h3>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>WebDAV 地址</label>
            <input
              title="WebDAV 地址"
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
        </div>

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

      <Toast
        visible={toast.visible}
        variant={toast.variant}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
