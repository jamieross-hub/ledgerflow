import { formatDateTime } from '../../../shared/lib/format';
import { useDebugLogStore } from '../../../shared/store/useDebugLogStore';

export function DebugLogPanel() {
  const logs = useDebugLogStore((s) => s.logs);
  const clearLogs = useDebugLogStore((s) => s.clearLogs);

  return (
    <section className="panel debug-log-panel">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>首页调试日志</h3>
        <button type="button" onClick={clearLogs} disabled={logs.length === 0}>
          清空日志
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="debug-log-empty">暂无调试日志</p>
      ) : (
        <div className="debug-log-scroll" aria-label="调试日志滚动容器">
          {logs
            .slice()
            .reverse()
            .map((item) => (
              <article key={item.id} className={`debug-log-item debug-${item.status}`}>
                <div className="debug-log-meta">
                  <span className="mono-inline">{formatDateTime(item.timestamp)}</span>
                  <span className="badge badge-primary">{item.action}</span>
                  {item.dbType ? <span className="badge">{item.dbType.toUpperCase()}</span> : null}
                </div>
                <p>{item.message}</p>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
