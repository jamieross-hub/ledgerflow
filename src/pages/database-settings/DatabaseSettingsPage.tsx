import { useMemo, useState } from 'react';
import { ConnectionConfigManager } from '../../features/connection-config/ui/ConnectionConfigManager';
import { listConnections } from '../../features/connection-config/model/connectionStorage';
import { useSyncStore } from '../../shared/store/useSyncStore';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { Toast, ToastVariant } from '../../shared/ui/Toast';

export function DatabaseSettingsPage() {
  const { status, message, detail, progress, syncToDatabase } = useSyncStore();
  const transactionsCount = useFinanceStore((s) => s.transactions.length);
  const [toastVisible, setToastVisible] = useState(false);
  const syncTargetDb = useAppPreferences((s) => s.syncTargetDb);
  const setSyncTargetDb = useAppPreferences((s) => s.setSyncTargetDb);

  const hasSqlConnection = listConnections().some(
    (item) => item.enabled && (item.type === 'postgresql' || item.type === 'mysql')
  );

  const isEarlyStage = transactionsCount < 12;

  const syncButtonText = useMemo(() => {
    if (status === 'loading') return '正在同步...';
    if (status === 'success') return '同步成功';
    if (status === 'error') return '同步失败';
    return '一键迁移到云端数据库';
  }, [status]);

  const toastVariant: ToastVariant =
    status === 'success' ? 'success' : status === 'error' ? 'error' : 'warning';

  async function handleSync() {
    await syncToDatabase();
    setToastVisible(true);
  }

  return (
    <div>
      <section className="panel">
        <h2>数据库同步模式</h2>
        <p>
          默认先本地记账，不强制连接数据库。后续可随时把历史数据一键迁移到 MySQL 或 PostgreSQL。
        </p>

        <div
          className={
            isEarlyStage ? 'sync-reminder sync-reminder-soft' : 'sync-reminder sync-reminder-warn'
          }
        >
          {isEarlyStage ? (
            <p>
              当前为初期使用阶段（已记录 {transactionsCount}{' '}
              笔），可先专注记账流程，稍后再配置数据库。
            </p>
          ) : (
            <p>
              已累计 {transactionsCount} 笔数据，建议现在开启云端同步，避免数据仅保存在单一设备中。
            </p>
          )}
        </div>

        <ul style={{ marginTop: 10, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <li>推荐仅填写：名称、数据库类型、Host、Port、数据库名、用户名、密码。</li>
          <li>高级参数默认收起，普通场景无需调整。</li>
          <li>前端会优先使用你选择的目标数据库类型进行同步。</li>
        </ul>
      </section>

      <section className="panel sync-panel">
        <h3 style={{ marginTop: 0 }}>历史数据迁移与增量同步</h3>
        <p className="sync-tip">
          支持 MySQL / PostgreSQL 二选一，后续新增和修改会按同一目标库自动增量同步。
        </p>

        <div className="sync-target-switch" aria-label="选择同步目标数据库">
          <button
            type="button"
            className={
              syncTargetDb === 'postgresql' ? 'sync-target-chip active' : 'sync-target-chip'
            }
            onClick={() => setSyncTargetDb('postgresql')}
          >
            PostgreSQL
          </button>
          <button
            type="button"
            className={syncTargetDb === 'mysql' ? 'sync-target-chip active' : 'sync-target-chip'}
            onClick={() => setSyncTargetDb('mysql')}
          >
            MySQL
          </button>
          <small className="sync-progress">
            当前优先目标：{syncTargetDb === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
          </small>
        </div>

        <div className="sync-actions">
          <button
            className="primary"
            type="button"
            onClick={() => void handleSync()}
            disabled={status === 'loading'}
          >
            {syncButtonText}
          </button>
          <span className="sync-progress" aria-live="polite">
            已同步 {progress.synced} / {progress.total || 0} 条记录
          </span>
        </div>

        {status === 'needs-config' ? (
          <div className="connection-test-error" style={{ marginTop: 10 }}>
            还没有可用的 MySQL / PostgreSQL 连接，你可以先继续记账，准备好后再来配置并迁移。
            <a href="#connection-config-manager" style={{ marginLeft: 8 }}>
              去配置
            </a>
          </div>
        ) : null}

        {!hasSqlConnection ? (
          <p className="sync-tip" style={{ marginTop: 8 }}>
            当前未检测到启用中的 MySQL / PostgreSQL 连接，迁移按钮会在配置后生效。
          </p>
        ) : null}

        {(status === 'success' || status === 'error') && detail ? (
          <p className={status === 'success' ? 'connection-test-success' : 'connection-test-error'}>
            {detail}
          </p>
        ) : null}
      </section>

      <ConnectionConfigManager />

      <Toast
        visible={toastVisible}
        variant={toastVariant}
        message={message || '当前未配置可用数据库连接'}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
