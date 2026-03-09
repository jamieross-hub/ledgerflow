import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GlobalMemoryDraft,
  GlobalMemoryFilter,
  GlobalMemoryItem,
  GlobalMemoryType,
  GlobalMemoryUpdatePayload,
  normalizeGlobalMemoryDraft,
  buildMemoryEmbeddingText,
  clampMemoryScore,
  sanitizePersistedGlobalMemoryItem
} from './globalMemory';

const GLOBAL_MEMORY_STORAGE_KEY = 'ledgerflow-global-memory';

function createGlobalMemoryId() {
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortMemories(items: GlobalMemoryItem[], pinnedFirst = true) {
  const copied = [...items];
  copied.sort((a, b) => {
    if (pinnedFirst && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aUpdatedAt = new Date(a.updatedAt).getTime() || 0;
    const bUpdatedAt = new Date(b.updatedAt).getTime() || 0;
    return bUpdatedAt - aUpdatedAt;
  });
  return copied;
}

function mergeMemoryItem(current: GlobalMemoryItem, payload: Partial<GlobalMemoryDraft>): GlobalMemoryItem {
  const nextTitle = payload.title !== undefined ? String(payload.title || '').trim() : current.title;
  const nextContent =
    payload.content !== undefined ? String(payload.content || '').trim() : current.content;
  const nextType = payload.type ?? current.type;
  const nextEmbeddingText =
    payload.embeddingText !== undefined
      ? String(payload.embeddingText || '').trim()
      : current.embeddingText;

  return {
    ...current,
    ...payload,
    title: nextTitle,
    content: nextContent,
    type: nextType,
    source: payload.source ?? current.source,
    sourceTrace: Array.isArray(payload.sourceTrace) ? payload.sourceTrace : current.sourceTrace,
    sourceIds: Array.isArray(payload.sourceIds) ? payload.sourceIds.filter(Boolean) : current.sourceIds,
    confidence:
      payload.confidence !== undefined
        ? clampMemoryScore(payload.confidence, current.confidence)
        : current.confidence,
    score: payload.score !== undefined ? clampMemoryScore(payload.score, current.score) : current.score,
    status: payload.status ?? current.status,
    origin: payload.origin ?? current.origin,
    pinned: payload.pinned ?? current.pinned,
    disabled: payload.disabled ?? current.disabled,
    embeddingText:
      nextEmbeddingText || buildMemoryEmbeddingText({ title: nextTitle, content: nextContent, type: nextType }),
    lastUsedAt: payload.lastUsedAt !== undefined ? payload.lastUsedAt : current.lastUsedAt,
    updatedAt: new Date().toISOString()
  };
}

interface GlobalMemoryState {
  memories: GlobalMemoryItem[];
  addMemory: (payload: GlobalMemoryDraft) => { ok: boolean; id?: string; reason?: string };
  updateMemory: (payload: GlobalMemoryUpdatePayload) => { ok: boolean; reason?: string };
  removeMemory: (id: string) => void;
  removeMemories: (ids: string[]) => void;
  clearMemories: () => void;
  archiveMemory: (id: string) => void;
  restoreMemory: (id: string) => void;
  setMemoryDisabled: (id: string, disabled: boolean) => void;
  pinMemory: (id: string, pinned: boolean) => void;
  markMemoryUsed: (id: string) => void;
  getFilteredMemories: (filter?: GlobalMemoryFilter) => GlobalMemoryItem[];
  getMemorySummaryByType: () => Record<GlobalMemoryType, number>;
}

export const useGlobalMemoryStore = create<GlobalMemoryState>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (payload) => {
        const normalized = normalizeGlobalMemoryDraft(payload);
        if (!normalized.title || !normalized.content) {
          return { ok: false, reason: '记忆标题和内容不能为空。' };
        }

        const id = createGlobalMemoryId();
        set((state) => ({
          memories: sortMemories([{ ...normalized, id }, ...state.memories])
        }));
        return { ok: true, id };
      },
      updateMemory: ({ id, ...payload }) => {
        const exists = get().memories.some((item) => item.id === id);
        if (!exists) {
          return { ok: false, reason: '记忆不存在。' };
        }

        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) => (item.id === id ? mergeMemoryItem(item, payload) : item))
          )
        }));
        return { ok: true };
      },
      removeMemory: (id) => {
        set((state) => ({
          memories: state.memories.filter((item) => item.id !== id)
        }));
      },
      removeMemories: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          memories: state.memories.filter((item) => !idSet.has(item.id))
        }));
      },
      clearMemories: () => {
        set(() => ({ memories: [] }));
      },
      archiveMemory: (id) => {
        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) =>
              item.id === id ? { ...item, status: 'archived', updatedAt: new Date().toISOString() } : item
            )
          )
        }));
      },
      restoreMemory: (id) => {
        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) =>
              item.id === id ? { ...item, status: 'active', updatedAt: new Date().toISOString() } : item
            )
          )
        }));
      },
      setMemoryDisabled: (id, disabled) => {
        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) =>
              item.id === id ? { ...item, disabled, updatedAt: new Date().toISOString() } : item
            )
          )
        }));
      },
      pinMemory: (id, pinned) => {
        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) =>
              item.id === id ? { ...item, pinned, updatedAt: new Date().toISOString() } : item
            )
          )
        }));
      },
      markMemoryUsed: (id) => {
        set((state) => ({
          memories: sortMemories(
            state.memories.map((item) =>
              item.id === id
                ? { ...item, lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
                : item
            )
          )
        }));
      },
      getFilteredMemories: (filter) => {
        const { memories } = get();
        const nextFilter = filter ?? {};
        return sortMemories(
          memories.filter((item) => {
            if (nextFilter.type && nextFilter.type !== 'all' && item.type !== nextFilter.type) {
              return false;
            }
            if (nextFilter.status && nextFilter.status !== 'all' && item.status !== nextFilter.status) {
              return false;
            }
            if (!nextFilter.includeDisabled && item.disabled) {
              return false;
            }
            return true;
          }),
          nextFilter.pinnedFirst ?? true
        );
      },
      getMemorySummaryByType: () => {
        const summary: Record<GlobalMemoryType, number> = {
          user_preference: 0,
          financial_habit: 0,
          risk_preference: 0,
          display_preference: 0
        };
        for (const item of get().memories) {
          if (item.type in summary) {
            summary[item.type] += 1;
          }
        }
        return summary;
      }
    }),
    {
      name: GLOBAL_MEMORY_STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const incoming = (persistedState as Partial<GlobalMemoryState> | undefined)?.memories;
        const safeMemories = Array.isArray(incoming)
          ? incoming
              .map((item, index) => sanitizePersistedGlobalMemoryItem(item, index))
              .filter((item): item is GlobalMemoryItem => Boolean(item))
          : currentState.memories;

        return {
          ...currentState,
          ...(persistedState as object),
          memories: sortMemories(safeMemories)
        };
      }
    }
  )
);
