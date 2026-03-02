import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TransactionItem,
  TransactionSource,
  TransactionStatus
} from '../../../entities/transaction/types';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: '待处理',
  completed: '已完成',
  refunded: '已退款',
  closed: '已关闭',
  failed: '失败'
};

function statusLabel(status: TransactionStatus): string {
  return STATUS_LABELS[status] || status;
}

function sourceLabel(source: TransactionSource): string {
  if (source === 'ai') return 'AI 记账';
  if (source === 'wechat') return '微信导入';
  if (source === 'alipay') return '支付宝';
  return '手工录入';
}

export type TransactionDetailSectionKey = 'base' | 'source' | 'note' | 'tags' | 'json';
type DetailMode = 'professional' | 'timeline';
const DETAIL_MODE_STORAGE_KEY = 'ledgerflow.transactions.detailMode';
const ALIPAY_ACCOUNT_PATTERN = /(支付宝|alipay)/i;

function isAlipayAccountName(name: string): boolean {
  return ALIPAY_ACCOUNT_PATTERN.test(name);
}

function AlipayBrandIcon() {
  return (
    <svg
      className="alipay-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#1677ff" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
        支
      </text>
    </svg>
  );
}

function renderAccountLabel(accountName: string): ReactNode {
  if (!isAlipayAccountName(accountName)) {
    return accountName;
  }

  return (
    <span className="transaction-account-with-icon">
      <AlipayBrandIcon />
      <span>{accountName}</span>
    </span>
  );
}

function renderTypeLabel(type: TransactionItem['type']) {
  if (type === 'income' || type === 'expense') {
    return (
      <span
        className={`transaction-type-badge transaction-type-badge-${type}`}
        aria-label={type === 'income' ? '收入' : '支出'}
      >
        {type === 'income' ? '收' : '支'}
      </span>
    );
  }

  return type === 'budget' ? '预算' : '还款';
}

function maskAmount(): string {
  return '¥••••';
}

