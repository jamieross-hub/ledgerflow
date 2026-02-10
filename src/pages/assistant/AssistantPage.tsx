import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAiModels, sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { BillPreviewCard } from '../../features/assistant/ui/BillPreviewCard';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { Toast, ToastVariant } from '../../shared/ui/Toast';
import { useFinanceStore } from '../../shared/store/useFinanceStore';

/**
 * 记账助手页面 — 全屏聊天模式
 * - 顶部紧凑模型选择器
 * - 全屏聊天区域（自动滚动到底部）
 * - 底部固定输入栏（支持粘贴/拖拽图片）
 */
interface ChatItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
  imageDataUrls?: string[];
  reasoning?: string;
  parsedBill?: AiBillResult | null;
  createdAt: number;
}

interface AiBillItem {
  type: 'expense' | 'income' | 'budget' | 'repayment';
  amount: number;
  date?: string;
  note?: string;
  category?: string;
  account?: string;
  tags?: string[];
  orderNo?: string;
  merchantOrderNo?: string;
}

interface AiBillResult {
  transactions: AiBillItem[];
}

const JSON_AGENT_PROMPT = `你是 LedgerFlow 个人记账助手，专门帮助用户记录日常生活开支与收入。

你的职责：
1. 识别用户描述的消费或收入信息（如餐饮、交通、工资、购物等日常场景）
2. 结合文字与图片信息进行识别（小票、支付截图、账单截图）
3. 将信息结构化为 JSON 格式返回
4. 仅处理个人日常记账相关内容

请严格按以下 JSON schema 返回，不要返回 markdown 代码块：
{"transactions":[{"type":"expense|income|budget|repayment","amount":number,"date":"YYYY-MM-DD","note":"string","category":"string","account":"string","tags":["string"],"orderNo":"string(可选)","merchantOrderNo":"string(可选)"}]}

规则：
- type 只能是 expense（支出）、income（收入）、budget（预算）、repayment（还款）
- amount 为正数
- date 格式为 YYYY-MM-DD，未提供则用今天日期
- category 必须给出并尽量使用常见生活分类（餐饮、交通、购物、娱乐、居住、医疗、教育、工资、兼职等）
- tags 必须给出，至少 1 个，优先提取场景标签（如 早餐、打车、网购、电影、报销、工资）
- 如识别到交易订单号/商家订单号，必须分别写入 orderNo / merchantOrderNo 字段
- 如未识别到订单号，orderNo / merchantOrderNo 可省略，不要伪造
- 如图片里可识别到商户名/平台名（如 美团、滴滴、支付宝、微信、京东），应体现在 note 或 tags
- 如果信息不完整，按最合理的日常场景推断并在 note 中说明
- 你是一个生活记账工具，只处理个人日常收支记录`;

const CHINA_NETWORK_TIME_API = 'https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp';
const ASSISTANT_MEMORY_KEY = 'ledgerflow-assistant-messages';

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultWelcomeMessage(): ChatItem {
  return {
    id: 'welcome-assistant',
    role: 'assistant',
    text: '你好，我是 LedgerFlow 记账助手 🤖\n\n我可以帮你识别账单、截图，并自动生成结构化的记账数据。\n\n• 直接输入文字描述你的消费\n• 粘贴或拖拽账单截图\n• 我会返回 JSON 账单，支持一键保存',
    createdAt: Date.now()
  };
}

function filterMessagesByDays(messages: ChatItem[], days: number): ChatItem[] {
  const clamped = Math.min(3, Math.max(1, Math.round(days || 1)));
  const cutoff = Date.now() - clamped * 24 * 60 * 60 * 1000;
  const kept = messages.filter((item) => item.id === 'welcome-assistant' || item.createdAt >= cutoff);
  return kept.length > 0 ? kept : [defaultWelcomeMessage()];
}

