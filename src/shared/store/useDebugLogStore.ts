import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DebugLogStatus = 'success' | 'error' | 'info' | 'pending';

export interface DebugLogItem {
  id: string;
  timestamp: string;
  action: string;
  status: DebugLogStatus;
  dbType?: 'redis';
  message: string;
}

interface DebugLogState {
  logs: DebugLogItem[];
  addLog: (payload: Omit<DebugLogItem, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 20;

export const useDebugLogStore = create<DebugLogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (payload) =>
        set((state) => {
          const next: DebugLogItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            ...payload
          };
          return {
            logs: [...state.logs, next].slice(-MAX_LOGS)
          };
        }),
      clearLogs: () => set({ logs: [] })
    }),
    { name: 'ledgerflow-debug-logs' }
  )
);
