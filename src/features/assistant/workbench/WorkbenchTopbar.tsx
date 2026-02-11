import type { WorkbenchStatus } from './workbenchTypes';

interface WorkbenchTopbarProps {
  status: WorkbenchStatus;
  providerText: string;
  onOpenSettings: () => void;
}

const STATUS_TEXT: Record<WorkbenchStatus, string> = {
  idle: '待输入',
  ready: '可识别',
  recognizing: '识别中',
  preview: '可预览',
  saving: '保存中',
  saved: '已保存',
  error: '异常'
};

const STATUS_CLASS: Record<WorkbenchStatus, string> = {
  idle: 'badge badge-primary',
  ready: 'badge badge-primary',
  recognizing: 'badge badge-warning',
  preview: 'badge badge-success',
  saving: 'badge badge-warning',
  saved: 'badge badge-success',
  error: 'badge badge-danger'
};

export function WorkbenchTopbar({ status, providerText, onOpenSettings }: WorkbenchTopbarProps) {
  return (
    <header className="assistant-wb-topbar panel">
      <div>
        <h2 className="assistant-wb-title">🤖 AI 记账工作台</h2>
        <p className="assistant-wb-subtitle">步骤：输入/上传 → 识别预览 → 确认保存</p>
      </div>
      <div className="assistant-wb-topbar-actions">
        <span className={STATUS_CLASS[status]}>{STATUS_TEXT[status]}</span>
        <small className="assistant-wb-provider">{providerText || '未配置供应商'}</small>
        <button type="button" onClick={onOpenSettings}>
          AI 设置
        </button>
      </div>
    </header>
  );
}
