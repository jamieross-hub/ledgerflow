import { useMemo, useState } from 'react';
import { ConnectionConfigManager } from '../../features/connection-config/ui/ConnectionConfigManager';
import { useSyncStore } from '../../shared/store/useSyncStore';
import { Toast, ToastVariant } from '../../shared/ui/Toast';

export function DatabaseSettingsPage() {
  const { status, message, detail, progress, syncToDatabase } = useSyncStore();
  const [toastVisible, setToastVisible] = useState(false);

  const syncButtonText = useMemo(() => {
    if (status === 'loading') return '正在同步...';
    if (status === 'success') return '同步成功';
    if (status === 'error') return '同步失败';
    return '同步到数据库';
  }, [status]);

  const toastVariant: ToastVariant = status === 'success' ? 'success' : status === 'error' ? 'error' : 'warning';

  async function handleSync() {
    await syncToDatabase();
    setToastVisible(true);
  }

  return (
    <div>
      <section className="panel">
        <h2>数据库设置</h2>
        <p>在此配置 PostgreSQL / MySQL / Redis 连接，连接测试统一通过后端代理执行。</p>
        <ul style={{ marginTop: 10, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <li>新增表单默认展开，可直接填写主机、端口、用户名、密码等字段。</li>
          <li>密码与连接串不会以明文持久化到浏览器存储。</li>
          <li>建议仅在可信设备保存连接配置，并定期轮换数据库密码。</li>
        </ul>
      </section>

      <section className="panel sync-panel">
        <h3 style={{ marginTop: 0 }}>数据同步（PostgreSQL）</h3>
        <p className="sync-tip">
          支持两种场景：① 先本地记账，后续点击“同步到数据库”批量迁移；② 一开始已配置并启用 PostgreSQL，后续变更会自动增量写入数据库。
        </p>

        <div className="sync-actions">
          <button className="primary" type="button" onClick={() => void handleSync()} disabled={status === 'loading'}>
            {syncButtonText}
          </button>
          <span className="sync-progress" aria-live="polite">
            已同步 {progress.synced} / {progress.total || 0} 条记录
          </span>
        </div>

        {status === 'needs-config' ? (
          <div className="connection-test-error" style={{ marginTop: 10 }}>
            请配置数据库连接后再同步数据。
            <a href="#connection-config-manager" style={{ marginLeft: 8 }}>
              去配置
            </a>
          </div>
        ) : null}

        {(status === 'success' || status === 'error') && detail ? (
          <p className={status === 'success' ? 'connection-test-success' : 'connection-test-error'}>{detail}</p>
        ) : null}
      </section>

      <ConnectionConfigManager />

      <Toast
        visible={toastVisible}
        variant={toastVariant}
        message={message || '请配置数据库连接后再同步数据'}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
