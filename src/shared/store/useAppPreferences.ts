import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppMode, AppTheme } from '../types/app';

interface AppPreferencesState {
  theme: AppTheme;
  mode: AppMode;
  language: 'zh-CN' | 'en-US';
  setTheme: (theme: AppTheme) => void;
  setMode: (mode: AppMode) => void;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      mode: 'proxy',
      language: 'zh-CN',
      setTheme: (theme) => set({ theme }),
      setMode: (mode) => set({ mode }),
      setLanguage: (language) => set({ language })
    }),
    { name: 'ledgerflow-preferences' }
  )
);
