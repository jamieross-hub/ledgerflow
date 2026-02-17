import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENV } from '../config/env';

interface AiSettingsState {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  enableEmbeddingModel: boolean;
  rerankModel: string;
  enableRerankModel: boolean;
  memoryDays: number;
  memoryBackend: 'local' | 'redis';
  bulkRecategorizeConcurrency: number;
  setBaseUrl: (baseUrl: string) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setEmbeddingModel: (model: string) => void;
  setEnableEmbeddingModel: (enabled: boolean) => void;
  setRerankModel: (model: string) => void;
  setEnableRerankModel: (enabled: boolean) => void;
  setMemoryDays: (days: number) => void;
  setMemoryBackend: (backend: 'local' | 'redis') => void;
  setBulkRecategorizeConcurrency: (value: number) => void;
}

const DEFAULT_BULK_RECATEGORIZE_CONCURRENCY = 4;
const MAX_BULK_RECATEGORIZE_CONCURRENCY = 12;

function normalizeBulkRecategorizeConcurrency(value: number): number {
  return Math.min(
    MAX_BULK_RECATEGORIZE_CONCURRENCY,
    Math.max(1, Math.round(Number.isFinite(value) ? value : DEFAULT_BULK_RECATEGORIZE_CONCURRENCY))
  );
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
      enableEmbeddingModel: true,
      rerankModel: 'bge-reranker-v2-m3',
      enableRerankModel: true,
      memoryDays: 3,
      memoryBackend: 'local',
      bulkRecategorizeConcurrency: DEFAULT_BULK_RECATEGORIZE_CONCURRENCY,
      setBaseUrl: (baseUrl: string) => set({ baseUrl: baseUrl.trim() }),
      setApiKey: (apiKey: string) => set({ apiKey: apiKey.trim() }),
      setModel: (model: string) => set({ model: model.trim() || ENV.aiDefaultModel }),
      setEmbeddingModel: (model: string) => set({ embeddingModel: model.trim() }),
      setEnableEmbeddingModel: (enabled: boolean) => set({ enableEmbeddingModel: enabled }),
      setRerankModel: (model: string) => set({ rerankModel: model.trim() }),
      setEnableRerankModel: (enabled: boolean) => set({ enableRerankModel: enabled }),
      setMemoryDays: (days: number) =>
        set({ memoryDays: Math.min(3, Math.max(1, Math.round(days || 1))) }),
      setMemoryBackend: (backend: 'local' | 'redis') => set({ memoryBackend: backend }),
      setBulkRecategorizeConcurrency: (value: number) =>
        set({ bulkRecategorizeConcurrency: normalizeBulkRecategorizeConcurrency(value) })
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
        if (typeof next.enableEmbeddingModel !== 'boolean') {
          next.enableEmbeddingModel = true;
        }
        if (!next.rerankModel?.trim()) {
          next.rerankModel = 'bge-reranker-v2-m3';
        }
        if (typeof next.enableRerankModel !== 'boolean') {
          next.enableRerankModel = true;
        }
        next.bulkRecategorizeConcurrency = normalizeBulkRecategorizeConcurrency(
          next.bulkRecategorizeConcurrency
        );
        return next;
      }
    }
  )
);
