import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppTheme } from '../types/app';

export type SyncTargetDbPreference = 'postgresql' | 'mysql';

interface AppPreferencesState {
  theme: AppTheme;
  syncTargetDb: SyncTargetDbPreference;
  setTheme: (theme: AppTheme) => void;
  setSyncTargetDb: (target: SyncTargetDbPreference) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      syncTargetDb: 'postgresql',
      setTheme: (theme) => set({ theme }),
      setSyncTargetDb: (target) => set({ syncTargetDb: target })
    }),
    { name: 'ledgerflow-preferences' }
  )
);
