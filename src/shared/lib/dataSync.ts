import { listConnections } from '../../features/connection-config/model/connectionStorage';
import { postSyncChange, SyncChangeRequest } from '../api/syncClient';
import { useDebugLogStore } from '../store/useDebugLogStore';

export function hasEnabledPostgresConnection() {
  return listConnections().some((item) => item.enabled && item.type === 'postgresql');
}

export async function syncChangeIfNeeded(payload: Omit<SyncChangeRequest, 'happenedAt'>) {
  if (!hasEnabledPostgresConnection()) {
    return;
  }

  try {
    const result = await postSyncChange({
      ...payload,
      happenedAt: new Date().toISOString()
    });

    if (!result.ok) {
      throw new Error(result.detail || result.message || '同步失败');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '数据库增量同步失败';
    useDebugLogStore.getState().addLog({
      action: '自动同步',
      status: 'error',
      dbType: 'postgresql',
      message
    });
  }
}
