import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SMART_TRANSACTION_COMMANDS } from '../../features/assistant/workbench/workbenchTypes';
import { useAssistantWorkbench } from '../../features/assistant/workbench/useAssistantWorkbench';
import { BillPreviewCard } from '../../features/assistant/ui/BillPreviewCard';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { Toast } from '../../shared/ui/Toast';

/**
 * 将内部状态机状态映射为顶部可读文案。
 */
function statusText(status: ReturnType<typeof useAssistantWorkbench>['status']): string {
  switch (status) {
    case 'idle':
      return '等待输入内容';
    case 'ready':
      return '可开始识别';
    case 'recognizing':
      return '模型识别中';
    case 'preview':
      return '识别完成，可保存到账本';
    case 'saving':
      return '正在保存';
    case 'saved':
      return '保存成功';
    case 'error':
      return '识别失败';
    default:
      return '';
  }
}

/**
 * 仅做最轻量的行内 Markdown 渲染：当前支持 **加粗**。
 * 这里不用第三方解析器，避免引入额外依赖与 XSS 风险面。
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const strongRegex = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null = null;

  while ((match = strongRegex.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(<strong key={`md-strong-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/**
 * 将模型返回文本按“段落/标题/列表”切分并转为 React 节点。
 * 支持：
 * - # / ## / ### 标题
 * - - / * 无序列表
 * - 1. 2. 有序列表（统一渲染为列表项）
 */
