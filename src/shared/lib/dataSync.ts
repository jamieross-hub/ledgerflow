import { SyncChangeRequest } from '../api/syncClient';

export type SyncDbType = 'redis';

export function hasEnabledSqlConnection() {
  return false;
}

export function resolveSyncTargetDbType(): SyncDbType | null {
  return null;
}

export async function syncChangeIfNeeded(payload: Omit<SyncChangeRequest, 'happenedAt'>) {
  void payload;
  return;
}
