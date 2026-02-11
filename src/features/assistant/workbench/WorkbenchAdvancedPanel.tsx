import { useMemo, useState } from 'react';
import type { DraftBillEntry } from './workbenchTypes';

interface WorkbenchAdvancedPanelProps {
  rawContent: string;
  rawReasoning: string;
  entries: DraftBillEntry[];
}

function toPrettyJson(entries: DraftBillEntry[]): string {
  const payload = {
    transactions: entries.map((item) => ({
      type: item.type,
      amount: item.amount,
      date: item.date,
      note: item.note,
      category: item.category,
      account: item.account,
      tags: item.tags,
      orderNo: item.orderNo,
      merchantOrderNo: item.merchantOrderNo,
      selected: item.selected,
      issues: item.issues
    }))
  };
  return JSON.stringify(payload, null, 2);
}

export function WorkbenchAdvancedPanel({
  rawContent,
  rawReasoning,
  entries
}: WorkbenchAdvancedPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const jsonText = useMemo(() => toPrettyJson(entries), [entries]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `assistant-preview-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel assistant-wb-advanced">
      <header className="assistant-wb-section-head">
        <h3>高级信息（JSON）</h3>
        <button type="button" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '展开' : '收起'}
        </button>
      </header>

      {!collapsed ? (
        <>
          <div className="assistant-wb-json-actions">
            <button type="button" onClick={handleCopy}>
              复制 JSON
            </button>
            <button type="button" onClick={handleDownload}>
              下载 JSON
            </button>
          </div>

          <details className="assistant-wb-collapse" open={Boolean(rawReasoning)}>
            <summary>模型思考内容</summary>
            <pre>{rawReasoning || '暂无'}</pre>
          </details>

          <details className="assistant-wb-collapse" open={Boolean(rawContent)}>
            <summary>模型原始回复</summary>
            <pre>{rawContent || '暂无'}</pre>
          </details>

          <details className="assistant-wb-collapse" open>
            <summary>结构化预览 JSON</summary>
            <pre>{jsonText}</pre>
          </details>
        </>
      ) : null}
    </section>
  );
}
