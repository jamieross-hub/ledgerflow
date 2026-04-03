import type { DraftBillEntry } from '../workbench/workbenchTypes';

interface BillPreviewCardProps {
  entries: DraftBillEntry[];
  duplicateCount: number;
  onCheckDuplicates: () => number;
  onSave: (options?: { overwriteDuplicateEntryIds?: string[] }) => boolean;
  onSaved?: () => void;
}

export function BillPreviewCard({
  entries,
  duplicateCount,
  onCheckDuplicates,
  onSave,
  onSaved
}: BillPreviewCardProps) {
  const handleSave = () => {
    if (onSave()) {
      onSaved?.();
    }
  };

  return (
    <div className="chat-bill-preview">
      <h3>✅ AI 识别账单</h3>
      <div className="chat-preview-toolbar">
        <button type="button" onClick={onCheckDuplicates}>
          检测重复账单
        </button>
      </div>

      {duplicateCount > 0 ? (
        <p className="chat-dup-alert">检测到 {duplicateCount} 条疑似重复账单，请确认是否覆盖。</p>
      ) : (
        <p className="chat-dup-alert subtle">未检测到重复账单。</p>
      )}

      <div className="chat-bill-rows">
        {entries.map((item) => (
          <article key={item.id} className="chat-bill-row-item">
            <strong>
              {item.date.slice(0, 10)} · {item.type} · {item.currency && item.currency !== 'unknown' ? `${item.currency} ` : '¥'}{item.amount.toFixed(2)}
            </strong>
            <small>
              {item.category || '未分类'} / {item.account || '未指定账户'}
              {item.originalAmountText ? ` / 原始：${item.originalAmountText}` : ''}
            </small>
            {item.duplicateTxId ? <span className="chat-dup-badge">疑似重复</span> : null}
          </article>
        ))}
      </div>
      <button type="button" className="primary" onClick={handleSave}>
        💾 一键保存到账本
      </button>
    </div>
  );
}
