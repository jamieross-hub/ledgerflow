import { beforeEach, describe, expect, it } from 'vitest';
import { useAiSettings } from './useAiSettings';

describe('useAiSettings', () => {
  beforeEach(() => {
    localStorage.removeItem('ledgerflow-ai-settings');
    useAiSettings.setState({
      baseUrl: 'https://ai.shuaihong.fun/v1',
      apiKey: '',
      model: 'gemini-2.5-flash-lite',
      embeddingModel: 'text-embedding-3-small',
      enableEmbeddingModel: true,
      rerankModel: 'bge-reranker-v2-m3',
      enableRerankModel: true,
      memoryDays: 3,
      memoryBackend: 'local',
      bulkRecategorizeConcurrency: 4
    });
  });

  it('limits bulk recategorization concurrency into supported range', () => {
    useAiSettings.getState().setBulkRecategorizeConcurrency(0);
    expect(useAiSettings.getState().bulkRecategorizeConcurrency).toBe(1);

    useAiSettings.getState().setBulkRecategorizeConcurrency(20);
    expect(useAiSettings.getState().bulkRecategorizeConcurrency).toBe(12);
  });
});
