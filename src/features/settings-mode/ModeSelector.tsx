import { useAppPreferences } from '../../shared/store/useAppPreferences';

export function ModeSelector() {
  const mode = useAppPreferences((s) => s.mode);
  const setMode = useAppPreferences((s) => s.setMode);

  return (
    <section className="panel">
      <h3>数据库连接测试模式</h3>
      <div className="row">
        <label>
          <input
            type="radio"
            name="app-mode"
            checked={mode === 'mock'}
            onChange={() => setMode('mock')}
          />
          纯前端 Mock 模式
        </label>
        <label>
          <input
            type="radio"
            name="app-mode"
            checked={mode === 'proxy'}
            onChange={() => setMode('proxy')}
          />
          代理模式（/api/conn/*）
        </label>
      </div>
      <p className="error">
        安全提示：浏览器无法安全保存数据库凭证，生产环境必须通过后端代理访问数据库。
      </p>
    </section>
  );
}
