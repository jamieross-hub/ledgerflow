import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAiModels } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { Toast } from '../../shared/ui/Toast';

const MODEL_PRESETS = [
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

interface ModelSelectorProps {
  label: string;
  hint: string;
  value: string;
  presets: string[];
  remoteModels: string[];
  loading: boolean;
  onRefresh: () => void;
  onChange: (value: string) => void;
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
  onChange
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
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="settings-model-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '拉取中…' : '刷新模型'}
        </button>
      </div>
      <input
        value={value}
        placeholder="可手动输入模型名称"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const embeddingModel = useAiSettings((s) => s.embeddingModel);
  const enableEmbeddingModel = useAiSettings((s) => s.enableEmbeddingModel);
  const rerankModel = useAiSettings((s) => s.rerankModel);
  const enableRerankModel = useAiSettings((s) => s.enableRerankModel);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setModel = useAiSettings((s) => s.setModel);
  const setEmbeddingModel = useAiSettings((s) => s.setEmbeddingModel);
  const setEnableEmbeddingModel = useAiSettings((s) => s.setEnableEmbeddingModel);
  const setRerankModel = useAiSettings((s) => s.setRerankModel);
  const setEnableRerankModel = useAiSettings((s) => s.setEnableRerankModel);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const setMemoryDays = useAiSettings((s) => s.setMemoryDays);
  const setMemoryBackend = useAiSettings((s) => s.setMemoryBackend);

  const [masked, setMasked] = useState(true);
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
      setModelLoadError('请先填写 Base URL，再拉取模型列表。');
      return;
    }
    setModelLoading(true);
    setModelLoadError('');
    try {
      const remote = await fetchAiModels(baseUrl, apiKey);
      setModelOptions(remote);
      if (remote.length === 0) {
        setModelLoadError('模型列表为空，已回退到本地预设。');
      }
    } catch (error) {
      setModelLoadError(error instanceof Error ? error.message : '模型列表拉取失败');
      setModelOptions([]);
    } finally {
      setModelLoading(false);
    }
  }, [apiKey, baseUrl]);

  const handleSelectModel = (setter: (value: string) => void, value: string) => {
    setter(value.trim());
    showSaveToast();
  };

  return (
    <div>
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>AI 渠道设置（OpenAI 兼容）</h2>
          <button type="button" onClick={() => navigate(-1)}>
            ← 返回
          </button>
        </div>
        <p style={{ marginTop: 16 }}>
          同一套 Base URL + API Key 可复用于对话、嵌入、重排序，便于账单检索与趋势分析场景统一接入。
        </p>

        <div className="field">
          <label>供应商 Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              showSaveToast();
            }}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="field">
          <label>API Key</label>
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
            {masked ? '👁 显示' : '🙈 隐藏'}
          </button>
        </div>

        <div className="settings-model-grid">
          <ModelSelector
            label="默认对话模型"
            hint="用于 AI 助手、趋势洞察等主流程。"
            value={model}
            presets={MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setModel, value)}
          />
          <ModelSelector
            label="嵌入模型"
            hint="用于账单向量化检索与语义召回。"
            value={embeddingModel}
            presets={EMBEDDING_MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setEmbeddingModel, value)}
          />
          <ModelSelector
            label="重排序模型"
            hint="用于检索结果重排，提高命中准确度。"
            value={rerankModel}
            presets={RERANK_MODEL_PRESETS}
            remoteModels={modelOptions}
            loading={modelLoading}
            onRefresh={() => void refreshModels()}
            onChange={(value) => handleSelectModel(setRerankModel, value)}
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
            启用嵌入模型
          </label>
          <small>关闭后将跳过嵌入模型相关流程（并在调试日志中记录）。</small>
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
            启用重排序模型
          </label>
          <small>关闭后将跳过重排序模型相关流程（并在调试日志中记录）。</small>
        </div>

        <div className="field">
          <label>助手记忆时长（天）</label>
          <select
            value={memoryDays}
            onChange={(e) => {
              setMemoryDays(Number(e.target.value));
              showSaveToast();
            }}
          >
            <option value={1}>1 天</option>
            <option value={2}>2 天</option>
            <option value={3}>3 天</option>
          </select>
        </div>

        <div className="field">
          <label>记忆后端</label>
          <select
            value={memoryBackend}
            onChange={(e) => {
              setMemoryBackend(e.target.value === 'redis' ? 'redis' : 'local');
              showSaveToast();
            }}
          >
            <option value="local">本地（默认）</option>
            <option value="redis">Redis（占位，待后端接入）</option>
          </select>
        </div>
      </section>

      <Toast
        visible={toastVisible}
        variant="success"
        message="设置已自动保存"
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
