import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAiModels, sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

/**
 * 记账助手页面 — 全屏聊天模式
 * - 顶部紧凑模型选择器
 * - 全屏聊天区域（自动滚动到底部）
 * - 底部固定输入栏（支持粘贴/拖拽图片）
 */
interface ChatItem {
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
}

interface AiBillItem {
  type: 'expense' | 'income';
  amount: number;
  date?: string;
  note?: string;
  category?: string;
  account?: string;
  tags?: string[];
}

interface AiBillResult {
  transactions: AiBillItem[];
}

const JSON_AGENT_PROMPT = `你是 LedgerFlow 的记账识别 Agent。\n请只返回 JSON，不要返回 markdown。\nJSON schema: {"transactions":[{"type":"expense|income","amount":number,"date":"YYYY-MM-DD or ISO string","note":"string","category":"string","account":"string","tags":["string"]}]}。\n如果信息缺失，按最合理推断并在 note 说明。`;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function extractJsonString(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const generic = text.match(/```\s*([\s\S]*?)```/i);
  if (generic?.[1]) {
    return generic[1].trim();
  }

  return text.trim();
}

function normalizeAiBill(raw: unknown): AiBillResult | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { transactions?: unknown }).transactions)) {
    return null;
  }

  const txs: AiBillItem[] = [];
  for (const entry of (raw as { transactions: unknown[] }).transactions) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = entry as Partial<AiBillItem>;
    const type = candidate.type === 'income' ? 'income' : candidate.type === 'expense' ? 'expense' : null;
    const amount = Number(candidate.amount);
    if (!type || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    txs.push({
      type,
      amount,
      date: candidate.date || new Date().toISOString(),
      note: candidate.note || 'AI 识别账单',
      category: candidate.category || '',
      account: candidate.account || '',
      tags: Array.isArray(candidate.tags) ? candidate.tags.map((t) => String(t)) : []
    });
  }

  if (txs.length === 0) {
    return null;
  }

  return { transactions: txs };
}

