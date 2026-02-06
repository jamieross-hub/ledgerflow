import { ConnectionConfigManager } from '../../features/connection-config/ui/ConnectionConfigManager';
import { ModeSelector } from '../../features/settings-mode/ModeSelector';
import { useAppPreferences } from '../../shared/store/useAppPreferences';
import { usePwaInstallPrompt } from '../../shared/hooks/usePwaInstallPrompt';

export function SettingsPage() {
  const theme = useAppPreferences((s) => s.theme);
  const setTheme = useAppPreferences((s) => s.setTheme);
  const language = useAppPreferences((s) => s.language);
  const setLanguage = useAppPreferences((s) => s.setLanguage);
  const mode = useAppPreferences((s) => s.mode);
  const { canInstall, triggerInstall } = usePwaInstallPrompt();

  return (
    <div>
      <section className="panel">
        <h2>设置</h2>
        <div className="row">
          <label>主题</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>

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

      <ModeSelector />
      <ConnectionConfigManager mode={mode} />
    </div>
  );
}
