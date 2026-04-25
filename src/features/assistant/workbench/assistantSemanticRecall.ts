import { buildGlobalMemoryRecallContext } from '../memory/globalMemoryRecall';
import {
  buildSemanticRecallContext,
  clearSemanticRecallCache,
  getSemanticRecallCacheMeta,
  type SemanticRecallHit
} from './semanticRecall';
import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionItem } from '../../../entities/transaction/types';
import type { GlobalMemoryItem } from '../../../shared/store/globalMemory';

export interface EmbeddingRecallDebug {
  enabled: boolean;
  model: string;
  used: boolean;
  downgraded: boolean;
  reason: string;
  latencyMs: number;
  indexedDocs: number;
  hitCount: number;
  topScore: number;
  averageScore: number;
  hits: SemanticRecallHit[];
}

export interface SemanticRecallCacheMeta {
  exists: boolean;
  model: string;
  updatedAt: number;
  indexedDocs: number;
}

export interface BlockingSemanticRecallResult {
  debug: EmbeddingRecallDebug;
  semanticContext: string;
  globalMemoryContext: string;
}

export function createIdleEmbeddingDebug(model = ''): EmbeddingRecallDebug {
  return {
    enabled: false,
    model,
    used: false,
    downgraded: false,
    reason: '',
    latencyMs: 0,
    indexedDocs: 0,
    hitCount: 0,
    topScore: 0,
    averageScore: 0,
    hits: []
  };
}

export function createSemanticRecallMeta(model = ''): SemanticRecallCacheMeta {
  return {
    exists: false,
    model,
    updatedAt: 0,
    indexedDocs: 0
  };
}

export function createEmptyBlockingSemanticRecallResult(model = ''): BlockingSemanticRecallResult {
  return {
    debug: createIdleEmbeddingDebug(model),
    semanticContext: '',
    globalMemoryContext: ''
  };
}

export function readSemanticRecallCacheMeta(baseUrl: string, model: string): SemanticRecallCacheMeta {
  if (!baseUrl.trim() || !model.trim()) return createSemanticRecallMeta(model.trim());
  return getSemanticRecallCacheMeta(baseUrl, model.trim());
}

export function clearSemanticRecallIndexCache(baseUrl: string, model: string) {
  if (!baseUrl.trim() || !model.trim()) return false;
  clearSemanticRecallCache(baseUrl, model.trim());
  return true;
}

export async function runBlockingSemanticRecall(params: {
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
  rerankModel: string;
  enableEmbeddingModel: boolean;
  enableRerankModel: boolean;
  question: string;
  transactions: TransactionItem[];
  categories: Category[];
  accounts: Account[];
  globalMemories: GlobalMemoryItem[];
  signal?: AbortSignal;
}): Promise<BlockingSemanticRecallResult> {
  const {
    baseUrl,
    apiKey,
    embeddingModel,
    rerankModel,
    enableEmbeddingModel,
    enableRerankModel,
    question,
    transactions,
    categories,
    accounts,
    globalMemories,
    signal
  } = params;

  const cleanPrompt = question.trim();
  const debugBase = {
    ...createIdleEmbeddingDebug(embeddingModel.trim()),
    enabled: enableEmbeddingModel && Boolean(embeddingModel.trim())
  };

  if (!(enableEmbeddingModel && embeddingModel.trim() && cleanPrompt)) {
    return {
      debug: {
        ...debugBase,
        reason: !enableEmbeddingModel ? 'disabled' : !embeddingModel.trim() ? 'model-empty' : 'empty-question'
      },
      semanticContext: '',
      globalMemoryContext: ''
    };
  }

  const startedAt = performance.now();

  try {
    const [recall, memoryRecall] = await Promise.all([
      buildSemanticRecallContext({
        baseUrl,
        apiKey,
        model: embeddingModel,
        question: cleanPrompt,
        transactions,
        categories,
        accounts,
        signal
      }),
      buildGlobalMemoryRecallContext({
        baseUrl,
        apiKey,
        embeddingModel,
        rerankModel,
        enableRerankModel,
        question: cleanPrompt,
        memories: globalMemories,
        signal
      }).catch(() => null)
    ]);

    const semanticContext = recall?.context || '';
    const globalMemoryContext = memoryRecall?.context || '';
    const used = Boolean(semanticContext || globalMemoryContext);

    if (used) {
      return {
        debug: {
          enabled: true,
          model: embeddingModel.trim(),
          used: true,
          downgraded: false,
          reason: '',
          latencyMs: recall?.latencyMs || Math.round(performance.now() - startedAt),
          indexedDocs: recall?.indexedDocs || transactions.length,
          hitCount: recall?.hitCount || 0,
          topScore: recall?.topScore || 0,
          averageScore: recall?.averageScore || 0,
          hits: recall?.hits || []
        },
        semanticContext,
        globalMemoryContext
      };
    }

    return {
      debug: {
        enabled: true,
        model: embeddingModel.trim(),
        used: false,
        downgraded: false,
        reason: 'no-hit',
        latencyMs: Math.round(performance.now() - startedAt),
        indexedDocs: recall?.indexedDocs || transactions.length,
        hitCount: 0,
        topScore: 0,
        averageScore: 0,
        hits: []
      },
      semanticContext: '',
      globalMemoryContext: ''
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;

    return {
      debug: {
        enabled: true,
        model: embeddingModel.trim(),
        used: false,
        downgraded: true,
        reason: error instanceof Error ? error.message : 'semantic recall downgraded',
        latencyMs: Math.round(performance.now() - startedAt),
        indexedDocs: 0,
        hitCount: 0,
        topScore: 0,
        averageScore: 0,
        hits: []
      },
      semanticContext: '',
      globalMemoryContext: ''
    };
  }
}