function renderMarkdownContent(raw: string): ReactNode[] {
  const lines = raw.split(/\n/);
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`md-ul-${nodes.length}`} className="chat-md-list">
        {bullets.map((item, idx) => (
          <li key={`md-li-${idx}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushBullets();
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      nodes.push(
        <p key={`md-h-${idx}`} className={`chat-md-heading chat-md-h${level}`}>
          {renderInlineMarkdown(title)}
        </p>
      );
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      return;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      bullets.push(`${numberedMatch[1]}. ${numberedMatch[2]}`);
      return;
    }

    flushBullets();
    nodes.push(
      <p key={`md-p-${idx}`} className="chat-md-paragraph">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushBullets();
  return nodes;
}

interface ChatHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  usageText?: string;
}

const QUICK_BILL_TEMPLATES = [
  { label: '🍜 午饭 18（支付宝）', prompt: '今天午饭18元，用支付宝支付' },
  { label: '☕ 咖啡 23（微信）', prompt: '今天买咖啡23元，用微信支付' },
  { label: '🚇 地铁 4（零钱）', prompt: '今天地铁4元，用现金支付' },
  { label: '💼 工资入账', prompt: '本月工资到账 12000 元，入账银行卡' }
];

const QUICK_AMOUNT_ACTIONS = [10, 20, 50, 100];

export function AssistantPage() {
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const setModel = useAiSettings((s) => s.setModel);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);

  const wb = useAssistantWorkbench({
    baseUrl,
    apiKey,
    model,
    categories,
    accounts,
    transactions,
    addCategory,
    addTransaction,
    updateTransaction
  });

  const [modelOpen, setModelOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const lastAssistantRef = useRef('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  // 仅保留“被勾选且通过校验”的条目，作为一键保存候选。
  const selectedValidEntries = useMemo(
    () => wb.entries.filter((item) => item.selected && item.issues.length === 0),
    [wb.entries]
  );

  // 预览卡片需要的 JSON 结构，避免在渲染阶段重复构造。
  const duplicateEntriesCount = useMemo(
    () => wb.entries.filter((item) => item.duplicateTxId).length,
    [wb.entries]
  );

  const previewPayload = useMemo(
    () => ({
      transactions: selectedValidEntries.map((item) => ({
        type: item.type,
        amount: item.amount,
        date: item.date,
        note: item.note,
        category: item.category,
        account: item.account,
        tags: item.tags,
        orderNo: item.orderNo,
        merchantOrderNo: item.merchantOrderNo
      }))
    }),
    [selectedValidEntries]
  );

  // 每次状态或消息变化后，自动将视图滚动到底部，保持聊天体验。
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [wb.status, wb.rawContent, wb.rawReasoning, wb.entries.length, wb.error]);

  const onSubmit = (event: FormEvent) => {
    const prompt = wb.textInput.trim();
    if (prompt) {
      setChatHistory((prev) => [...prev, { id: `${Date.now()}-user`, role: 'user', text: prompt }]);
    }
    void wb.handleRecognize(event);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!wb.canRecognize || wb.status === 'recognizing') return;
    void wb.handleRecognize(event as unknown as FormEvent);
  };

  // 非记账分析时，模型返回自由文本，解析 JSON 失败属于预期，不展示底部红条。
  const shouldShowError =
    Boolean(wb.error) && !/unexpected token|invalid json|json/i.test(wb.error.toLowerCase());

  useEffect(() => {
    if (!wb.rawContent || wb.rawContent === lastAssistantRef.current) return;
    lastAssistantRef.current = wb.rawContent;
    const usageText = wb.lastUsage
      ? `Token 消耗：输入 ${wb.lastUsage.promptTokens} / 输出 ${wb.lastUsage.completionTokens} / 总计 ${wb.lastUsage.totalTokens}`
      : undefined;
    setChatHistory((prev) => [
      ...prev,
      { id: `${Date.now()}-assistant`, role: 'assistant', text: wb.rawContent, usageText }
    ]);
  }, [wb.lastUsage, wb.rawContent]);

  const removeMessage = (id: string) =>
    setChatHistory((prev) => prev.filter((item) => item.id !== id));

  const retryMessage = (index: number) => {
    const previousUser = [...chatHistory]
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user');
    if (!previousUser) return;
    wb.setTextInput(previousUser.text);
    window.requestAnimationFrame(() => {
      void wb.handleRecognize({ preventDefault() {} } as FormEvent);
    });
  };

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date());

  return (
    <div
      className="chat-fullscreen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void wb.handleDropImage(e)}
    >
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <span className="chat-topbar-title">AI 记账助手</span>
          <span className="chat-topbar-sep">·</span>
          <span>{statusText(wb.status)}</span>
        </div>

        <div className="chat-model-selector">
          <button
            type="button"
            className="chat-model-btn"
            onClick={() => setModelOpen((v) => !v)}
            aria-haspopup="listbox"
          >
            {model || '选择模型'}
            <span className="chat-model-arrow">▼</span>
          </button>

          {modelOpen ? (
            <div className="chat-model-dropdown" role="dialog" aria-label="模型列表">
              <div className="chat-model-dropdown-header">
                <button
                  type="button"
                  className="chat-model-fetch-btn"
                  disabled={wb.loadingModels}
                  onClick={() => void wb.handleLoadModels()}
                >
                  {wb.loadingModels ? '拉取中...' : '刷新模型列表'}
                </button>
              </div>
              <div className="chat-model-list">
                {wb.models.length === 0 ? (
                  <div className="chat-model-empty">暂无模型，请先拉取</div>
                ) : (
                  wb.models.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`chat-model-option ${item === model ? 'active' : ''}`}
                      onClick={() => {
                        setModel(item);
                        setModelOpen(false);
                      }}
                    >
                      {item}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="chat-topbar-right">
          <span className="chat-topbar-provider">{baseUrl || '默认服务地址'}</span>
        </div>
      </header>

      <section className="chat-messages-area">
        <div className="chat-messages-inner">
          {!wb.hasApiKey ? (
            <section className="chat-key-required">
              <h3>请先配置 API Key</h3>
              <p>未检测到可用密钥，助手暂时不能请求模型。</p>
              <Link className="chat-key-required-link" to="/settings">
                前往设置
              </Link>
            </section>
          ) : null}

          <section className="chat-kawaii-panel">
            <div className="chat-kawaii-topline">今天 {todayLabel}</div>
            <div className="chat-kawaii-amount">¥0.00</div>
            <div className="chat-kawaii-sub">本轮准备记账 · 一句话也能生成账单 ✨</div>
            <div className="chat-kawaii-actions">
              {QUICK_BILL_TEMPLATES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => wb.applyCommand(item.prompt)}
                  disabled={wb.status === 'recognizing'}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="chat-kawaii-mascot" aria-hidden>
              <span>૮₍ ˶•⤙•˶ ₎ა</span>
              <small>来嘛来嘛，点我就能秒记账～</small>
            </div>
          </section>

          <article className="chat-msg">
            <div className="chat-msg-avatar">🤖</div>
            <div className="chat-msg-body">
              <div className="chat-msg-header">账单小助手</div>
              <div className="chat-msg-content">
                <p>输入一句话、贴截图，或者点击上方模板，我会帮你快速生成可保存账单。</p>
              </div>
            </div>
          </article>

          {chatHistory.map((item, index) => (
            <article
              key={item.id}
              className={`chat-msg ${item.role === 'user' ? 'chat-msg-user' : ''}`}
            >
              <div className="chat-msg-avatar">{item.role === 'user' ? '🙂' : '🤖'}</div>
              <div className="chat-msg-body">
                <div className="chat-msg-header">{item.role === 'user' ? '你' : '助手'}</div>
                <div className="chat-msg-content chat-msg-content-rich">
                  {renderMarkdownContent(item.text)}
                </div>
                {item.usageText ? <p className="chat-token-usage">{item.usageText}</p> : null}
                <div className="chat-message-actions">
                  <button type="button" onClick={() => removeMessage(item.id)}>
                    删除
                  </button>
                  {item.role === 'assistant' ? (
                    <button
                      type="button"
                      onClick={() => retryMessage(index)}
                      disabled={wb.status === 'recognizing'}
                    >
                      重试
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}

          {wb.rawReasoning ? (
            <article className="chat-msg">
              <div className="chat-msg-avatar">🧠</div>
              <div className="chat-msg-body">
                <details className="chat-thinking-box" open>
                  <summary>查看推理摘要</summary>
                  <div className="chat-thinking-scroll">{wb.rawReasoning}</div>
                </details>
                {selectedValidEntries.length > 0 ? (
                  <BillPreviewCard
                    payload={previewPayload}
                    entries={wb.entries}
                    duplicateCount={duplicateEntriesCount}
                    onCheckDuplicates={wb.checkDuplicates}
                    onSave={wb.saveSelected}
                    onSaved={() => wb.setToastState('账单已写入账本', 'success')}
                  />
                ) : null}
              </div>
            </article>
          ) : null}

          {wb.status === 'recognizing' ? (
            <article className="chat-msg">
              <div className="chat-msg-avatar">🤖</div>
              <div className="chat-msg-body">
                <div className="chat-msg-header">助手</div>
                <div className="chat-typing">
                  模型思考中<span className="dot1">.</span>
                  <span className="dot2">.</span>
                  <span className="dot3">.</span>
                </div>
              </div>
            </article>
          ) : null}

          {wb.status === 'saved' ? (
            <article className="chat-msg">
              <div className="chat-msg-avatar">✅</div>
              <div className="chat-msg-body">
                <div className="chat-msg-header">系统</div>
                <div className="chat-auto-card">
                  <strong>账单已保存到账本。</strong>
                </div>
              </div>
            </article>
          ) : null}

          <div ref={messageEndRef} />
        </div>
      </section>

      <section className="chat-input-bar">
        <div className="chat-quick-amount-row">
          <span>⚡ 快速建单</span>
          {QUICK_AMOUNT_ACTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => wb.applyCommand(`刚刚支出${amount}元，用微信支付`)}
              disabled={wb.status === 'recognizing'}
            >
              -¥{amount}
            </button>
          ))}
        </div>

        <div className="chat-smart-command-row">
          {SMART_TRANSACTION_COMMANDS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="chat-smart-command-chip"
              onClick={() => wb.applyCommand(item.prompt)}
              disabled={wb.status === 'recognizing'}
            >
              {item.label}
            </button>
          ))}
        </div>

        {shouldShowError ? (
          <div className="chat-error-strip" role="alert">
            <span>{wb.error}</span>
            <button type="button" onClick={() => wb.resetWorkbench()}>
              清空重试
            </button>
          </div>
        ) : null}

        {wb.imageDataUrls.length > 0 ? (
          <div className="chat-image-strip">
            <div className="chat-thumb-list">
              {wb.imageDataUrls.map((url, idx) => (
                <div className="chat-thumb-item" key={`${url.slice(0, 12)}-${idx}`}>
                  <img className="chat-thumb" src={url} alt={`截图${idx + 1}`} />
                  <button
                    type="button"
                    className="chat-thumb-remove"
                    onClick={() => wb.setImageDataUrls((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => wb.setImageDataUrls([])}>
              清空图片
            </button>
          </div>
        ) : null}

        <p className="chat-disclaimer">AI 生成内容仅供参考，请结合原始账单核对后再保存。</p>

        <form className="chat-input-form" onSubmit={onSubmit}>
          <textarea
            ref={wb.textareaRef}
            className="chat-input-textarea"
            rows={2}
            placeholder="比如：今天午饭15元，用支付宝（会自动识别分类）"
            value={wb.textInput}
            onChange={(e) => wb.setTextInput(e.target.value)}
            onPaste={(e) => void wb.handlePasteImage(e)}
            onKeyDown={onInputKeyDown}
          />

          <input
            ref={wb.fileInputRef}
            className="chat-file-input-hidden"
            type="file"
            accept="image/*"
            title="上传账单图片"
            aria-label="上传账单图片"
            onChange={(e) => void wb.handleSetImage(e.target.files?.[0])}
          />

          <button
            type="button"
            className="chat-upload-btn"
            title="上传图片"
            onClick={() => wb.fileInputRef.current?.click()}
            disabled={wb.status === 'recognizing'}
          >
            ＋
          </button>

          <button
            type="submit"
            className="chat-send-btn"
            title="发送"
            disabled={!wb.canRecognize || wb.status === 'recognizing'}
          >
            ↑
          </button>
        </form>
      </section>

      <Toast
        message={wb.toast.message}
        variant={wb.toast.variant}
        visible={wb.toast.visible}
        onClose={() => wb.setToastVisible(false)}
      />
    </div>
  );
}
