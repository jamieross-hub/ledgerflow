interface WorkbenchSavePanelProps {
  total: number;
  selected: number;
  valid: number;
  statusText: string;
  saving: boolean;
  onSave: () => void;
}

export function WorkbenchSavePanel({
  total,
  selected,
  valid,
  statusText,
  saving,
  onSave
}: WorkbenchSavePanelProps) {
  return (
    <section className="panel assistant-wb-save">
      <header className="assistant-wb-section-head">
        <h3>第三步：确认保存</h3>
        <small>{statusText}</small>
      </header>

      <div className="assistant-wb-save-stats">
        <span>识别总数：{total}</span>
        <span>已勾选：{selected}</span>
        <span>可保存：{valid}</span>
      </div>

      <button type="button" className="primary" disabled={saving || valid <= 0} onClick={onSave}>
        {saving ? '保存中...' : '确认保存到账本'}
      </button>
    </section>
  );
}
