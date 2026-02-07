import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppTheme } from '../types/app';

interface AppPreferencesState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme })
    }),
    { name: 'ledgerflow-preferences' }
  )
);
