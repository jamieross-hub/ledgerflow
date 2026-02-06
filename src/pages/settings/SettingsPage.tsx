import { useState } from 'react';
import { usePwaInstallPrompt } from '../../shared/hooks/usePwaInstallPrompt';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useAppPreferences } from '../../shared/store/useAppPreferences';

export function SettingsPage() {
  const language = useAppPreferences((s) => s.language);
  const setLanguage = useAppPreferences((s) => s.setLanguage);
  const { canInstall, triggerInstall } = usePwaInstallPrompt();

  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setModel = useAiSettings((s) => s.setModel);

  const [masked, setMasked] = useState(true);

  return (
    <div>
      <section className="panel">
        <h2>设置</h2>
        <div className="row">
          <label>语言</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value as 'zh-CN' | 'en-US')}>
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>

          <button disabled={!canInstall} onClick={() => void triggerInstall()}>
            {canInstall ? '安装 PWA' : '当前不可安装'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>OpenAI 兼容设置</h3>
        <p>统一在这里维护供应商地址、API Key 与默认模型。助手页将自动读取。</p>

        <div className="field">
          <label>供应商 Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://ai.shuaihong.fun/v1"
          />
        </div>

        <div className="field">
          <label>API Key</label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            type={masked ? 'password' : 'text'}
          />
          <div className="row">
            <button type="button" onClick={() => setMasked((v) => !v)}>
              {masked ? '显示 API Key' : '隐藏 API Key'}
            </button>
          </div>
        </div>

        <div className="field">
          <label>默认模型</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </div>
      </section>
    </div>
  );
}
