import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENV } from '../config/env';

interface AiSettingsState {
  baseUrl: string;
  apiKey: string;
  model: string;
  setBaseUrl: (baseUrl: string) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
}

/**
 * AI 供应商设置在前端侧持久化：
 * - 满足“无需 Docker 注入”的使用方式
 * - 可在设置页统一维护，助手页直接读取
 */
export const useAiSettings = create<AiSettingsState>()(
  persist(
    (set) => ({
      baseUrl: ENV.aiBaseUrl,
      apiKey: ENV.aiApiKey,
      model: ENV.aiDefaultModel,
      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.trim() }),
      setApiKey: (apiKey) => set({ apiKey: apiKey.trim() }),
      setModel: (model) => set({ model: model.trim() })
    }),
    { name: 'ledgerflow-ai-settings' }
  )
);