export function AssistantPage() {
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const setModel = useAiSettings((s) => s.setModel);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const [models, setModels] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [retryMessages, setRetryMessages] = useState<ChatItem[] | null>(null);
  const [parsedBill, setParsedBill] = useState<AiBillResult | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: 'assistant',
      text: '你好，我是 LedgerFlow 记账助手 🤖\n\n我可以帮你识别账单、截图，并自动生成结构化的记账数据。\n\n• 直接输入文字描述你的消费\n• 粘贴或拖拽账单截图\n• 我会返回 JSON 账单，支持一键保存'
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(
    () => Boolean(model.trim()) && (Boolean(textInput.trim()) || Boolean(imageDataUrl)),
    [model, textInput, imageDataUrl]
  );

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 点击外部关闭模型下拉
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!modelDropdownRef.current) {
        return;
      }
      if (!modelDropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSetImage = async (file?: File) => {
    if (!file) {
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    setImageDataUrl(dataUrl);
  };

  const handlePasteImage = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      if (entry.type.startsWith('image/')) {
        const file = entry.getAsFile();
        if (file) {
          event.preventDefault();
          await handleSetImage(file);
          return;
        }
      }
    }
  };

  const handleDropImage = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleSetImage(file);
    }
  };

  const handleLoadModels = async () => {
    setError('');
    setLoadingModels(true);
    try {
      const list = await fetchAiModels(baseUrl, apiKey);
      setModels(list);
      if (!model && list.length > 0) {
        setModel(list[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型列表加载失败');
    } finally {
      setLoadingModels(false);
    }
  };

  const sendWithMessages = async (nextMessages: ChatItem[]) => {
    const reply = await sendAiChat({
      baseUrl,
      apiKey,
      model,
      systemPrompt: JSON_AGENT_PROMPT,
      messages: nextMessages.map((item) => ({
        role: item.role,
        text: item.text,
        imageDataUrl: item.imageDataUrl
      }))
    });

    setMessages((prev: ChatItem[]) => [...prev, { role: 'assistant', text: reply }]);

    try {
      const jsonRaw = extractJsonString(reply);
      const parsed = normalizeAiBill(JSON.parse(jsonRaw) as unknown);
      setParsedBill(parsed);
    } catch {
      setParsedBill(null);
    }

    setRetryMessages(null);
    setTextInput('');
    setImageDataUrl('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError('');

    const userMessage: ChatItem = {
      role: 'user',
      text: textInput.trim(),
      imageDataUrl: imageDataUrl || undefined
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      await sendWithMessages(nextMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : '对话请求失败';
      setError(message);
      setRetryMessages(nextMessages);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!retryMessages) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await sendWithMessages(retryMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : '重试失败';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resolveCategoryId = (name?: string) => {
    const normalized = (name || '').trim().toLowerCase();
    const matched = categories.find((item) => item.name.trim().toLowerCase() === normalized);
    return matched?.id || categories[0]?.id || 'cat-unknown';
  };

  const resolveAccountId = (name?: string) => {
    const normalized = (name || '').trim().toLowerCase();
    const matched = accounts.find((item) => item.name.trim().toLowerCase() === normalized);
    return matched?.id || accounts[0]?.id || 'acc-unknown';
  };

  const handleSaveBill = () => {
    if (!parsedBill) {
      return;
    }

    parsedBill.transactions.forEach((item) => {
      addTransaction({
        type: item.type,
        amount: item.amount,
        date: item.date || new Date().toISOString(),
        note: item.note || 'AI 导入账单',
        tags: item.tags || ['AI识别'],
        categoryId: resolveCategoryId(item.category),
        accountId: resolveAccountId(item.account)
      });
    });

    setParsedBill(null);
  };

  const handleSelectModel = (m: string) => {
    setModel(m);
    setModelDropdownOpen(false);
  };

  return (
    <div className="chat-fullscreen" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void handleDropImage(e)}>
      {/* ===== 顶部栏：模型选择 ===== */}
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <span className="chat-topbar-title">🤖 记账助手</span>
          <span className="chat-topbar-sep">›</span>
          <div className="chat-model-selector" ref={modelDropdownRef}>
            <button
              type="button"
              className="chat-model-btn"
              onClick={() => setModelDropdownOpen((v) => !v)}
            >
              {model || '选择模型'}
              <span className="chat-model-arrow">{modelDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {modelDropdownOpen ? (
              <div className="chat-model-dropdown">
                <div className="chat-model-dropdown-header">
                  <button
                    type="button"
                    className="chat-model-fetch-btn"
                    onClick={() => void handleLoadModels()}
                    disabled={loadingModels}
                  >
                    {loadingModels ? '加载中...' : '🔄 拉取模型列表'}
                  </button>
                </div>
                {models.length > 0 ? (
                  <div className="chat-model-list">
                    {models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={m === model ? 'chat-model-option active' : 'chat-model-option'}
                        onClick={() => handleSelectModel(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="chat-model-empty">点击上方按钮拉取可用模型</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="chat-topbar-right">
          <small className="chat-topbar-provider">{baseUrl || '未配置供应商'}</small>
        </div>
      </header>

      {/* ===== 聊天消息区 ===== */}
      <div className="chat-messages-area">
        <div className="chat-messages-inner">
          {messages.map((item, index) => (
            <article
              key={`${item.role}-${index}`}
              className={item.role === 'user' ? 'chat-msg chat-msg-user' : 'chat-msg chat-msg-assistant'}
            >
              <div className="chat-msg-avatar">
                {item.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="chat-msg-body">
                <header className="chat-msg-header">{item.role === 'user' ? '你' : '记账助手'}</header>
                <div className="chat-msg-content">
                  <p>{item.text || '（仅图片）'}</p>
                  {item.imageDataUrl ? <img src={item.imageDataUrl} alt="user upload" className="chat-msg-image" /> : null}
                </div>
              </div>
            </article>
          ))}

          {submitting ? (
            <article className="chat-msg chat-msg-assistant">
              <div className="chat-msg-avatar">🤖</div>
              <div className="chat-msg-body">
                <header className="chat-msg-header">记账助手</header>
                <div className="chat-msg-content">
                  <p className="chat-typing">思考中<span className="dot1">.</span><span className="dot2">.</span><span className="dot3">.</span></p>
                </div>
              </div>
            </article>
          ) : null}

          {/* JSON 账单预览 */}
          {parsedBill ? (
            <div className="chat-bill-preview">
              <h3>✅ AI 识别账单</h3>
              <pre>{JSON.stringify(parsedBill, null, 2)}</pre>
              <button type="button" className="primary" onClick={handleSaveBill}>
                💾 一键保存到账本
              </button>
            </div>
          ) : null}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ===== 底部输入栏 ===== */}
      <footer className="chat-input-bar">
        {error ? (
          <div className="chat-error-strip">
            <span>{error}</span>
            {retryMessages ? (
              <button type="button" onClick={() => void handleRetry()} disabled={submitting}>
                重试
              </button>
            ) : null}
          </div>
        ) : null}

        {imageDataUrl ? (
          <div className="chat-image-strip">
            <img src={imageDataUrl} alt="待发送图片" className="chat-thumb" />
            <button type="button" onClick={() => setImageDataUrl('')}>✕ 移除</button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            rows={1}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
              void handlePasteImage(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSubmit && !submitting) {
                  const form = e.currentTarget.closest('form');
                  if (form) {
                    form.requestSubmit();
                  }
                }
              }
            }}
            className="chat-input-textarea"
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行 · 支持粘贴/拖拽图片"
          />
          <button type="submit" className="chat-send-btn primary" disabled={!canSubmit || submitting}>
            {submitting ? '⏳' : '➤'}
          </button>
        </form>
      </footer>
    </div>
  );
}
