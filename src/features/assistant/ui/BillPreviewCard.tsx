import { useMemo, useState } from 'react';

interface BillPreviewCardProps {
  payload: unknown;
  onSave: () => void;
  onSaved?: () => void;
}

export function BillPreviewCard({ payload, onSave, onSaved }: BillPreviewCardProps) {
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
      </div>
      {!collapsed ? <pre>{jsonText}</pre> : null}
      <button type="button" className="primary" onClick={handleSave}>
        💾 一键保存到账本
      </button>
    </div>
  );
}