function restoreAssistantMessages(days: number): ChatItem[] {
  try {
    const raw = window.localStorage.getItem(ASSISTANT_MEMORY_KEY);
    if (!raw) {
      return [defaultWelcomeMessage()];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [defaultWelcomeMessage()];
    }

    const rows: ChatItem[] = parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const row = item as Partial<ChatItem>;
        return {
          id: String(row.id || newMessageId()),
          role: row.role === 'assistant' ? 'assistant' : 'user',
          text: String(row.text || ''),
          imageDataUrl: row.imageDataUrl ? String(row.imageDataUrl) : undefined,
          imageDataUrls: Array.isArray(row.imageDataUrls)
            ? row.imageDataUrls.map((item) => String(item)).filter(Boolean)
            : row.imageDataUrl
              ? [String(row.imageDataUrl)]
              : undefined,
          reasoning: row.reasoning ? String(row.reasoning) : undefined,
          parsedBill: row.parsedBill || undefined,
          createdAt: Number(row.createdAt) || Date.now()
        };
      });

    const withWelcome = rows.some((item) => item.id === 'welcome-assistant')
      ? rows
      : [defaultWelcomeMessage(), ...rows];

    return filterMessagesByDays(withWelcome, days);
  } catch {
    return [defaultWelcomeMessage()];
  }
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function formatChinaTimeText(date: Date): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(date).replace(/\//g, '-');
}

async function fetchChinaNetworkTime(): Promise<{ text: string; source: string } | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(CHINA_NETWORK_TIME_API, {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: { t?: string } };
    const timestamp = Number(payload?.data?.t);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    return {
      text: formatChinaTimeText(new Date(timestamp)),
      source: '中国互联网授时'
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
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

function inferCategoryFromText(type: 'expense' | 'income' | 'budget' | 'repayment', text: string): string {
  const normalized = text.toLowerCase();

  if (type === 'income') {
    if (/工资|salary|payroll|奖金|bonus/.test(normalized)) return '工资';
    if (/兼职|副业|part[-\s]?time|freelance/.test(normalized)) return '兼职';
    return '收入';
  }

  if (/餐|外卖|奶茶|咖啡|food|meal|restaurant/.test(normalized)) return '餐饮';
  if (/地铁|公交|打车|出租|滴滴|交通|taxi|metro|bus/.test(normalized)) return '交通';
  if (/京东|淘宝|拼多多|购物|网购|shop|mall/.test(normalized)) return '购物';
  if (/房租|租金|水电|燃气|物业|居住|rent/.test(normalized)) return '居住';
  if (/医院|药店|体检|医疗|medical|doctor/.test(normalized)) return '医疗';
  if (/电影|演出|游戏|娱乐|music|movie/.test(normalized)) return '娱乐';
  return '支出';
}

function inferTags(type: 'expense' | 'income' | 'budget' | 'repayment', note: string, category: string, currentTags: string[]): string[] {
  const normalized = `${note} ${category}`.toLowerCase();
  const tags = currentTags
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);

  const pushTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 6) {
      tags.push(tag);
    }
  };

  if (type === 'income') {
    pushTag('收入');
  } else if (type === 'budget') {
    pushTag('预算');
  } else if (type === 'repayment') {
    pushTag('还款');
  } else {
    pushTag('支出');
  }

  if (/早餐|早饭|morning/.test(normalized)) pushTag('早餐');
  if (/午餐|中餐|noon/.test(normalized)) pushTag('午餐');
  if (/晚餐|宵夜|dinner/.test(normalized)) pushTag('晚餐');
  if (/滴滴|打车|出租|taxi/.test(normalized)) pushTag('打车');
  if (/地铁|公交|metro|bus/.test(normalized)) pushTag('公共交通');
  if (/支付宝|alipay/.test(normalized)) pushTag('支付宝');
  if (/微信|wechat/.test(normalized)) pushTag('微信');
  if (/京东|淘宝|拼多多|shop/.test(normalized)) pushTag('网购');
  if (/工资|salary|payroll/.test(normalized)) pushTag('工资');

  return tags;
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
    const type =
      candidate.type === 'income'
        ? 'income'
        : candidate.type === 'expense'
          ? 'expense'
          : candidate.type === 'budget'
            ? 'budget'
            : candidate.type === 'repayment'
              ? 'repayment'
              : null;
    const amount = Number(candidate.amount);
    if (!type || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const note = (candidate.note || 'AI 识别账单').trim();
    const category = (candidate.category || '').trim() || inferCategoryFromText(type, note);
    const tags = inferTags(
      type,
      note,
      category,
      Array.isArray(candidate.tags) ? candidate.tags.map((t) => String(t)) : []
    );

    const orderNo = typeof candidate.orderNo === 'string' ? candidate.orderNo.trim() : '';
    const merchantOrderNo = typeof candidate.merchantOrderNo === 'string' ? candidate.merchantOrderNo.trim() : '';

    txs.push({
      type,
      amount,
      date: candidate.date || new Date().toISOString(),
      note,
      category,
      account: candidate.account || '',
      tags,
      orderNo: orderNo || undefined,
      merchantOrderNo: merchantOrderNo || undefined
    });
  }

  if (txs.length === 0) {
    return null;
  }

  return { transactions: txs };
}

