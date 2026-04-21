export interface DashboardModuleCustomizerItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

export interface DashboardModuleCustomizerProps {
  title: string;
  hint: string;
  items: DashboardModuleCustomizerItem[];
  draggingModuleId: string | null;
  onDragStart: (moduleId: string) => void;
  onDrop: (moduleId: string) => void;
  onDragEnd: () => void;
  onToggle: (moduleId: string, checked: boolean) => void;
}

export function DashboardModuleCustomizer({
  title,
  hint,
  items,
  draggingModuleId,
  onDragStart,
  onDrop,
  onDragEnd,
  onToggle,
}: DashboardModuleCustomizerProps) {
  return (
    <section className="dashboard-module-customizer" aria-label={title}>
      <div className="dashboard-section-header">
        <h4>{title}</h4>
        <span>{hint}</span>
      </div>
      <div className="dashboard-module-manage-list" aria-label="模块配置列表">
        {items.map((item) => (
          <label
            key={item.id}
            className={`dashboard-module-manage-item ${item.checked ? 'is-enabled' : 'is-disabled'}`}
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(item.id)}
            onDragEnd={onDragEnd}
            title={item.description}
            data-dragging={draggingModuleId === item.id ? 'true' : 'false'}
          >
            <div className="dashboard-module-manage-topline">
              <span className="dashboard-module-drag-handle" aria-hidden="true">
                ↕
              </span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
              />
              <strong>{item.label}</strong>
              <span className="dashboard-module-state">{item.checked ? '显示中' : '已隐藏'}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
