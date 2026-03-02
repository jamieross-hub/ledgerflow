import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENV } from '../config/env';

const AI_SETTINGS_STORAGE_KEY = 'ledgerflow-ai-settings';
const AI_SETTINGS_API_KEY_SESSION_KEY = 'ledgerflow-ai-settings-api-key';
const AI_SETTINGS_API_KEY_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ApiKeySessionPayload {
  value: string;
  expiresAt: number;
}

function readSessionApiKey() {
  try {
    const raw = window.sessionStorage.getItem(AI_SETTINGS_API_KEY_SESSION_KEY);
    if (!raw) return '';

    const now = Date.now();
    const parsed = JSON.parse(raw) as Partial<ApiKeySessionPayload>;
    if (
      !parsed ||
      typeof parsed.value !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= now
    ) {
      window.sessionStorage.removeItem(AI_SETTINGS_API_KEY_SESSION_KEY);
      return '';
    }

    window.sessionStorage.setItem(
      AI_SETTINGS_API_KEY_SESSION_KEY,
      JSON.stringify({ value: parsed.value, expiresAt: now + AI_SETTINGS_API_KEY_SESSION_TTL_MS })
    );
    return parsed.value;
  } catch {
    return '';
  }
}

function writeSessionApiKey(apiKey: string) {
  try {
    if (apiKey) {
      window.sessionStorage.setItem(
        AI_SETTINGS_API_KEY_SESSION_KEY,
        JSON.stringify({
          value: apiKey,
          expiresAt: Date.now() + AI_SETTINGS_API_KEY_SESSION_TTL_MS
        })
      );
      return;
    }
    window.sessionStorage.removeItem(AI_SETTINGS_API_KEY_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

type PersistedAiSettingsState = Omit<
  AiSettingsState,
  | 'apiKey'
  | 'setBaseUrl'
  | 'setApiKey'
  | 'setModel'
  | 'setEmbeddingModel'
  | 'setEnableEmbeddingModel'
  | 'setRerankModel'
  | 'setEnableRerankModel'
  | 'setMemoryDays'
  | 'setMemoryBackend'
  | 'setBulkRecategorizeConcurrency'
> & {
  baseUrl: string;
  model: string;
  embeddingModel: string;
  enableEmbeddingModel: boolean;
  rerankModel: string;
  enableRerankModel: boolean;
  memoryDays: number;
  memoryBackend: 'local' | 'redis';
  bulkRecategorizeConcurrency: number;
};

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

const DEFAULT_BULK_RECATEGORIZE_CONCURRENCY = 8;
const MIN_BULK_RECATEGORIZE_CONCURRENCY = 5;
const MAX_BULK_RECATEGORIZE_CONCURRENCY = 30;

function normalizeBulkRecategorizeConcurrency(value: number): number {
  return Math.min(
    MAX_BULK_RECATEGORIZE_CONCURRENCY,
    Math.max(
      MIN_BULK_RECATEGORIZE_CONCURRENCY,
      Math.round(Number.isFinite(value) ? value : DEFAULT_BULK_RECATEGORIZE_CONCURRENCY)
    )
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
      apiKey: readSessionApiKey() || ENV.aiApiKey,
      model: ENV.aiDefaultModel,
      embeddingModel: 'text-embedding-3-small',
      enableEmbeddingModel: true,
      rerankModel: 'bge-reranker-v2-m3',
      enableRerankModel: true,
      memoryDays: 3,
      memoryBackend: 'local',
      bulkRecategorizeConcurrency: DEFAULT_BULK_RECATEGORIZE_CONCURRENCY,
      setBaseUrl: (baseUrl: string) => set({ baseUrl: baseUrl.trim() }),
      setApiKey: (apiKey: string) => {
        const nextApiKey = apiKey.trim();
        writeSessionApiKey(nextApiKey);
        set({ apiKey: nextApiKey });
      },
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
      name: AI_SETTINGS_STORAGE_KEY,
      partialize: (state: AiSettingsState): PersistedAiSettingsState => ({
        baseUrl: state.baseUrl,
        model: state.model,
        embeddingModel: state.embeddingModel,
        enableEmbeddingModel: state.enableEmbeddingModel,
        rerankModel: state.rerankModel,
        enableRerankModel: state.enableRerankModel,
        memoryDays: state.memoryDays,
        memoryBackend: state.memoryBackend,
        bulkRecategorizeConcurrency: state.bulkRecategorizeConcurrency
      }),
      merge: (persisted: unknown, current: AiSettingsState) => {
        const next = { ...current, ...(persisted as Partial<PersistedAiSettingsState>) };
        next.apiKey = readSessionApiKey() || ENV.aiApiKey;
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
