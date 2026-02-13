import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  onChange: (value: string) => void;
}

function ModelSelector({ label, hint, value, presets, onChange }: ModelSelectorProps) {
  const [presetOpen, setPresetOpen] = useState(false);

  return (
    <div className="field settings-model-field">
      <label>{label}</label>
      <small>{hint}</small>
      <div className="row settings-model-input-row">
        <input
          value={value}
          placeholder="输入模型名称"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="settings-presets-toggle"
        onClick={() => setPresetOpen((v) => !v)}
      >
        {presetOpen ? '收起预设模型' : '选择预设模型'}
      </button>
      {presetOpen ? (
        <div className="settings-model-chips">
          {presets.map((item) => (
            <button
              key={item}
              type="button"
              className={item === value ? 'active' : ''}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const embeddingModel = useAiSettings((s) => s.embeddingModel);
  const rerankModel = useAiSettings((s) => s.rerankModel);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setModel = useAiSettings((s) => s.setModel);
  const setEmbeddingModel = useAiSettings((s) => s.setEmbeddingModel);
  const setRerankModel = useAiSettings((s) => s.setRerankModel);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const setMemoryDays = useAiSettings((s) => s.setMemoryDays);
  const setMemoryBackend = useAiSettings((s) => s.setMemoryBackend);

  const [masked, setMasked] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
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
        <p>
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
            onChange={(value) => handleSelectModel(setModel, value)}
          />
          <ModelSelector
            label="嵌入模型"
            hint="用于账单向量化检索与语义召回。"
            value={embeddingModel}
            presets={EMBEDDING_MODEL_PRESETS}
            onChange={(value) => handleSelectModel(setEmbeddingModel, value)}
          />
          <ModelSelector
            label="重排序模型"
            hint="用于检索结果重排，提高命中准确度。"
            value={rerankModel}
            presets={RERANK_MODEL_PRESETS}
            onChange={(value) => handleSelectModel(setRerankModel, value)}
          />
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

        <div className="settings-ai-summary">
          <strong>当前配置</strong>
          <p>对话模型：{model || '未设置'}</p>
          <p>嵌入模型：{embeddingModel || '未设置'}</p>
          <p>重排序模型：{rerankModel || '未设置'}</p>
          <p>
            记忆配置：{memoryDays} 天 · {memoryBackend === 'redis' ? 'Redis（占位）' : '本地'}
          </p>
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
