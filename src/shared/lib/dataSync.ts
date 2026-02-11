import { ConnectionConfig } from '../../entities/connection/types';
import { listConnections } from '../../features/connection-config/model/connectionStorage';
import { postSyncChange, SyncChangeRequest } from '../api/syncClient';
import { useAppPreferences } from '../store/useAppPreferences';
import { useDebugLogStore } from '../store/useDebugLogStore';

export type SyncDbType = 'postgresql' | 'mysql';

type SqlConnectionConfig = ConnectionConfig & { type: SyncDbType };

function isSqlType(type: string): type is SyncDbType {
  return type === 'postgresql' || type === 'mysql';
}

function listEnabledSqlConnections(): SqlConnectionConfig[] {
  return listConnections().filter(
    (item): item is SqlConnectionConfig => item.enabled && isSqlType(item.type)
  );
}

export function hasEnabledSqlConnection() {
  return listEnabledSqlConnections().length > 0;
}

export function resolveSyncTargetDbType(): SyncDbType | null {
  const enabled = listEnabledSqlConnections();
  if (enabled.length === 0) {
    return null;
  }

  const preferred = useAppPreferences.getState().syncTargetDb;
  const preferredMatched = enabled.find((item) => item.type === preferred);
  if (preferredMatched) {
    return preferredMatched.type;
  }

  return enabled[0].type;
}

export async function syncChangeIfNeeded(payload: Omit<SyncChangeRequest, 'happenedAt'>) {
  const targetDbType = resolveSyncTargetDbType();
  if (!targetDbType) {
    return;
  }

  try {
    const result = await postSyncChange({
      ...payload,
      targetDbType,
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
      dbType: targetDbType,
      message
    });
  }
}
