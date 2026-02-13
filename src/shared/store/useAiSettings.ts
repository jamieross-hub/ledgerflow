import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENV } from '../config/env';

interface AiSettingsState {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  rerankModel: string;
  memoryDays: number;
  memoryBackend: 'local' | 'redis';
  setBaseUrl: (baseUrl: string) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setEmbeddingModel: (model: string) => void;
  setRerankModel: (model: string) => void;
  setMemoryDays: (days: number) => void;
  setMemoryBackend: (backend: 'local' | 'redis') => void;
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
      embeddingModel: 'text-embedding-3-small',
      rerankModel: 'bge-reranker-v2-m3',
      memoryDays: 3,
      memoryBackend: 'local',
      setBaseUrl: (baseUrl: string) => set({ baseUrl: baseUrl.trim() }),
      setApiKey: (apiKey: string) => set({ apiKey: apiKey.trim() }),
      setModel: (model: string) => set({ model: model.trim() || ENV.aiDefaultModel }),
      setEmbeddingModel: (model: string) => set({ embeddingModel: model.trim() }),
      setRerankModel: (model: string) => set({ rerankModel: model.trim() }),
      setMemoryDays: (days: number) =>
        set({ memoryDays: Math.min(3, Math.max(1, Math.round(days || 1))) }),
      setMemoryBackend: (backend: 'local' | 'redis') => set({ memoryBackend: backend })
    }),
    {
      name: 'ledgerflow-ai-settings',
      merge: (persisted, current) => {
        const next = { ...current, ...(persisted as Partial<AiSettingsState>) };
        if (!next.model?.trim()) {
          next.model = ENV.aiDefaultModel;
        }
        if (!next.embeddingModel?.trim()) {
          next.embeddingModel = 'text-embedding-3-small';
        }
        if (!next.rerankModel?.trim()) {
          next.rerankModel = 'bge-reranker-v2-m3';
        }
        return next;
      }
    }
  )
);
