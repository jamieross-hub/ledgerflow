import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { SMART_TRANSACTION_COMMANDS } from '../../features/assistant/workbench/workbenchTypes';
import { useAssistantWorkbench } from '../../features/assistant/workbench/useAssistantWorkbench';
import { BillPreviewCard } from '../../features/assistant/ui/BillPreviewCard';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { Toast } from '../../shared/ui/Toast';
import type { TransactionItem } from '../../entities/transaction/types';
import type { Category } from '../../entities/category/types';

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

type AssistantMode = 'bookkeeping' | 'assistant';

interface PresetQuestion {
  id: string;
  text: string;
}

const QUICK_BILL_TEMPLATES = [
  { label: '🍜 午饭 18（支付宝）', prompt: '今天午饭18元，用支付宝支付' },
  { label: '☕ 咖啡 23（微信）', prompt: '今天买咖啡23元，用微信支付' },
  { label: '🚇 地铁 4（零钱）', prompt: '今天地铁4元，用现金支付' },
  { label: '💼 工资入账', prompt: '本月工资到账 12000 元，入账银行卡' }
];

const CHAT_HISTORY_CACHE_KEYS: Record<AssistantMode, string> = {
  bookkeeping: 'ledgerflow.assistant.chatHistory.bookkeeping',
  assistant: 'ledgerflow.assistant.chatHistory.assistant'
};

function readChatHistory(mode: AssistantMode): ChatHistoryItem[] {
  try {
    const raw = window.sessionStorage.getItem(CHAT_HISTORY_CACHE_KEYS[mode]);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatHistoryItem =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.text === 'string'
    );
  } catch {
    return [];
  }
}

function toMonthKey(date: string) {
  return date.slice(0, 7);
}

function buildLocalPresetQuestions(transactions: TransactionItem[], categories: Category[]) {
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
  const expenseRows = [...transactions]
    .filter((item) => item.type === 'expense')
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const monthTotal = (month: string) =>
    expenseRows
      .filter((item) => toMonthKey(item.date) === month)
      .reduce((sum, item) => sum + item.amount, 0);
  const currentTotal = monthTotal(thisMonth);
  const previousTotal = monthTotal(lastMonth);
  const deltaPct = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  const topCategory = Object.values(
    expenseRows.reduce<Record<string, { name: string; amount: number }>>((acc, item) => {
      const name = categoryMap.get(item.categoryId) || '其他';
      if (!acc[name]) acc[name] = { name, amount: 0 };
      acc[name].amount += item.amount;
      return acc;
    }, {})
  ).sort((a, b) => b.amount - a.amount)[0];

  const latest = expenseRows[0];
  const questions = [
    currentTotal > 0
      ? `本月已支出 ¥${currentTotal.toFixed(2)}，相比上月${deltaPct >= 0 ? '增加' : '减少'} ${Math.abs(deltaPct).toFixed(1)}%，要不要拆解一下波动来源？`
      : '你这个月还没形成完整支出曲线，要不要我先帮你建立一套“首月预算模板”？',
    topCategory
      ? `${topCategory.name} 目前累计 ¥${topCategory.amount.toFixed(2)}，是最近最大头支出，要不要看看哪些商户最容易超预算？`
      : '最近消费分类还比较少，要不要先按“餐饮/交通/日用”自动补齐分类建议？',
    latest
      ? `最近一笔是 ${latest.note || '未备注消费'}（¥${latest.amount.toFixed(2)}），要不要顺便检查是否有可合并的重复记账？`
      : '最近还没有消费记录，要不要先试试“午饭 18 元支付宝”快速建一笔？',
    '过去 7 天有哪些“高频小额支出”正在悄悄累加？要不要我按场景给你做一个缩减清单？',
    '如果把本月非必要支出压缩 10%，预计能多结余多少？要不要我给你一个可执行版本？'
  ];

  return questions
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map((text, index) => ({ id: `fallback-${index}`, text }));
}

