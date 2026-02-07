import { create } from 'zustand';
import { postSyncLocalData } from '../api/syncClient';
import { hasEnabledPostgresConnection } from '../lib/dataSync';
import { useDebugLogStore } from './useDebugLogStore';
import { useFinanceStore } from './useFinanceStore';

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
    if (!hasEnabledPostgresConnection()) {
      set({
        status: 'needs-config',
        message: '请配置数据库连接后再同步数据',
        detail: '请在上方连接配置区新增 PostgreSQL 连接并启用后重试。'
      });
      return;
    }

    const state = useFinanceStore.getState();
    const data = {
      transactions: state.transactions,
      accounts: state.accounts,
      categories: state.categories
    };
    const total = data.transactions.length + data.accounts.length + data.categories.length;

    set({
      status: 'loading',
      message: '正在同步...',
      detail: '',
      progress: { synced: 0, total }
    });

    try {
      const result = await postSyncLocalData({
        source: 'manual',
        strategy: 'upsert',
        data
      });

      if (!result.ok) {
        throw new Error(result.detail || result.message || '数据同步失败');
      }

      const synced = typeof result.synced === 'number' ? result.synced : total;
      set({
        status: 'success',
        message: '数据同步成功',
        detail: result.message || '本地数据已写入 PostgreSQL',
        progress: { synced, total }
      });

      useDebugLogStore.getState().addLog({
        action: '手动同步',
        status: 'success',
        dbType: 'postgresql',
        message: `同步成功：${synced}/${total} 条记录`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '数据同步失败';
      set({
        status: 'error',
        message: '数据同步失败',
        detail: message
      });

      useDebugLogStore.getState().addLog({
        action: '手动同步',
        status: 'error',
        dbType: 'postgresql',
        message
      });
    }
  }
}));
