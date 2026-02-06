import { ConnectionConfigManager } from '../../features/connection-config/ui/ConnectionConfigManager';
import { ModeSelector } from '../../features/settings-mode/ModeSelector';
import { useAppPreferences } from '../../shared/store/useAppPreferences';

export function DatabaseSettingsPage() {
  const mode = useAppPreferences((s) => s.mode);

  return (
    <div>
      <section className="panel">
        <h2>数据库设置</h2>
        <p>在此配置 PostgreSQL / MySQL / Redis 连接，并可切换 Mock / 代理模式进行测试。</p>
      </section>

      <ModeSelector />
      <ConnectionConfigManager mode={mode} />
    </div>
  );
}