export function AssistantPage() {
  const [mode, setMode] = useState<AssistantMode>('assistant');
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
    updateTransaction,
    sceneMode: mode
  });

  const [modelOpen, setModelOpen] = useState(false);
  const [presetQuestions, setPresetQuestions] = useState<PresetQuestion[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => readChatHistory(mode));
  const lastAssistantRef = useRef<Record<AssistantMode, string>>({
    bookkeeping: '',
    assistant: ''
  });
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

  // 每次状态或消息变化后，自动将视图滚动到底部，保持聊天体验。
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [wb.status, wb.rawContent, wb.rawReasoning, wb.entries.length, wb.error]);

  const submitPrompt = (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || wb.status === 'recognizing') return;
    setChatHistory((prev) => [...prev, { id: `${Date.now()}-user`, role: 'user', text: clean }]);
    void wb.handleRecognizeWithPrompt(clean);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt(wb.textInput);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!wb.canRecognize || wb.status === 'recognizing') return;
    submitPrompt(wb.textInput);
  };

  // 非记账分析时，模型返回自由文本，解析 JSON 失败属于预期，不展示底部红条。
  const shouldShowError =
    Boolean(wb.error) && !/unexpected token|invalid json|json/i.test(wb.error.toLowerCase());

  useEffect(() => {
    if (!wb.rawContent || wb.rawContent === lastAssistantRef.current[mode]) return;
    lastAssistantRef.current[mode] = wb.rawContent;
    const usageText = wb.lastUsage
      ? `Token 消耗：输入 ${wb.lastUsage.promptTokens} / 输出 ${wb.lastUsage.completionTokens} / 总计 ${wb.lastUsage.totalTokens}`
      : undefined;
    setChatHistory((prev) => [
      ...prev,
      { id: `${Date.now()}-assistant`, role: 'assistant', text: wb.rawContent, usageText }
    ]);
  }, [mode, wb.lastUsage, wb.rawContent]);

  const removeMessage = (id: string) =>
    setChatHistory((prev) => prev.filter((item) => item.id !== id));

  const retryMessage = (index: number) => {
    const previousUser = [...chatHistory]
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user');
    if (!previousUser) return;
    wb.setTextInput(previousUser.text);
    submitPrompt(previousUser.text);
  };

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date());

  const loadPersonalizedQuestions = useCallback(async () => {
    const fallback = () => setPresetQuestions(buildLocalPresetQuestions(transactions, categories));
    if (!apiKey || !model) {
      fallback();
      return;
    }

    setLoadingPresets(true);
    try {
      const snapshot = transactions
        .slice(-120)
        .map((item) => ({
          type: item.type,
          amount: item.amount,
          date: item.date,
          note: item.note,
          categoryId: item.categoryId
        }))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date));
      const categoryMap = categories.map((item) => ({ id: item.id, name: item.name }));
      const randomSeed = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
      const reply = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt:
          '你是记账系统中的数据分析助手。请基于用户账单快照一次性生成 3-5 条“可直接点击提问”的问题。必须具体、包含数字或日期锚点、语气轻松有梗但专业。仅返回 JSON 数组，格式：["问题1","问题2"]，不要输出其他文本。',
        messages: [
          {
            role: 'user',
            text: `随机种子: ${randomSeed}\n分类映射: ${JSON.stringify(categoryMap)}\n最近账单: ${JSON.stringify(snapshot)}`
          }
        ]
      });

      const normalized = reply.content
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '');
      const parsed = JSON.parse(normalized) as unknown;
      if (!Array.isArray(parsed) || parsed.length < 3) {
        fallback();
        return;
      }
      const list = parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 5)
        .map((text, index) => ({ id: `preset-${index}-${Date.now()}`, text: text.trim() }));
      setPresetQuestions(
        list.length >= 3 ? list : buildLocalPresetQuestions(transactions, categories)
      );
    } catch {
      fallback();
    } finally {
      setLoadingPresets(false);
    }
  }, [apiKey, baseUrl, categories, model, transactions]);

  useEffect(() => {
    void loadPersonalizedQuestions();
  }, [loadPersonalizedQuestions]);

  useEffect(() => {
    setChatHistory(readChatHistory(mode));
  }, [mode]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CHAT_HISTORY_CACHE_KEYS[mode], JSON.stringify(chatHistory));
    } catch {
      // ignore storage write errors
    }
  }, [chatHistory, mode]);

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
          <div className="chat-mode-switch" role="tablist" aria-label="模式切换">
            <button
              type="button"
              className={mode === 'bookkeeping' ? 'active' : ''}
              onClick={() => setMode('bookkeeping')}
            >
              AI 记账
            </button>
            <button
              type="button"
              className={mode === 'assistant' ? 'active' : ''}
              onClick={() => setMode('assistant')}
            >
              AI 助手
            </button>
          </div>
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

          {mode === 'bookkeeping' ? (
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
          ) : (
            <section className="chat-kawaii-panel chat-assistant-panel">
              <div className="chat-kawaii-topline">今天 {todayLabel}</div>
              <div className="chat-kawaii-sub">先看数据，再发问，一次就问到重点。</div>
              <div className="chat-preset-head">
                <strong>个性化预设问题</strong>
                <button type="button" onClick={() => void loadPersonalizedQuestions()}>
                  {loadingPresets ? '生成中...' : '换一批'}
                </button>
              </div>
              <div className="chat-preset-list">
                {presetQuestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chat-preset-item"
                    onClick={() => wb.applyCommand(item.text)}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
              <div className="chat-kawaii-mascot" aria-hidden>
                <span>🧾</span>
                <small>数据会说话，我负责翻译成能执行的建议。</small>
              </div>
            </section>
          )}

          <article className="chat-msg">
            <div className="chat-msg-avatar">🤖</div>
            <div className="chat-msg-body">
              <div className="chat-msg-header">
                {mode === 'bookkeeping' ? 'AI 记账助手' : 'AI 问答助手'}
              </div>
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
                  <button
                    type="button"
                    className="chat-icon-action-btn"
                    onClick={() => removeMessage(item.id)}
                    aria-label="删除消息"
                    title="删除消息"
                  >
                    🗑️
                  </button>
                  {item.role === 'assistant' ? (
                    <button
                      type="button"
                      className="chat-secondary-action-btn"
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

          {selectedValidEntries.length > 0 ? (
            <article className="chat-msg">
              <div className="chat-msg-avatar">✅</div>
              <div className="chat-msg-body">
                <div className="chat-msg-header">识别结果</div>
                <BillPreviewCard
                  entries={wb.entries}
                  duplicateCount={duplicateEntriesCount}
                  onCheckDuplicates={wb.checkDuplicates}
                  onSave={wb.saveSelected}
                  onSaved={() => wb.setToastState('账单已写入账本', 'success')}
                />
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
            aria-disabled={!wb.canRecognize || wb.status === 'recognizing'}
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
