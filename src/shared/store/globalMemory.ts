export type GlobalMemoryType =
  | 'user_preference'
  | 'financial_habit'
  | 'risk_preference'
  | 'display_preference';

export type GlobalMemoryStatus = 'active' | 'archived';

export type GlobalMemoryOrigin = 'manual' | 'extracted' | 'inferred';

export type GlobalMemorySourceKind =
  | 'assistant_chat'
  | 'bookkeeping_action'
  | 'repayment_behavior'
  | 'budget_behavior'
  | 'settings_change'
  | 'manual';

export interface GlobalMemorySourceTrace {
  kind: GlobalMemorySourceKind;
  label: string;
  sourceId?: string;
  excerpt?: string;
  recordedAt?: string;
}

export interface GlobalMemoryItem {
  id: string;
  title: string;
  content: string;
  type: GlobalMemoryType;
  source: GlobalMemorySourceKind;
  sourceTrace: GlobalMemorySourceTrace[];
  sourceIds: string[];
  confidence: number;
  score: number;
  status: GlobalMemoryStatus;
  origin: GlobalMemoryOrigin;
  pinned: boolean;
  disabled: boolean;
  embeddingText: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalMemoryDraft {
  title: string;
  content: string;
  type: GlobalMemoryType;
  source: GlobalMemorySourceKind;
  sourceTrace?: GlobalMemorySourceTrace[];
  sourceIds?: string[];
  confidence?: number;
  score?: number;
  status?: GlobalMemoryStatus;
  origin?: GlobalMemoryOrigin;
  pinned?: boolean;
  disabled?: boolean;
  embeddingText?: string;
  lastUsedAt?: string | null;
}

export interface GlobalMemoryUpdatePayload extends Partial<GlobalMemoryDraft> {
  id: string;
}

export interface GlobalMemoryFilter {
  type?: GlobalMemoryType | 'all';
  status?: GlobalMemoryStatus | 'all';
  includeDisabled?: boolean;
  pinnedFirst?: boolean;
}

export function clampMemoryScore(value: number, fallback: number): number {
  const next = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, next));
}

export function buildMemoryEmbeddingText(payload: Pick<GlobalMemoryDraft, 'title' | 'content' | 'type'>) {
  return [payload.title, payload.content, payload.type].map((item) => String(item || '').trim()).filter(Boolean).join('\n');
}

export function normalizeGlobalMemoryDraft(payload: GlobalMemoryDraft): Omit<GlobalMemoryItem, 'id'> {
  const now = new Date().toISOString();
  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  const type = payload.type;
  const source = payload.source;

  return {
    title,
    content,
    type,
    source,
    sourceTrace: Array.isArray(payload.sourceTrace) ? payload.sourceTrace : [],
    sourceIds: Array.isArray(payload.sourceIds) ? payload.sourceIds.filter(Boolean) : [],
    confidence: clampMemoryScore(payload.confidence ?? 0.72, 0.72),
    score: clampMemoryScore(payload.score ?? payload.confidence ?? 0.5, 0.5),
    status: payload.status ?? 'active',
    origin: payload.origin ?? 'manual',
    pinned: Boolean(payload.pinned),
    disabled: Boolean(payload.disabled),
    embeddingText: String(payload.embeddingText || '').trim() || buildMemoryEmbeddingText(payload),
    lastUsedAt: payload.lastUsedAt ?? null,
    createdAt: now,
    updatedAt: now
  };
}