function mapAssistantErrorMessage(raw: string): string {
  const text = raw.toLowerCase();

  if (text.includes('http 400') || text.includes('improperly formed request') || text.includes('bad_response_status_code')) {
    return '请求格式有误：模型接口未能解析本次请求。请切换为标准模型后重试，或减少一次发送的内容。';
  }

  if (text.includes('http 401') || text.includes('unauthorized')) {
    return '鉴权失败：请检查 API Key 是否正确、是否过期。';
  }

  if (text.includes('http 403') || text.includes('forbidden')) {
    return '权限不足：当前 API Key 没有该模型的调用权限。';
  }

  if (text.includes('http 404')) {
    return '接口地址或模型不存在：请检查 Base URL 与模型名称。';
  }

  if (text.includes('http 429') || text.includes('rate limit')) {
    return '请求过于频繁：已触发限流，请稍后重试。';
  }

  if (text.includes('http 5')) {
    return '服务暂时不可用：供应商服务异常，请稍后重试。';
  }

  return raw;
}

export function AssistantPage() {
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const setModel = useAiSettings((s) => s.setModel);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addCategory = useFinanceStore((s) => s.addCategory);

  const [models, setModels] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [retryMessages, setRetryMessages] = useState<ChatItem[] | null>(null);
  const [parsedBill, setParsedBill] = useState<AiBillResult | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant; visible: boolean }>({
    message: '',
    variant: 'success',
    visible: false
  });
  const [messages, setMessages] = useState<ChatItem[]>(() => restoreAssistantMessages(memoryDays));

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasApiKey = Boolean(apiKey?.trim());

  const handleClearContext = () => {
    setMessages([defaultWelcomeMessage()]);
    setParsedBill(null);
    setRetryMessages(null);
    setError('');
    setTextInput('');
    setImageDataUrls([]);
    setToast({ message: '已清除上下文记录', variant: 'success', visible: true });
  };

  const canSubmit = useMemo(
    () => hasApiKey && Boolean(model.trim()) && (Boolean(textInput.trim()) || imageDataUrls.length > 0),
    [hasApiKey, model, textInput, imageDataUrls]
  );

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, submitting]);

  // 根据记忆天数过滤历史
  useEffect(() => {
    setMessages((prev) => filterMessagesByDays(prev, memoryDays));
  }, [memoryDays]);

  // 持久化消息（memoryBackend=redis 为后端接入占位）
  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify(messages));
  }, [messages, memoryBackend]);

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
    setImageDataUrls((prev) => [...prev, dataUrl]);
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
        }
      }
    }
  };

  const handleDropImage = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = (Array.from(event.dataTransfer.files || []) as File[]).filter((file: File) => file.type.startsWith('image/'));
    for (const file of files) {
      await handleSetImage(file);
    }
  };

  const handleLoadModels = async () => {
    if (!hasApiKey) {
      setError('请先在设置页填写 OpenAI API Key，再拉取模型。');
      return;
    }

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
    const hasImage = nextMessages.some((item) => Boolean(item.imageDataUrl) || (item.imageDataUrls?.length || 0) > 0);
    const chinaNetworkTime = await fetchChinaNetworkTime();
    const localChinaTime = formatChinaTimeText(new Date());
    const timeContext = chinaNetworkTime
      ? `当前中国标准时间：${chinaNetworkTime.text}（来源：${chinaNetworkTime.source}）。涉及“今天/昨天/本月”等时间词时必须以该时间为准。`
      : `当前中国标准时间：${localChinaTime}（来源：本机时间兜底，网络授时暂不可用）。涉及“今天/昨天/本月”等时间词时优先按该时间推断。`;

    const prompt = `${JSON_AGENT_PROMPT}\n\n${timeContext}\n\n补充要求：${hasImage ? '本次消息包含图片，请优先结合图片识别金额、商户、标签与分类。' : '本次消息无图片，仅根据文本识别。'}`;

    const reply = await sendAiChat({
      baseUrl,
      apiKey,
      model,
      systemPrompt: prompt,
      messages: nextMessages.map((item) => ({
        role: item.role,
        text: item.text,
        imageDataUrl: item.imageDataUrl,
        imageDataUrls: item.imageDataUrls
      }))
    });

    const assistantText = reply.content;
    const assistantReasoning = reply.reasoning;

    let parsed: AiBillResult | null = null;
    try {
      const jsonRaw = extractJsonString(assistantText);
      parsed = normalizeAiBill(JSON.parse(jsonRaw) as unknown);
      setParsedBill(parsed);
    } catch {
      parsed = null;
      setParsedBill(null);
    }

    setMessages((prev: ChatItem[]) => [
      ...prev,
      {
        id: newMessageId(),
        role: 'assistant',
        text: assistantText,
        reasoning: assistantReasoning,
        parsedBill: parsed,
        createdAt: Date.now()
      }
    ]);

    setRetryMessages(null);
    setTextInput('');
    setImageDataUrls([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasApiKey) {
      setError('请先在设置页填写 OpenAI API Key，再开始聊天。');
      return;
    }

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError('');

    const userMessage: ChatItem = {
      id: newMessageId(),
      role: 'user',
      text: textInput.trim(),
      imageDataUrl: imageDataUrls[0] || undefined,
      imageDataUrls: imageDataUrls.length > 0 ? imageDataUrls : undefined,
      createdAt: Date.now()
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setTextInput('');
    setImageDataUrls([]);

    try {
      await sendWithMessages(nextMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : '对话请求失败';
      setError(mapAssistantErrorMessage(message));
      setRetryMessages(nextMessages);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!hasApiKey) {
      setError('请先在设置页填写 OpenAI API Key，再进行重试。');
      return;
    }

    if (!retryMessages) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await sendWithMessages(retryMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : '重试失败';
      setError(mapAssistantErrorMessage(message));
    } finally {
      setSubmitting(false);
    }
  };

  const resolveCategoryId = (name?: string) => {
    const normalized = (name || '').trim();
    if (!normalized) {
      return categories[0]?.id || 'cat-unknown';
    }
    const matched = categories.find((item) => item.name.trim().toLowerCase() === normalized.toLowerCase());
    return matched?.id || categories[0]?.id || 'cat-unknown';
  };

  const ensureCategoryId = (name?: string) => {
    const normalized = (name || '').trim();
    if (!normalized) {
      return resolveCategoryId(normalized);
    }
    const matched = categories.find((item) => item.name.trim().toLowerCase() === normalized.toLowerCase());
    if (matched) {
      return matched.id;
    }
    const newId = addCategory(normalized);
    return newId || categories[0]?.id || 'cat-unknown';
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
      const fallbackCategory = inferCategoryFromText(item.type, item.note || '');
      const finalCategory = (item.category || '').trim() || fallbackCategory;
      const finalTags = inferTags(item.type, item.note || '', finalCategory, item.tags || ['AI识别']);

      addTransaction({
        type: item.type,
        amount: item.amount,
        date: item.date || new Date().toISOString(),
        note: item.note || 'AI 导入账单',
        tags: finalTags,
        categoryId: ensureCategoryId(finalCategory),
        accountId: resolveAccountId(item.account),
        orderNo: item.orderNo?.trim() || undefined,
        merchantOrderNo: item.merchantOrderNo?.trim() || undefined,
        source: 'ai'
      });
    });

    setParsedBill(null);
    setToast({ message: `已保存 ${parsedBill.transactions.length} 条账单`, variant: 'success', visible: true });
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
          <button type="button" className="chat-clear-btn" onClick={handleClearContext} disabled={messages.length <= 1}>
            清除上下文
          </button>
          <small className="chat-topbar-provider">{baseUrl || '未配置供应商'}</small>
        </div>
      </header>

      {/* ===== 聊天消息区 ===== */}
      <div className="chat-messages-area">
        <div className="chat-messages-inner">
          {!hasApiKey ? (
            <section className="chat-key-required">
              <h3>🔐 需要先配置 OpenAI API Key</h3>
              <p>为保证账单助手可正常对话，请先前往设置页填写 API Key，然后返回继续聊天。</p>
              <Link to="/settings" className="chat-key-required-link">
                前往设置页填写 Key
              </Link>
            </section>
          ) : null}

          {messages.map((item) => (
            <article key={item.id} className={item.role === 'user' ? 'chat-msg chat-msg-user' : 'chat-msg chat-msg-assistant'}>
              <div className="chat-msg-avatar">
                {item.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="chat-msg-body">
                <header className="chat-msg-header">{item.role === 'user' ? '你' : '记账助手'}</header>
                <div className="chat-msg-content">
                  <p>{item.text || '（仅图片）'}</p>
                  {(item.imageDataUrls && item.imageDataUrls.length > 0) || item.imageDataUrl ? (
                    <div className="chat-msg-image-grid">
                      {(item.imageDataUrls && item.imageDataUrls.length > 0 ? item.imageDataUrls : item.imageDataUrl ? [item.imageDataUrl] : []).map((url, idx) => (
                        <img key={`${item.id}-img-${idx}`} src={url} alt={`user upload ${idx + 1}`} className="chat-msg-image" />
                      ))}
                    </div>
                  ) : null}
                  {item.reasoning ? (
                    <details className="chat-thinking-box">
                      <summary>思考过程（已折叠）</summary>
                      <div className="chat-thinking-scroll">{item.reasoning}</div>
                    </details>
                  ) : null}
                  {item.parsedBill ? (
                    <section className="chat-auto-card">
                      <strong>已自动识别 {item.parsedBill.transactions.length} 条账单</strong>
                      <button type="button" onClick={() => setParsedBill(item.parsedBill || null)}>
                        查看并保存
                      </button>
                    </section>
                  ) : null}
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
            <BillPreviewCard
              payload={parsedBill}
              onSave={handleSaveBill}
              onSaved={() => setToast({ message: '账单已保存到账本', variant: 'success', visible: true })}
            />
          ) : null}

          {error ? (
            <article className="chat-msg chat-msg-assistant">
              <div className="chat-msg-avatar">⚠️</div>
              <div className="chat-msg-body">
                <header className="chat-msg-header">请求提示</header>
                <div className="chat-msg-content chat-inline-error">
                  <p>{error}</p>
                  {retryMessages ? (
                    <button type="button" onClick={() => void handleRetry()} disabled={submitting}>
                      重试
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ) : null}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ===== 底部输入栏 ===== */}
      <footer className="chat-input-bar">

        {imageDataUrls.length > 0 ? (
          <div className="chat-image-strip">
            <div className="chat-thumb-list" aria-label="待发送图片列表">
              {imageDataUrls.map((url, idx) => (
                <div key={`pending-img-${idx}`} className="chat-thumb-item">
                  <img src={url} alt={`待发送图片 ${idx + 1}`} className="chat-thumb" />
                  <button
                    type="button"
                    className="chat-thumb-remove"
                    onClick={() => setImageDataUrls((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`移除第 ${idx + 1} 张图片`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setImageDataUrls([])}>清空全部</button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="chat-file-input-hidden"
            onChange={(e) => {
              const files = (Array.from(e.target.files || []) as File[]).filter((file: File) => file.type.startsWith('image/'));
              files.forEach((file: File) => {
                void handleSetImage(file);
              });
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="chat-upload-btn"
            title="上传图片（可多选）"
            aria-label="上传图片（可多选）"
            disabled={!hasApiKey}
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
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
            placeholder={
              hasApiKey
                ? '输入消息，Enter 发送 · 支持多图'
                : '请先在设置页填写 API Key'
            }
            disabled={!hasApiKey}
          />
          <button type="submit" className="chat-send-btn primary" disabled={!canSubmit}>
            {submitting ? '⏳' : '➤'}
          </button>
        </form>
      </footer>
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
