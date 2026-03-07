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

const GLOBAL_MEMORY_TYPES: GlobalMemoryType[] = [
  'user_preference',
  'financial_habit',
  'risk_preference',
  'display_preference'
];

const GLOBAL_MEMORY_SOURCES: GlobalMemorySourceKind[] = [
  'assistant_chat',
  'bookkeeping_action',
  'repayment_behavior',
  'budget_behavior',
  'settings_change',
  'manual'
];

const GLOBAL_MEMORY_STATUSES: GlobalMemoryStatus[] = ['active', 'archived'];
const GLOBAL_MEMORY_ORIGINS: GlobalMemoryOrigin[] = ['manual', 'extracted', 'inferred'];

export function clampMemoryScore(value: number, fallback: number): number {
  const next = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, next));
}

export function buildMemoryEmbeddingText(payload: Pick<GlobalMemoryDraft, 'title' | 'content' | 'type'>) {
  return [payload.title, payload.content, payload.type]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
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

export function sanitizePersistedGlobalMemoryItem(value: unknown, index = 0): GlobalMemoryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const input = value as Partial<GlobalMemoryItem>;
  const type = GLOBAL_MEMORY_TYPES.includes(input.type as GlobalMemoryType)
    ? (input.type as GlobalMemoryType)
    : 'user_preference';
  const source = GLOBAL_MEMORY_SOURCES.includes(input.source as GlobalMemorySourceKind)
    ? (input.source as GlobalMemorySourceKind)
    : 'manual';

  const normalized = normalizeGlobalMemoryDraft({
    title: String(input.title || '').trim() || `记忆 ${index + 1}`,
    content: String(input.content || '').trim() || '历史记忆内容缺失，已自动兼容。',
    type,
    source,
    sourceTrace: Array.isArray(input.sourceTrace) ? input.sourceTrace : [],
    sourceIds: Array.isArray(input.sourceIds) ? input.sourceIds.filter(Boolean) : [],
    confidence: typeof input.confidence === 'number' ? input.confidence : 0.72,
    score:
      typeof input.score === 'number'
        ? input.score
        : typeof input.confidence === 'number'
          ? input.confidence
          : 0.5,
    status: GLOBAL_MEMORY_STATUSES.includes(input.status as GlobalMemoryStatus)
      ? (input.status as GlobalMemoryStatus)
      : 'active',
    origin: GLOBAL_MEMORY_ORIGINS.includes(input.origin as GlobalMemoryOrigin)
      ? (input.origin as GlobalMemoryOrigin)
      : 'manual',
    pinned: Boolean(input.pinned),
    disabled: Boolean(input.disabled),
    embeddingText: String(input.embeddingText || '').trim(),
    lastUsedAt: typeof input.lastUsedAt === 'string' ? input.lastUsedAt : null
  });

  return {
    ...normalized,
    id: String(input.id || `memory-legacy-${index}`),
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : normalized.createdAt,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : normalized.updatedAt
  };
}
