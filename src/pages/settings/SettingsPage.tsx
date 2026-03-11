import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchAiModels } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { AppAccentTheme } from '../../shared/types/app';
import { Toast } from '../../shared/ui/Toast';

const AI_PROVIDER_PRESETS = [
  { value: 'https://api.openai.com/v1', label: 'OpenAI' },
  { value: 'https://generativelanguage.googleapis.com/v1beta/openai', label: 'Gemini' },
  { value: 'https://api.deepseek.com/v1', label: 'DeepSeek' },
  { value: 'https://openrouter.ai/api/v1', label: 'OpenRouter' },
  { value: 'https://api.siliconflow.cn/v1', label: '硅基流动' }
] as const;

const MODEL_PRESETS = [
  'gpt-5.2',
  'gemini-2.5-flash-lite',
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'deepseek-chat',
  'deepseek-reasoner',
  'qwen-turbo',
  'qwen-plus',
  'glm-4-flash'
];

const EMBEDDING_MODEL_PRESETS = [
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-v4',
  'bge-m3',
  'gte-Qwen2-7B-instruct'
];

const RERANK_MODEL_PRESETS = [
  'bge-reranker-v2-m3',
  'bge-reranker-large',
  'gte-rerank-v2',
  'cohere-rerank-3.5'
];

const ACCENT_THEME_OPTIONS: Array<{ value: AppAccentTheme; labelKey: string; preview: string }> = [
  { value: 'blue', labelKey: 'settings.accent.options.blue', preview: '#4f6ef7' },
  { value: 'emerald', labelKey: 'settings.accent.options.emerald', preview: '#10b981' },
  { value: 'violet', labelKey: 'settings.accent.options.violet', preview: '#8b5cf6' },
  { value: 'rose', labelKey: 'settings.accent.options.rose', preview: '#f43f5e' },
  { value: 'amber', labelKey: 'settings.accent.options.amber', preview: '#f59e0b' }
];

interface ModelSelectorProps {
  label: string;
  hint: string;
  value: string;
  presets: string[];
  remoteModels: string[];
  loading: boolean;
  onRefresh: () => void;
  onChange: (value: string) => void;
  loadingText: string;
  refreshText: string;
}

function getModelDisplayLabel(modelId: string): string {
  const value = modelId.trim();
  if (!value) return value;
  return value === 'gpt-5.2' ? `${value}（推荐）` : value;
}

function mergeModelOptions(value: string, presets: string[], remoteModels: string[]): string[] {
  const uniq = new Set<string>();
  const options = [value, ...remoteModels, ...presets]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (uniq.has(item)) return false;
      uniq.add(item);
      return true;
    });
  return options;
}