function maskMerchant(value: string): string {
  if (!value) return '-';
  if (value.length <= 2) return '••';
  if (value.length <= 6) return `${value.slice(0, 1)}•••${value.slice(-1)}`;
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAbnormalAlert(input: TransactionItem): { title: string; detail: string } | null {
  const amount = Number(input.amount) || 0;
  if (input.type !== 'expense' || amount < 500) return null;
  return {
    title: '金额异常提醒',
    detail: `该笔支出（${formatCurrency(amount)}）显著偏高，建议检查是否重复记账，或确认是否为一次性大额消费。`
  };
}

function buildPrintStyles(): string {
  return `
    @page {
      size: A4;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      background: #fff;
    }

    .sheet {
      width: 100%;
      min-height: calc(297mm - 24mm);
      border: 1px solid #dbe3f0;
      border-radius: 10px;
      padding: 14mm;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    .sub {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 11px;
    }

    .amount {
      text-align: right;
      font-size: 20px;
      font-weight: 700;
      white-space: nowrap;
    }

    .amount.income {
      color: #16a34a;
    }

    .amount.expense {
      color: #dc2626;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-bottom: 12px;
    }

    .kv {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f8fafc;
    }

    .kv label {
      display: block;
      color: #64748b;
      font-size: 11px;
      margin-bottom: 2px;
    }

    .kv strong {
      font-weight: 600;
      color: #0f172a;
      word-break: break-word;
    }

    .section {
      margin-top: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
    }

    .section h3 {
      margin: 0 0 8px;
      font-size: 13px;
    }

    .section p {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag {
      border: 1px solid #c7d2fe;
      color: #1d4ed8;
      background: #eff6ff;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
    }

    .footer {
      margin-top: 16px;
      color: #94a3b8;
      font-size: 10px;
      text-align: right;
    }

    @media print {
      .sheet {
        border: none;
        border-radius: 0;
        padding: 0;
      }
    }
  `;
}

interface TransactionDetailDrawerProps {
  open: boolean;
  transaction: TransactionItem | null;
  categoryName: string;
  accountName: string;
  source: TransactionSource;
  relatedOrigin?: TransactionItem | null;
  relatedRefunds?: TransactionItem[];
  onClose: () => void;
  onCopyNote: () => void;
  onCopyJson: () => void;
  onDelete: () => void;
  onAiRecategorize: () => void;
  aiRecategorizing?: boolean;
  privacyMode?: boolean;
  visibleSections: Record<TransactionDetailSectionKey, boolean>;
  onToggleSection: (key: TransactionDetailSectionKey) => void;
  onQuickAdd: () => void;
}

export function TransactionDetailDrawer({
  open,
  transaction,
  categoryName,
  accountName,
  source,
  relatedOrigin = null,
  relatedRefunds = [],
  onClose,
  onCopyNote,
  onCopyJson,
  onDelete,
  onAiRecategorize,
  aiRecategorizing = false,
  privacyMode = false,
  visibleSections,
  onToggleSection,
  onQuickAdd
}: TransactionDetailDrawerProps) {
  const [mode, setMode] = useState<DetailMode>(() => {
    const saved = window.localStorage.getItem(DETAIL_MODE_STORAGE_KEY);
    return saved === 'timeline' ? 'timeline' : 'professional';
  });

  const setDetailMode = (next: DetailMode) => {
    setMode(next);
    window.localStorage.setItem(DETAIL_MODE_STORAGE_KEY, next);
  };

  const handlePrint = () => {
    if (!transaction) {
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760');
    if (!printWindow) {
      return;
    }

    const amountText = `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}`;
    const typeText =
      transaction.type === 'income'
        ? '收入'
        : transaction.type === 'expense'
          ? '支出'
          : transaction.type === 'budget'
            ? '预算'
            : '还款';

    const statusText = transaction.status ? statusLabel(transaction.status) : '—';
    const noteText = transaction.note?.trim() || '（无）';
    const tagsHtml =
      transaction.tags.length > 0
        ? transaction.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
        : '<span>（无）</span>';

    const html = `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>账单详情打印 - ${escapeHtml(transaction.id)}</title>
          <style>${buildPrintStyles()}</style>
        </head>
        <body>
          <main class="sheet">
            <header class="header">
              <div>
                <h1 class="title">账单详情</h1>
                <p class="sub">交易编号：${escapeHtml(transaction.id)}</p>
              </div>
              <div class="amount ${transaction.type === 'income' ? 'income' : 'expense'}">${escapeHtml(amountText)}</div>
            </header>

            <section class="grid">
              <div class="kv"><label>日期时间</label><strong>${escapeHtml(formatDateTime(transaction.date))}</strong></div>
              <div class="kv"><label>类型</label><strong>${escapeHtml(typeText)}</strong></div>
              <div class="kv"><label>分类</label><strong>${escapeHtml(categoryName)}</strong></div>
              <div class="kv"><label>账户</label><strong>${escapeHtml(accountName)}</strong></div>
              <div class="kv"><label>来源</label><strong>${escapeHtml(sourceLabel(source))}</strong></div>
              <div class="kv"><label>交易状态</label><strong>${escapeHtml(statusText)}</strong></div>
              <div class="kv"><label>订单号</label><strong>${escapeHtml(transaction.orderNo || '—')}</strong></div>
              <div class="kv"><label>商家订单号</label><strong>${escapeHtml(transaction.merchantOrderNo || '—')}</strong></div>
            </section>

            <section class="section">
              <h3>备注</h3>
              <p>${escapeHtml(noteText)}</p>
            </section>

            <section class="section">
              <h3>标签</h3>
              <div class="tags">${tagsHtml}</div>
            </section>

            <footer class="footer">打印时间：${escapeHtml(new Date().toLocaleString('zh-CN', { hour12: false }))}</footer>
          </main>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // 打开时禁止 body 滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !transaction) return null;

  const abnormalAlert = buildAbnormalAlert(transaction);

  return (
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="交易详情"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h3>交易详情</h3>
            <small className="drawer-subtitle">支持模块化显示</small>
          </div>
          <div className="drawer-mode-switch" role="tablist" aria-label="交易详情显示模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'professional' ? 'true' : 'false'}
              className={mode === 'professional' ? 'active' : ''}
              onClick={() => setDetailMode('professional')}
            >
              专业模式
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'timeline' ? 'true' : 'false'}
              className={mode === 'timeline' ? 'active' : ''}
              onClick={() => setDetailMode('timeline')}
            >
              时间轴模式
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭详情">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          {mode === 'timeline' ? (
            <section className="drawer-timeline" aria-label="交易时间轴">
              {[
                { label: '交易创建', value: formatDateTime(transaction.date), icon: '🧾' },
                {
                  label: '分类与账户',
                  value: (
                    <span>
                      {categoryName} · {renderAccountLabel(accountName)}
                    </span>
                  ),
                  icon: '🗂️'
                },
                {
                  label: '交易金额',
                  value: privacyMode
                    ? maskAmount()
                    : `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}`,
                  icon: transaction.type === 'income' ? '🟢' : '🔴'
                },
                { label: '记录来源', value: sourceLabel(source), icon: '🤖' },
                {
                  label: '冲正关系',
                  value:
                    transaction.adjustmentKind === 'refund' ||
                    transaction.adjustmentKind === 'reversal'
                      ? relatedOrigin
                        ? `关联原单：${relatedOrigin.note || relatedOrigin.id}`
                        : '退款/冲正（原单缺失）'
                      : relatedRefunds.length > 0
                        ? `已关联 ${relatedRefunds.length} 条退款/冲正`
                        : '普通交易',
                  icon: '🔁'
                },
                { label: '备注', value: transaction.note || '（无）', icon: '📝' }
              ].map((item) => (
                <article key={item.label} className="drawer-timeline-item">
                  <span className="drawer-timeline-icon">{item.icon}</span>
                  <div>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {mode === 'professional' ? (
            <details className="drawer-modules" open>
              <summary>详情标题模块</summary>
              <div className="drawer-modules-grid">
                {[
                  { key: 'base' as const, label: '基础信息' },
                  { key: 'source' as const, label: '来源' },
                  { key: 'note' as const, label: '备注' },
                  { key: 'tags' as const, label: '标签' },
                  { key: 'json' as const, label: '原始 JSON' }
                ].map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={visibleSections[item.key]}
                      onChange={() => onToggleSection(item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </details>
          ) : null}

          {mode === 'professional' && visibleSections.base ? (
            <>
              <div className="drawer-kv">
                <span>日期时间</span>
                <strong>{formatDateTime(transaction.date)}</strong>
              </div>
              <div className="drawer-kv">
                <span>类型</span>
                <strong>{renderTypeLabel(transaction.type)}</strong>
              </div>
              <div className="drawer-kv">
                <span>分类</span>
                <strong>{categoryName}</strong>
              </div>
              <div className="drawer-kv">
                <span>账户</span>
                <strong>{renderAccountLabel(accountName)}</strong>
              </div>
              <div className="drawer-kv">
                <span>金额</span>
                <strong className={transaction.type === 'income' ? 'text-income' : 'text-expense'}>
                  {privacyMode
                    ? maskAmount()
                    : `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}`}
                </strong>
              </div>
              {transaction.status ? (
                <div className="drawer-kv">
                  <span>交易状态</span>
                  <strong>
                    <span
                      className={`badge ${transaction.status === 'completed' ? 'badge-primary' : ''}`}
                    >
                      {statusLabel(transaction.status)}
                    </span>
                  </strong>
                </div>
              ) : null}
              {transaction.orderNo ? (
                <div className="drawer-kv">
                  <span>订单号</span>
                  <strong>{transaction.orderNo}</strong>
                </div>
              ) : null}
              {transaction.merchantOrderNo ? (
                <div className="drawer-kv">
                  <span>商家订单号</span>
                  <strong>
                    {privacyMode
                      ? maskMerchant(transaction.merchantOrderNo)
                      : transaction.merchantOrderNo}
                  </strong>
                </div>
              ) : null}
              {(transaction.adjustmentKind === 'refund' ||
                transaction.adjustmentKind === 'reversal' ||
                relatedRefunds.length > 0) && (
                <section
                  className="drawer-section drawer-adjustment-section"
                  aria-label="退款冲正关系"
                >
                  <h4>退款 / 冲正关系</h4>
                  <div className="drawer-kv">
                    <span>当前语义</span>
                    <strong>
                      {transaction.adjustmentKind === 'refund'
                        ? '退款单'
                        : transaction.adjustmentKind === 'reversal'
                          ? '冲正单'
                          : '原始交易'}
                    </strong>
                  </div>
                  {relatedOrigin ? (
                    <div className="drawer-kv">
                      <span>关联原单</span>
                      <strong>
                        {relatedOrigin.note || '（无备注）'} · {formatDateTime(relatedOrigin.date)}
                      </strong>
                    </div>
                  ) : null}
                  {relatedRefunds.length > 0 ? (
                    <div className="drawer-kv">
                      <span>关联退款/冲正</span>
                      <strong>{relatedRefunds.length} 条</strong>
                    </div>
                  ) : null}
                  {(transaction.adjustmentKind === 'refund' ||
                    transaction.adjustmentKind === 'reversal') &&
                  relatedOrigin ? (
                    <div className="drawer-kv">
                      <span>影响金额</span>
                      <strong className="text-income">
                        {privacyMode ? maskAmount() : `+${formatCurrency(transaction.amount)}`}
                      </strong>
                    </div>
                  ) : null}
                  {relatedRefunds.length > 0 ? (
                    <div className="drawer-kv">
                      <span>累计冲回</span>
                      <strong className="text-income">
                        {privacyMode
                          ? maskAmount()
                          : `+${formatCurrency(
                              relatedRefunds.reduce(
                                (sum, item) => sum + (Number(item.amount) || 0),
                                0
                              )
                            )}`}
                      </strong>
                    </div>
                  ) : null}
                </section>
              )}
            </>
          ) : null}

          {mode === 'professional' && abnormalAlert ? (
            <section className="drawer-section drawer-alert-section">
              <h4>⚠️ {abnormalAlert.title}</h4>
              <p>{abnormalAlert.detail}</p>
              <p className="muted" style={{ marginTop: 6 }}>
                AI 建议：如近期存在同金额/同备注流水，请优先核对是否重复入账。
              </p>
            </section>
          ) : null}

          {mode === 'professional' && visibleSections.source ? (
            <div className="drawer-kv">
              <span>来源</span>
              <strong>
                {source === 'ai' ? <span className="badge badge-primary">AI 记账</span> : null}
                {source === 'wechat' ? <span className="badge">微信导入</span> : null}
                {source === 'alipay' ? <span className="badge">支付宝</span> : null}
                {source === 'manual' ? <span className="badge">手工录入</span> : null}
              </strong>
            </div>
          ) : null}

          {mode === 'professional' && visibleSections.note ? (
            <section className="drawer-section">
              <h4>备注</h4>
              <p>{transaction.note || '（无）'}</p>
            </section>
          ) : null}

          {mode === 'professional' && visibleSections.tags ? (
            <section className="drawer-section">
              <h4>标签</h4>
              <div className="drawer-tags">
                {transaction.tags.length > 0
                  ? transaction.tags.map((tag) => (
                      <span key={tag} className="badge badge-primary">
                        {tag}
                      </span>
                    ))
                  : '（无）'}
              </div>
              {transaction.tags.length > 6 ? (
                <details className="drawer-tags-fold">
                  <summary>展开全部标签</summary>
                  <div className="drawer-tags" style={{ marginTop: 6 }}>
                    {transaction.tags.map((tag) => (
                      <span key={`${tag}-all`} className="badge badge-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}

          {mode === 'professional' && visibleSections.json ? (
            <section className="drawer-section">
              <h4>原始 JSON</h4>
              <pre>{JSON.stringify(transaction, null, 2)}</pre>
            </section>
          ) : null}
        </div>

        <footer className="drawer-footer">
          <button type="button" onClick={onCopyNote}>
            复制备注
          </button>
          <button type="button" onClick={onCopyJson}>
            复制 JSON
          </button>
          <button type="button" onClick={handlePrint}>
            🖨️ 打印 A4
          </button>
          <Link to={`/transactions/${transaction.id}`} style={{ textDecoration: 'none' }}>
            <button type="button">✏️ 编辑</button>
          </Link>
          <button type="button" onClick={onAiRecategorize} disabled={aiRecategorizing}>
            {aiRecategorizing ? '🤖 AI 重分类中…' : '🤖 AI 重分类'}
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            🗑️ 删除
          </button>
          <button
            type="button"
            className="drawer-add-link"
            aria-label="新增账目"
            onClick={onQuickAdd}
          >
            ＋
          </button>
        </footer>
      </aside>
    </div>
  );
}
