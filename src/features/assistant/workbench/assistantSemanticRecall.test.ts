import { describe, expect, it, vi } from 'vitest';

vi.mock('./semanticRecall', () => ({
  buildSemanticRecallContext: vi.fn(),
  clearSemanticRecallCache: vi.fn(),
  getSemanticRecallCacheMeta: vi.fn(() => ({
    exists: false,
    model: '',
    updatedAt: 0,
    indexedDocs: 0
  }))
}));

vi.mock('../memory/globalMemoryRecall', () => ({
  buildGlobalMemoryRecallContext: vi.fn()
}));

import { buildGlobalMemoryRecallContext } from '../memory/globalMemoryRecall';
import { buildSemanticRecallContext } from './semanticRecall';
import { runBlockingSemanticRecall } from './assistantSemanticRecall';

describe('assistantSemanticRecall', () => {
  it('returns both semantic recall and global memory contexts', async () => {
    vi.mocked(buildSemanticRecallContext).mockResolvedValue({
      context: '1. [similarity 0.91] coffee expense',
      hitCount: 1,
      topScore: 0.91,
      averageScore: 0.91,
      latencyMs: 12,
      indexedDocs: 5,
      hits: [{ id: 'tx-1', score: 0.91, text: 'coffee expense' }]
    });
    vi.mocked(buildGlobalMemoryRecallContext).mockResolvedValue({
      context: '1. [user_preference] monthly summary: prefers concise reports',
      hits: []
    });

    const result = await runBlockingSemanticRecall({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      embeddingModel: 'embed-model',
      rerankModel: 'rerank-model',
      enableEmbeddingModel: true,
      enableRerankModel: true,
      question: 'analyze my recent spending',
      transactions: [],
      categories: [],
      accounts: [],
      globalMemories: []
    });

    expect(result.debug.used).toBe(true);
    expect(result.semanticContext).toContain('coffee expense');
    expect(result.globalMemoryContext).toContain('prefers concise reports');
  });

  it('keeps memory recall usable even when transaction recall has no hit', async () => {
    vi.mocked(buildSemanticRecallContext).mockResolvedValue(null);
    vi.mocked(buildGlobalMemoryRecallContext).mockResolvedValue({
      context: '1. [financial_habit] reviews spending every weekend',
      hits: []
    });

    const result = await runBlockingSemanticRecall({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      embeddingModel: 'embed-model',
      rerankModel: 'rerank-model',
      enableEmbeddingModel: true,
      enableRerankModel: true,
      question: 'what should I focus on this week',
      transactions: [],
      categories: [],
      accounts: [],
      globalMemories: []
    });

    expect(result.debug.used).toBe(true);
    expect(result.debug.hitCount).toBe(0);
    expect(result.semanticContext).toBe('');
    expect(result.globalMemoryContext).toContain('reviews spending every weekend');
  });
});
