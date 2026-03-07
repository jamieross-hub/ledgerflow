import { useMemo, useState } from 'react';
import { useGlobalMemoryStore } from '../../shared/store/useGlobalMemoryStore';
import type { GlobalMemoryStatus, GlobalMemoryType } from '../../shared/store/globalMemory';

const MEMORY_TYPE_LABELS: Record<GlobalMemoryType, string> = {
  user_preference: '用户偏好',
  financial_habit: '账务习惯',
  risk_preference: '风险偏好',
  display_preference: '展示偏好'
};

const MEMORY_STATUS_LABELS: Record<GlobalMemoryStatus, string> = {
  active: '启用中',
  archived: '已归档'
};

const MEMORY_SOURCE_LABELS: Record<string, string> = {
  assistant_chat: '助手对话',
  bookkeeping_action: '记账行为',
  repayment_behavior: '还款行为',
  budget_behavior: '预算行为',
  settings_change: '设置变更',
  manual: '手动添加'
};

export function GlobalMemoryPage() {
  const memories = useGlobalMemoryStore((s) => s.memories);
  const getFilteredMemories = useGlobalMemoryStore((s) => s.getFilteredMemories);
  const archiveMemory = useGlobalMemoryStore((s) => s.archiveMemory);
  const restoreMemory = useGlobalMemoryStore((s) => s.restoreMemory);
  const setMemoryDisabled = useGlobalMemoryStore((s) => s.setMemoryDisabled);
  const pinMemory = useGlobalMemoryStore((s) => s.pinMemory);
  const removeMemory = useGlobalMemoryStore((s) => s.removeMemory);
  const [type, setType] = useState<GlobalMemoryType | 'all'>('all');
  const [status, setStatus] = useState<GlobalMemoryStatus | 'all'>('all');

  const filtered = useMemo(
    () => getFilteredMemories({ type, status, includeDisabled: true }),
    [getFilteredMemories, status, type]
  );

  const summary = useMemo(
    () => ({
      user_preference: memories.filter((item) => item.type === 'user_preference').length,
      financial_habit: memories.filter((item) => item.type === 'financial_habit').length,
      risk_preference: memories.filter((item) => item.type === 'risk_preference').length,
      display_preference: memories.filter((item) => item.type === 'display_preference').length
    }),
    [memories]
  );

  return (
    <div className="global-memory-page">
      <section className="panel">
        <div className="global-memory-header">
          <div>
            <h2>全局记忆</h2>
            <p>这里展示系统当前沉淀下来的长期偏好与稳定习惯。它们会用于后续 AI 助手回答，但不等于聊天记录备份。</p>
          </div>
          <div className="global-memory-summary">
            <span className="badge badge-primary">共 {memories.length} 条</span>
            <span className="badge">用户偏好 {summary.user_preference}</span>
            <span className="badge">账务习惯 {summary.financial_habit}</span>
            <span className="badge">风险偏好 {summary.risk_preference}</span>
            <span className="badge">展示偏好 {summary.display_preference}</span>
          </div>
        </div>

        <div className="global-memory-filters">
          <label>
            <span>类型</span>
            <select value={type} onChange={(e) => setType(e.target.value as GlobalMemoryType | 'all')}>
              <option value="all">全部</option>
              <option value="user_preference">用户偏好</option>
              <option value="financial_habit">账务习惯</option>
              <option value="risk_preference">风险偏好</option>
              <option value="display_preference">展示偏好</option>
            </select>
          </label>
          <label>
            <span>状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as GlobalMemoryStatus | 'all')}>
              <option value="all">全部</option>
              <option value="active">启用中</option>
              <option value="archived">已归档</option>
            </select>
          </label>
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="panel empty-state">
          <div className="empty-state-icon">🧠</div>
          <h3>还没有可展示的全局记忆</h3>
          <p>当你和 AI 助手发生更多稳定、多轮的互动后，系统会把有长期价值的偏好沉淀到这里。</p>
        </section>
      ) : (
        <section className="global-memory-list">
          {filtered.map((item) => {
            const updatedAt = item.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime())
              ? new Date(item.updatedAt).toLocaleString()
              : '未知时间';
            const score = Math.round((item.score || item.confidence || 0) * 100);

            return (
              <article key={item.id} className="panel global-memory-card">
                <div className="global-memory-card-head">
                  <div>
                    <h3>{item.title || '未命名记忆'}</h3>
                    <div className="global-memory-meta-row">
                      <span className="badge badge-primary">{MEMORY_TYPE_LABELS[item.type] || '用户偏好'}</span>
                      <span className="badge">{MEMORY_STATUS_LABELS[item.status] || '启用中'}</span>
                      {item.pinned ? <span className="badge badge-warning">置顶</span> : null}
                      {item.disabled ? <span className="badge badge-danger">已停用</span> : null}
                    </div>
                  </div>
                  <div className="global-memory-score-block">
                    <strong>{Number.isFinite(score) ? score : 0}%</strong>
                    <small>可信度</small>
                  </div>
                </div>
                <p className="global-memory-content">{item.content || '暂无内容'}</p>
                <div className="global-memory-foot">
                  <span>来源：{MEMORY_SOURCE_LABELS[item.source] || '未知来源'}</span>
                  <span>来源方式：{item.origin || 'manual'}</span>
                  <span>更新时间：{updatedAt}</span>
                </div>
                <div className="global-memory-actions">
                  <button type="button" onClick={() => pinMemory(item.id, !item.pinned)}>
                    {item.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button type="button" onClick={() => setMemoryDisabled(item.id, !item.disabled)}>
                    {item.disabled ? '启用' : '停用'}
                  </button>
                  {item.status === 'active' ? (
                    <button type="button" onClick={() => archiveMemory(item.id)}>
                      归档
                    </button>
                  ) : (
                    <button type="button" onClick={() => restoreMemory(item.id)}>
                      恢复
                    </button>
                  )}
                  <button type="button" className="danger" onClick={() => removeMemory(item.id)}>
                    删除
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