function ModelSelector({
  label,
  hint,
  value,
  presets,
  remoteModels,
  loading,
  onRefresh,
  onChange,
  loadingText,
  refreshText
}: ModelSelectorProps) {
  const options = useMemo(
    () => mergeModelOptions(value, presets, remoteModels),
    [value, presets, remoteModels]
  );

  return (
    <div className="field settings-model-field">
      <label>{label}</label>
      <small>{hint}</small>
      <div className="settings-model-select-row">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((item) => (
            <option key={item} value={item}>
              {getModelDisplayLabel(item)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="settings-model-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? loadingText : refreshText}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const accentTheme = useAppPreferences((s) => s.accentTheme);
  const embeddingModel = useAiSettings((s) => s.embeddingModel);
  const enableEmbeddingModel = useAiSettings((s) => s.enableEmbeddingModel);
  const rerankModel = useAiSettings((s) => s.rerankModel);
  const enableRerankModel = useAiSettings((s) => s.enableRerankModel);
  const rememberApiKey = useAiSettings((s) => s.rememberApiKey);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setRememberApiKey = useAiSettings((s) => s.setRememberApiKey);
  const setModel = useAiSettings((s) => s.setModel);
  const setAccentTheme = useAppPreferences((s) => s.setAccentTheme);
  const setEmbeddingModel = useAiSettings((s) => s.setEmbeddingModel);
  const setEnableEmbeddingModel = useAiSettings((s) => s.setEnableEmbeddingModel);
  const setRerankModel = useAiSettings((s) => s.setRerankModel);
  const setEnableRerankModel = useAiSettings((s) => s.setEnableRerankModel);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const showEmbeddingDebug = useAiSettings((s) => s.showEmbeddingDebug);
  const showEmbeddingSummary = useAiSettings((s) => s.showEmbeddingSummary);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const bulkRecategorizeConcurrency = useAiSettings((s) => s.bulkRecategorizeConcurrency);
  const setMemoryDays = useAiSettings((s) => s.setMemoryDays);
  const setShowEmbeddingDebug = useAiSettings((s) => s.setShowEmbeddingDebug);
  const setShowEmbeddingSummary = useAiSettings((s) => s.setShowEmbeddingSummary);
  const setMemoryBackend = useAiSettings((s) => s.setMemoryBackend);
  const setBulkRecategorizeConcurrency = useAiSettings((s) => s.setBulkRecategorizeConcurrency);

  const [masked, setMasked] = useState(true);
  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'zh';
  const [toastVisible, setToastVisible] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveToast = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      setToastVisible(true);
    }, 260);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const refreshModels = useCallback(async () => {
    if (!baseUrl) {
      setModelLoadError(t('settings.model.errorMissingBaseUrl'));
      return;
    }
    setModelLoading(true);
    setModelLoadError('');
    try {
      const remote = await fetchAiModels(baseUrl, apiKey);
      setModelOptions(remote);
      if (remote.length === 0) {
        setModelLoadError(t('settings.model.errorEmptyList'));
      }
    } catch (error) {
      setModelLoadError(error instanceof Error ? error.message : t('settings.model.errorFetchFailed'));
      setModelOptions([]);
    } finally {
      setModelLoading(false);
    }
  }, [apiKey, baseUrl, t]);

  const handleSelectModel = (setter: (value: string) => void, value: string) => {
    setter(value.trim());
    showSaveToast();
  };

  return (
    <div>
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('settings.title')}</h2>
          <button type="button" onClick={() => navigate(-1)}>
            {t('settings.back')}
          </button>
        </div>
        <p style={{ marginTop: 16 }}>{t('settings.intro')}</p>

        <div className="field">
          <label>{t('settings.baseUrl')}</label>
          <div className="settings-baseurl-row">
            <select
              value=""
              onChange={(e) => {
                const next = e.target.value;
                if (!next) return;
                setBaseUrl(next);
                showSaveToast();
              }}
            >
              <option value="">选择渠道商（快速填充）</option>
              {AI_PROVIDER_PRESETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                showSaveToast();
              }}
              placeholder="https://api.openai.com/v1"
            />
          </div>
        </div>

        <div className="field">
          <label>{t('settings.apiKey')}</label>
          <input
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              showSaveToast();
            }}
            placeholder="sk-..."
            type={masked ? 'password' : 'text'}
          />
          <button
            type="button"
            onClick={() => setMasked((v) => !v)}
            style={{ justifySelf: 'start' }}
          >
            {masked ? t('settings.show') : t('settings.hide')}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberApiKey}
              onChange={(e) => {
                setRememberApiKey(e.target.checked);
                showSaveToast();
              }}
            />
            记住 API Key（版本更新后无需重填）
          </label>
          <small>
            开启后会将 API Key 持久保存在当前浏览器；关闭时仅保留在当前会话。
          </small>
        </div>

        <div className="field">
          <label>{t('settings.language.label')}</label>
          <select
            value={currentLanguage}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value === 'en' ? 'en' : 'zh');
              showSaveToast();
            }}
          >
            <option value="zh">{t('settings.language.zh')}</option>
            <option value="en">{t('settings.language.en')}</option>
          </select>
          <small>{t('settings.language.hint')}</small>
        </div>

        <div className="field">
          <label>{t('settings.accent.label')}</label>
          <div className="settings-accent-grid" role="radiogroup" aria-label={t('settings.accent.label')}>
            {ACCENT_THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`settings-accent-option ${accentTheme === option.value ? 'active' : ''}`}
                onClick={() => {
                  setAccentTheme(option.value);
                  showSaveToast();
                }}
                role="radio"
                aria-checked={accentTheme === option.value}
              >
                <span className="settings-accent-dot" style={{ background: option.preview }} />
                <span>{t(option.labelKey)}</span>
              </button>
            ))}
          </div>
          <small>{t('settings.accent.hint')}</small>
        </div>

        <div className="settings-model-grid">
          <ModelSelector
            label={t('settings.model.defaultLabel')}
            hint={t('settings.model.defaultHint')}
            value={model}
            presets={MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setModel, value)}
            loadingText={t('settings.model.refreshing')}
            refreshText={t('settings.model.refresh')}
          />
          <ModelSelector
            label={t('settings.model.embeddingLabel')}
            hint={t('settings.model.embeddingHint')}
            value={embeddingModel}
            presets={EMBEDDING_MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setEmbeddingModel, value)}
            loadingText={t('settings.model.refreshing')}
            refreshText={t('settings.model.refresh')}
          />
          <ModelSelector
            label={t('settings.model.rerankLabel')}
            hint={t('settings.model.rerankHint')}
            value={rerankModel}
            presets={RERANK_MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setRerankModel, value)}
            loadingText={t('settings.model.refreshing')}
            refreshText={t('settings.model.refresh')}
          />
        </div>
        {modelLoadError ? <p className="settings-model-error">{modelLoadError}</p> : null}

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enableEmbeddingModel}
              onChange={(e) => {
                setEnableEmbeddingModel(e.target.checked);
                showSaveToast();
              }}
            />
            {t('settings.embeddingToggle.label')}
          </label>
          <small>{t('settings.embeddingToggle.hint')}</small>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enableRerankModel}
              onChange={(e) => {
                setEnableRerankModel(e.target.checked);
                showSaveToast();
              }}
            />
            {t('settings.rerankToggle.label')}
          </label>
          <small>{t('settings.rerankToggle.hint')}</small>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showEmbeddingSummary}
              onChange={(e) => {
                setShowEmbeddingSummary(e.target.checked);
                showSaveToast();
              }}
            />
            {t('settings.embeddingSummaryToggle.label')}
          </label>
          <small>{t('settings.embeddingSummaryToggle.hint')}</small>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showEmbeddingDebug}
              onChange={(e) => {
                setShowEmbeddingDebug(e.target.checked);
                showSaveToast();
              }}
            />
            {t('settings.embeddingDebugToggle.label')}
          </label>
          <small>{t('settings.embeddingDebugToggle.hint')}</small>
        </div>

        <div className="field">
          <label>{t('settings.memoryDays.label')}</label>
          <select
            value={memoryDays}
            onChange={(e) => {
              setMemoryDays(Number(e.target.value));
              showSaveToast();
            }}
          >
            <option value={1}>{t('settings.memoryDays.d1')}</option>
            <option value={2}>{t('settings.memoryDays.d2')}</option>
            <option value={3}>{t('settings.memoryDays.d3')}</option>
          </select>
        </div>

        <div className="field">
          <label>{t('settings.memoryBackend.label')}</label>
          <select
            value={memoryBackend}
            onChange={(e) => {
              setMemoryBackend(e.target.value === 'redis' ? 'redis' : 'local');
              showSaveToast();
            }}
          >
            <option value="local">{t('settings.memoryBackend.local')}</option>
            <option value="redis">{t('settings.memoryBackend.redis')}</option>
          </select>
        </div>

        <div className="field">
          <label>{t('settings.bulkConcurrency.label')}</label>
          <div className="settings-concurrency-slider-row">
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={bulkRecategorizeConcurrency}
              onChange={(e) => {
                setBulkRecategorizeConcurrency(Number(e.target.value));
                showSaveToast();
              }}
              aria-label={t('settings.bulkConcurrency.aria')}
            />
            <strong>{bulkRecategorizeConcurrency}</strong>
          </div>
          <small>{t('settings.bulkConcurrency.hint')}</small>
        </div>
      </section>

      <section className="panel">
        <h2>{t('settings.privacy.title')}</h2>
        <ul>
          <li>{t('settings.privacy.l1')}</li>
          <li>{t('settings.privacy.l2')}</li>
          <li>{t('settings.privacy.l3')}</li>
          <li>{t('settings.privacy.l4')}</li>
        </ul>
      </section>

      <Toast
        visible={toastVisible}
        variant="success"
        message={t('settings.toastSaved')}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
