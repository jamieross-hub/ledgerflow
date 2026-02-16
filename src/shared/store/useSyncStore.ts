import { create } from 'zustand';

export type SyncStatus = 'idle' | 'loading' | 'success' | 'error' | 'needs-config';

interface SyncProgress {
  synced: number;
  total: number;
}

interface SyncState {
  status: SyncStatus;
  message: string;
  detail: string;
  progress: SyncProgress;
  syncToDatabase: () => Promise<void>;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  status: 'idle',
  message: '',
  detail: '',
  progress: { synced: 0, total: 0 },
  reset: () =>
    set({
      status: 'idle',
      message: '',
      detail: '',
      progress: { synced: 0, total: 0 }
    }),
  syncToDatabase: async () => {
    set({
      status: 'needs-config',
      message: '在线数据库同步已移除',
      detail: '当前版本仅支持本地备份、账单导入与 WebDAV 备份恢复。',
      progress: { synced: 0, total: 0 }
    });
  }
}));
