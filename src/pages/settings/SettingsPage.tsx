import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePwaInstallPrompt } from '../../shared/hooks/usePwaInstallPrompt';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { Toast } from '../../shared/ui/Toast';

/** 常用模型预设列表 */
const MODEL_PRESETS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gemini-2.5-flash-lite',
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

export function SettingsPage() {
  const navigate = useNavigate();
  const { canInstall, triggerInstall } = usePwaInstallPrompt();

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setModel = useAiSettings((s) => s.setModel);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const setMemoryDays = useAiSettings((s) => s.setMemoryDays);
  const setMemoryBackend = useAiSettings((s) => s.setMemoryBackend);

  const [masked, setMasked] = useState(true);
  const [customModel, setCustomModel] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // 用于防抖自动保存提示
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveToast = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      setToastVisible(true);
    }, 300);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const isPreset = MODEL_PRESETS.includes(model);

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    showSaveToast();
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    showSaveToast();
  };

  const handleModelSelect = (value: string) => {
    if (value === '__custom__') {
      setCustomModel('');
      return;
    }
    setModel(value);
    setCustomModel('');
    showSaveToast();
  };

  const handleCustomModelConfirm = () => {
    const trimmed = customModel.trim();
    if (trimmed) {
      setModel(trimmed);
      showSaveToast();
    }
  };

  return (
    <div>
      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>通用设置</h2>
          <button type="button" onClick={() => navigate(-1)}>
            ← 返回
          </button>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>界面语言</label>
          <div className="row">
            <span>简体中文</span>
            <button disabled={!canInstall} onClick={() => void triggerInstall()}>
              {canInstall ? '安装 PWA' : '当前不可安装'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>AI 模型设置</h2>
        <p>统一在这里维护供应商地址、API Key 与默认模型。助手页将自动读取。修改即自动保存。</p>

        <div className="field">
          <label>供应商 Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="field">
          <label>API Key</label>
          <input
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="sk-..."
            type={masked ? 'password' : 'text'}
          />
          <button type="button" onClick={() => setMasked((v) => !v)} style={{ justifySelf: 'start' }}>
            {masked ? '👁 显示' : '🙈 隐藏'}
          </button>
        </div>

        <div className="field">
          <label>默认模型</label>
          <select
            value={isPreset ? model : '__custom__'}
            onChange={(e) => handleModelSelect(e.target.value)}
          >
            <optgroup label="常用模型">
              {MODEL_PRESETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </optgroup>
            <optgroup label="其他">
              <option value="__custom__">自定义模型...</option>
            </optgroup>
          </select>
        </div>

        {(!isPreset || customModel !== undefined) && !isPreset ? (
          <div className="field">
            <label>自定义模型名称</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                value={customModel || (!isPreset ? model : '')}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="输入自定义模型名称，如 my-model-v1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomModelConfirm();
                  }
                }}
              />
              <button type="button" onClick={handleCustomModelConfirm}>
                确认
              </button>
            </div>
          </div>
        ) : null}

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

        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-surface-alt, #f5f5f5)', borderRadius: 6, fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
          <strong>当前模型：</strong>{model || '未设置'}<br />
          <strong>记忆配置：</strong>{memoryDays} 天 · {memoryBackend === 'redis' ? 'Redis（占位）' : '本地'}
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
