import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import { fetchAiModels, sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

/**
 * 记账助手页面：
 * - AI 参数统一来自“设置”页
 * - 支持键盘粘贴图片、拖拽图片、缩略图预览
 * - AI 输出 JSON 账单后，可一键保存到本地账本
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

  const txs = (raw as { transactions: unknown[] }).transactions
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as Partial<AiBillItem>;
      const type = candidate.type === 'income' ? 'income' : candidate.type === 'expense' ? 'expense' : null;
      const amount = Number(candidate.amount);
      if (!type || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      return {
        type,
        amount,
        date: candidate.date || new Date().toISOString(),
        note: candidate.note || 'AI 识别账单',
        category: candidate.category || '',
        account: candidate.account || '',
        tags: Array.isArray(candidate.tags) ? candidate.tags.map((t) => String(t)) : []
      } satisfies AiBillItem;
    })
    .filter((item): item is AiBillItem => Boolean(item));

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
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: 'assistant',
      text: '你好，我是记账助手。支持粘贴截图（Ctrl/Cmd+V）与拖拽图片。我会返回 JSON 账单并支持一键保存。'
    }
  ]);

  const canSubmit = useMemo(
    () => Boolean(model.trim()) && (Boolean(textInput.trim()) || Boolean(imageDataUrl)),
    [model, textInput, imageDataUrl]
  );

  const handleSetImage = async (file?: File) => {
    if (!file) {
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    setImageDataUrl(dataUrl);
  };

  const handlePasteImage = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          await handleSetImage(file);
          return;
        }
      }
    }
  };

  const handleDropImage = async (event: React.DragEvent<HTMLDivElement>) => {
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

  return (
    <div className="assistant-layout assistant-priority-layout">
      <section className="panel assistant-config">
        <h2>记账助手</h2>
        <p>支持拉取模型并直接切换，Agent 默认返回 JSON 账单结构。</p>

        <div className="row assistant-model-row">
          <small className="mono">供应商：{baseUrl || '未设置'}</small>
          <button type="button" onClick={() => void handleLoadModels()} disabled={loadingModels}>
            {loadingModels ? '加载中...' : '拉取模型'}
          </button>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">选择模型</option>
            {models.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel assistant-chat-panel">
        <div className="assistant-chat-window">
          {messages.map((item, index) => (
            <article key={`${item.role}-${index}`} className={item.role === 'user' ? 'chat-bubble user' : 'chat-bubble assistant'}>
              <header>{item.role === 'user' ? '你' : '助手'}</header>
              <p>{item.text || '（仅图片）'}</p>
              {item.imageDataUrl ? <img src={item.imageDataUrl} alt="user upload" className="chat-image" /> : null}
            </article>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="assistant-form">
          <div className="assistant-paste-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void handleDropImage(e)}>
            拖拽图片到这里，或在输入框按 Ctrl/Cmd + V 粘贴图片
          </div>

          {imageDataUrl ? (
            <div className="assistant-image-preview">
              <img src={imageDataUrl} alt="待发送图片" className="assistant-thumb" />
              <button type="button" onClick={() => setImageDataUrl('')}>
                移除图片
              </button>
            </div>
          ) : null}

          <div className="field">
            <textarea
              rows={5}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onPaste={(e) => {
                void handlePasteImage(e);
              }}
              className="assistant-composer"
              placeholder="描述你的账单识别需求，例如：请识别收据并按 JSON 返回交易数据。"
            />
          </div>

          <div className="row assistant-actions">
            <button type="submit" className="primary" disabled={!canSubmit || submitting}>
              {submitting ? '发送中...' : '发送给记账助手'}
            </button>
            {retryMessages ? (
              <button type="button" onClick={() => void handleRetry()} disabled={submitting}>
                重试
              </button>
            ) : null}
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>

      {parsedBill ? (
        <section className="panel assistant-json-preview">
          <h3>AI 识别账单 JSON</h3>
          <pre>{JSON.stringify(parsedBill, null, 2)}</pre>
          <button type="button" className="primary" onClick={handleSaveBill}>
            一键保存当前账单
          </button>
        </section>
      ) : null}
    </div>
  );
}
