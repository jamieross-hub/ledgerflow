import { useMemo, useState } from 'react';
import type { DraftBillEntry } from '../workbench/workbenchTypes';

interface BillPreviewCardProps {
  payload: unknown;
  entries: DraftBillEntry[];
  duplicateCount: number;
  onCheckDuplicates: () => number;
  onSave: () => void;
  onSaved?: () => void;
}

export function BillPreviewCard({
  payload,
  entries,
  duplicateCount,
  onCheckDuplicates,
  onSave,
  onSaved
}: BillPreviewCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = () => {
    onSave();
    onSaved?.();
  };

  return (
    <div className="chat-bill-preview">
      <h3>✅ AI 识别账单</h3>
      <div className="chat-json-toolbar">
        <button type="button" onClick={handleCopy}>
          {copied ? '已复制' : '复制 JSON'}
        </button>
        <button type="button" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '展开' : '折叠'}
        </button>
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
              {item.date.slice(0, 10)} · {item.type} · ¥{item.amount.toFixed(2)}
            </strong>
            <small>
              {item.category || '未分类'} / {item.account || '未指定账户'}
            </small>
            {item.duplicateTxId ? <span className="chat-dup-badge">疑似重复</span> : null}
          </article>
        ))}
      </div>

      {!collapsed ? <pre>{jsonText}</pre> : null}
      <button type="button" className="primary" onClick={handleSave}>
        💾 一键保存到账本
      </button>
    </div>
  );
}
