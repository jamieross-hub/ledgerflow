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
        <ul style={{ marginTop: 10, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <li>新增表单默认展开，可直接填写主机、端口、用户名、密码等字段。</li>
          <li>密码与连接串不会以明文持久化到浏览器存储。</li>
          <li>建议仅在可信设备保存连接配置，并定期轮换数据库密码。</li>
        </ul>
      </section>

      <ModeSelector />
      <ConnectionConfigManager mode={mode} />
    </div>
  );
}
