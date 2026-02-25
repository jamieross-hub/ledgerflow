import { beforeEach, describe, expect, it } from 'vitest';
import { useAiSettings } from './useAiSettings';

const AI_SETTINGS_KEY = 'ledgerflow-ai-settings';
const AI_SETTINGS_API_KEY_SESSION_KEY = 'ledgerflow-ai-settings-api-key';

describe('useAiSettings', () => {
  beforeEach(() => {
    localStorage.removeItem(AI_SETTINGS_KEY);
    sessionStorage.removeItem(AI_SETTINGS_API_KEY_SESSION_KEY);
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

  it('stores API Key in sessionStorage instead of localStorage', () => {
    useAiSettings.getState().setApiKey('  sk-test-session  ');

    expect(sessionStorage.getItem(AI_SETTINGS_API_KEY_SESSION_KEY)).toBe('sk-test-session');

    const persisted = localStorage.getItem(AI_SETTINGS_KEY) || '';
    expect(persisted).not.toContain('sk-test-session');
  });

  it('clears session API Key when setApiKey receives empty string', () => {
    useAiSettings.getState().setApiKey('sk-temp');
    expect(sessionStorage.getItem(AI_SETTINGS_API_KEY_SESSION_KEY)).toBe('sk-temp');

    useAiSettings.getState().setApiKey('   ');
    expect(sessionStorage.getItem(AI_SETTINGS_API_KEY_SESSION_KEY)).toBeNull();
  });
});
