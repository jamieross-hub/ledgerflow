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
import { Link, useNavigate } from 'react-router-dom';
import { sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { useAssistantWorkbench } from '../../features/assistant/workbench/useAssistantWorkbench';
import { BillPreviewCard } from '../../features/assistant/ui/BillPreviewCard';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import {
  getTransactionDirection,
  summarizeTransactions
} from '../../shared/lib/transactionMetrics';
import { Toast } from '../../shared/ui/Toast';
import type { DraftBillEntry } from '../../features/assistant/workbench/workbenchTypes';
import type { TransactionItem } from '../../entities/transaction/types';
import type { Category } from '../../entities/category/types';

function inputPlaceholder(
  status: ReturnType<typeof useAssistantWorkbench>['status'],
  hasApiKey: boolean,
  mode: AssistantMode
): string {
  if (!hasApiKey) return '请先在设置中配置 API Key';

  const assistantHint = '例如：我这个月花多了吗？\n例如：餐饮支出占比多少？';
  const bookkeepingHint = '比如：今天午饭15元，用支付宝（会自动识别分类）';

  switch (status) {
    case 'idle':
      return mode === 'assistant' ? assistantHint : `等待输入内容 · ${bookkeepingHint}`;
    case 'ready':
      return mode === 'assistant'
        ? `支持自然语言提问 · 按 Enter 发送，Shift + Enter 换行\n${assistantHint}`
        : '可开始识别 · 按 Enter 发送，Shift + Enter 换行';
    case 'recognizing':
      return '模型识别中，请稍候…';
    case 'preview':
      return '识别完成，可继续补充描述或直接保存到账本';
    case 'saving':
      return '正在保存账单，请稍候…';
    case 'saved':
      return '保存成功，可继续输入下一笔';
    case 'error':
      return '识别失败，请调整描述后重试';
    default:
      return mode === 'assistant' ? assistantHint : bookkeepingHint;
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

  const parseTableRow = (line: string) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());

  const isTableSeparator = (line: string) => {
    const cells = parseTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const isTableRow = (line: string) => /^\|.+\|$/.test(line);

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

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx].trim();
    if (!line) {
      flushBullets();
      continue;
    }

    const nextLine = lines[idx + 1]?.trim() || '';
    if (isTableRow(line) && isTableSeparator(nextLine)) {
      flushBullets();
      const headerCells = parseTableRow(line);
      const rows: string[][] = [];
      idx += 2;
      while (idx < lines.length) {
        const rowLine = lines[idx].trim();
        if (!isTableRow(rowLine)) break;
        const rowCells = parseTableRow(rowLine);
        if (rowCells.length > 0) rows.push(rowCells);
        idx += 1;
      }
      idx -= 1;

      nodes.push(
        <div key={`md-table-${nodes.length}`} className="chat-md-table-wrap">
          <table className="chat-md-table">
            <thead>
              <tr>
                {headerCells.map((cell, cellIdx) => (
                  <th key={`md-th-${cellIdx}`}>{renderInlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={`md-tr-${rowIdx}`}>
                  {headerCells.map((_, colIdx) => (
                    <td key={`md-td-${rowIdx}-${colIdx}`}>
                      {renderInlineMarkdown(row[colIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
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
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      bullets.push(`${numberedMatch[1]}. ${numberedMatch[2]}`);
      continue;
    }

    flushBullets();
    nodes.push(
      <p key={`md-p-${idx}`} className="chat-md-paragraph">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  flushBullets();
  return nodes;
}

interface ChatHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageDataUrls?: string[];
  pdfDataUrls?: string[];
  usageText?: string;
  reasoningText?: string;
}

type AssistantMode = 'bookkeeping' | 'assistant';

interface PresetQuestion {
  id: string;
  label: string;
  prompt: string;
}

interface PushInsight {
  id: string;
  title: string;
  detail: string;
  level?: 'default' | 'warning';
}

interface DuplicateReviewPair {
  entry: DraftBillEntry;
  existing: TransactionItem;
}

const ANALYSIS_SHORTCUT_SEEDS = [
  {
    label: '最近1个月消费分析',
    prompt:
      '请结合我近30天账单，从总额、主要分类、异常波动和可优化动作四个角度做一份简洁分析，并给出3条可执行建议。'
  },
  {
    label: '下个月还款预算',
    prompt:
      '基于我最近账单的固定支出和消费节奏，帮我制定下个月还款与现金流预算方案，包含保守/常规两档。'
  },
  {
    label: '近3个月收支趋势',
    prompt: '请按月对比我最近3个月的收入、支出和结余变化，指出趋势拐点，并说明最可能的影响因素。'
  },
  {
    label: '大额支出识别',
    prompt:
      '请识别我最近3个月中金额异常偏高的支出，标注时间、分类、金额及可能原因，并给出下月规避策略。'
  }
];

const CHAT_HISTORY_CACHE_KEYS: Record<AssistantMode, string> = {
  bookkeeping: 'ledgerflow.assistant.chatHistory.bookkeeping',
  assistant: 'ledgerflow.assistant.chatHistory.assistant'
};

const PRESET_QUESTIONS_CACHE_KEY = 'ledgerflow.assistant.personalizedPresets.v1';
const PRESET_QUESTIONS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

interface CachedPresetQuestion {
  label: string;
  prompt: string;
}

interface PresetQuestionsCachePayload {
  signature: string;
  updatedAt: number;
  questions: CachedPresetQuestion[];
}

function withPresetIds(questions: CachedPresetQuestion[], namespace: string): PresetQuestion[] {
  return questions.map((item, index) => ({
    id: `${namespace}-${index}`,
    label: item.label,
    prompt: item.prompt
  }));
}

function buildPresetQuestionsSignature(transactions: TransactionItem[], categories: Category[]) {
  const txSignature = transactions
    .slice(-120)
    .map((item) => `${item.date}|${item.type}|${item.amount}|${item.categoryId}|${item.note ?? ''}`)
    .join('~');
  const categorySignature = categories
    .map((item) => `${item.id}:${item.name}`)
    .sort()
    .join('~');
  return `${transactions.length}:${categories.length}:${categorySignature}:${txSignature}`;
}

function readPresetQuestionsCache(signature: string): CachedPresetQuestion[] | null {
  try {
    const raw = window.localStorage.getItem(PRESET_QUESTIONS_CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as PresetQuestionsCachePayload;
    if (
      !payload ||
      payload.signature !== signature ||
      Date.now() - payload.updatedAt > PRESET_QUESTIONS_CACHE_TTL_MS ||
      !Array.isArray(payload.questions)
    ) {
      return null;
    }
    return payload.questions.filter(
      (item): item is CachedPresetQuestion =>
        Boolean(item) && typeof item.label === 'string' && typeof item.prompt === 'string'
    );
  } catch {
    return null;
  }
}

function writePresetQuestionsCache(signature: string, questions: CachedPresetQuestion[]) {
  try {
    const payload: PresetQuestionsCachePayload = {
      signature,
      updatedAt: Date.now(),
      questions
    };
    window.localStorage.setItem(PRESET_QUESTIONS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage write errors
  }
}

function readChatHistory(mode: AssistantMode): ChatHistoryItem[] {
  try {
    const raw = window.sessionStorage.getItem(CHAT_HISTORY_CACHE_KEYS[mode]);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ChatHistoryItem =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.text === 'string'
      )
      .map((item) => ({
        ...item,
        imageDataUrls: Array.isArray(item.imageDataUrls)
          ? item.imageDataUrls.filter(
              (url): url is string => typeof url === 'string' && url.length > 0
            )
          : [],
        pdfDataUrls: Array.isArray(item.pdfDataUrls)
          ? item.pdfDataUrls.filter(
              (url): url is string => typeof url === 'string' && url.length > 0
            )
          : []
      }));
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
  const generated = [
    {
      label: '本月波动拆解',
      prompt:
        currentTotal > 0
          ? `请围绕本月支出¥${currentTotal.toFixed(2)}（较上月${deltaPct >= 0 ? '增加' : '减少'}${Math.abs(deltaPct).toFixed(1)}%）分析波动来源，并给出具体控费动作。`
          : '我当前月度消费数据不完整，请先给我一套适用于首月记账的预算框架和执行步骤。'
    },
    {
      label: '大头分类诊断',
      prompt: topCategory
        ? `请重点分析“${topCategory.name}”累计¥${topCategory.amount.toFixed(2)}的构成，识别高风险场景并给我可落地的替代方案。`
        : '请先帮我补齐常用消费分类，并设计一套方便执行的分类记账规范。'
    },
    {
      label: '最近消费复盘',
      prompt: latest
        ? `请基于我最近一笔“${latest.note || '未备注消费'}（¥${latest.amount.toFixed(2)}）”，检查是否存在重复记账、误分类或可优化开销。`
        : '我还没有最新消费记录，请先给我一份从零开始的消费复盘清单。'
    },
    {
      label: '7天小额拦截',
      prompt:
        '请统计我过去7天高频小额支出，按“可砍/可替代/保留”分类，并给出一周内可执行的缩减方案。'
    },
    {
      label: '10%节流测算',
      prompt: '如果本月非必要支出降低10%，请测算预计结余提升，并给我3条最值得优先执行的行动建议。'
    }
  ];

  return [...ANALYSIS_SHORTCUT_SEEDS, ...generated]
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .map((item, index) => ({ id: `fallback-${index}`, ...item }));
}

function buildAssistantConversationPrompt(question: string, history: ChatHistoryItem[]): string {
  const context = history
    .slice(-6)
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.text}`)
    .join('\n');
  if (!context) return question;
  return `请结合以下最近对话上下文连续回答，避免重复追问已确认的信息。\n\n最近对话：\n${context}\n\n当前问题：${question}`;
}

export function AssistantPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AssistantMode>('assistant');
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const setModel = useAiSettings((s) => s.setModel);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const addAccount = useFinanceStore((s) => s.addAccount);
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
    addAccount,
    addTransaction,
    updateTransaction,
    sceneMode: mode
  });

  const [modelOpen, setModelOpen] = useState(false);
  const [presetQuestions, setPresetQuestions] = useState<PresetQuestion[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => readChatHistory(mode));
  const todayKey = new Date().toISOString().slice(0, 10);
  const thisMonthKey = todayKey.slice(0, 7);
  const previousMonthDate = new Date();
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const latestTransaction = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .find((item) => item.type !== 'budget') ?? null,
    [transactions]
  );
  const lastAssistantRef = useRef<Record<AssistantMode, string>>({
    bookkeeping: '',
    assistant: ''
  });
  const pendingRequestModeRef = useRef<AssistantMode>('assistant');
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateReviewPairs, setDuplicateReviewPairs] = useState<DuplicateReviewPair[]>([]);
  const [duplicateReviewIndex, setDuplicateReviewIndex] = useState(0);
  const [overwriteEntryIds, setOverwriteEntryIds] = useState<string[]>([]);

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

  const currentDuplicateReview =
    duplicateReviewPairs.length > 0 ? duplicateReviewPairs[duplicateReviewIndex] : null;

  const startDuplicateReview = () => {
    const selectedRows = wb.entries.filter((item) => item.selected && item.issues.length === 0);
    if (selectedRows.length === 0) {
      return wb.saveSelected();
    }

    const pairs = selectedRows
      .filter((item) => item.duplicateTxId)
      .map((item) => {
        const existing = transactions.find((tx) => tx.id === item.duplicateTxId);
        if (!existing) return null;
        return { entry: item, existing };
      })
      .filter((item): item is DuplicateReviewPair => Boolean(item));

    if (pairs.length === 0) {
      return wb.saveSelected();
    }

    setDuplicateReviewPairs(pairs);
    setDuplicateReviewIndex(0);
    setOverwriteEntryIds([]);
    setDuplicateReviewOpen(true);
    return false;
  };

  const commitDuplicateReview = (nextOverwriteIds: string[]) => {
    const ok = wb.saveSelected({ overwriteDuplicateEntryIds: nextOverwriteIds });
    if (ok) {
      wb.setToastState('账单已写入账本', 'success');
    }
    setDuplicateReviewOpen(false);
    setDuplicateReviewPairs([]);
    setDuplicateReviewIndex(0);
    setOverwriteEntryIds([]);
  };

  const handleDuplicateDecision = (shouldOverwrite: boolean) => {
    if (!currentDuplicateReview) return;
    const entryId = currentDuplicateReview.entry.id;
    const nextOverwriteIds = shouldOverwrite
      ? Array.from(new Set([...overwriteEntryIds, entryId]))
      : overwriteEntryIds.filter((id) => id !== entryId);

    if (duplicateReviewIndex >= duplicateReviewPairs.length - 1) {
      commitDuplicateReview(nextOverwriteIds);
      return;
    }

    setOverwriteEntryIds(nextOverwriteIds);
    setDuplicateReviewIndex((prev) => prev + 1);
  };

  const handleCancelDuplicateReview = () => {
    setDuplicateReviewOpen(false);
    setDuplicateReviewPairs([]);
    setDuplicateReviewIndex(0);
    setOverwriteEntryIds([]);
    wb.setToastState('已取消重复账单处理，本次未保存', 'warning');
  };

  const assistantOverview = useMemo(() => {
    const validRows = transactions.filter(
      (item) => item.type === 'income' || item.type === 'expense'
    );
    const todayRows = validRows.filter((item) => item.date.slice(0, 10) === todayKey);
    const todaySummary = summarizeTransactions(todayRows);
    const todayIncome = todaySummary.incomeTotal;
    const todayExpense = todaySummary.expenseTotal;
    const todayNet = todaySummary.netTotal;

    const monthRows = validRows.filter((item) => item.date.startsWith(thisMonthKey));
    const prevMonthRows = validRows.filter((item) => item.date.startsWith(previousMonthKey));
    const monthSummary = summarizeTransactions(monthRows);
    const prevMonthSummary = summarizeTransactions(prevMonthRows);
    const monthExpense = monthSummary.expenseTotal;
    const prevMonthExpense = prevMonthSummary.expenseTotal;
    const monthIncome = monthSummary.incomeTotal;
    const prevMonthIncome = prevMonthSummary.incomeTotal;

    const expenseDeltaPct =
      prevMonthExpense > 0 ? ((monthExpense - prevMonthExpense) / prevMonthExpense) * 100 : 0;
    const incomeDeltaPct =
      prevMonthIncome > 0 ? ((monthIncome - prevMonthIncome) / prevMonthIncome) * 100 : 0;

    const recentExpenseRows = [...validRows]
      .filter((item) => item.type === 'expense' && item.adjustmentKind !== 'refund')
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 30);
    const avgExpense =
      recentExpenseRows.length > 0
        ? recentExpenseRows.reduce((sum, item) => sum + item.amount, 0) / recentExpenseRows.length
        : 0;
    const abnormalRow = recentExpenseRows.find(
      (item) => item.amount >= Math.max(avgExpense * 2.2, 500)
    );

    const monthBalance = monthIncome - monthExpense;
    const weeklyRows = validRows.filter((item) => {
      const gap = Math.floor((Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24));
      return gap >= 0 && gap < 14;
    });
    const thisWeekExpense = summarizeTransactions(
      weeklyRows.filter((item) => item.type === 'expense').slice(0, 7)
    ).expenseTotal;
    const lastWeekExpense = summarizeTransactions(
      weeklyRows.filter((item) => item.type === 'expense').slice(7, 14)
    ).expenseTotal;
    const weeklyExpenseDeltaPct =
      lastWeekExpense > 0 ? ((thisWeekExpense - lastWeekExpense) / lastWeekExpense) * 100 : 0;

    const creditAccountCount = accounts.filter((item) => item.type === 'credit').length;

    const pushInsights: PushInsight[] = [
      {
        id: 'weekly-expense-delta',
        title:
          lastWeekExpense > 0
            ? `近7天餐饮/日常消费较上周${weeklyExpenseDeltaPct >= 0 ? '增加' : '下降'} ${Math.abs(weeklyExpenseDeltaPct).toFixed(1)}%`
            : '近7天消费记录已更新，建议继续补齐一周数据后看趋势',
        detail:
          lastWeekExpense > 0
            ? `本周支出 ¥${thisWeekExpense.toFixed(2)}，上周 ¥${lastWeekExpense.toFixed(2)}。`
            : `当前累计支出 ¥${thisWeekExpense.toFixed(2)}。`,
        level: weeklyExpenseDeltaPct > 15 ? 'warning' : 'default'
      },
      {
        id: 'credit-reminder',
        title:
          creditAccountCount > 0
            ? `检测到 ${creditAccountCount} 个信用账户，建议提前核对下周还款计划`
            : '尚未配置信用卡账户，可在还款管理页补充后获取到期提醒',
        detail:
          creditAccountCount > 0
            ? '可在还款管理页统一查看信用卡/负债余额，避免临期资金紧张。'
            : '完善账户后，我会基于账户结构持续给出还款相关提醒。',
        level: creditAccountCount > 0 ? 'warning' : 'default'
      }
    ];
    const insights = [
      `本月累计支出 ¥${monthExpense.toFixed(2)}，较上月${expenseDeltaPct >= 0 ? '上升' : '下降'} ${Math.abs(expenseDeltaPct).toFixed(1)}%。`,
      `本月收入趋势${incomeDeltaPct >= 0 ? '向上' : '回落'}，变化幅度 ${Math.abs(incomeDeltaPct).toFixed(1)}%，建议同步调整预算。`,
      `当前月净额 ¥${monthBalance.toFixed(2)}，${monthBalance >= 0 ? '收支结构整体稳健。' : '建议关注可压缩支出项。'}`
    ];

    return {
      todayIncome,
      todayExpense,
      todayNet,
      monthlySummary:
        monthExpense > 0
          ? `本月消费 ¥${monthExpense.toFixed(2)}，主要建议聚焦高频小额与突发大额两类支出。`
          : '本月消费数据较少，建议先连续记录 7 天后再进行结构分析。',
      incomeTrend:
        prevMonthIncome > 0
          ? `收入较上月${incomeDeltaPct >= 0 ? '增长' : '下降'} ${Math.abs(incomeDeltaPct).toFixed(1)}%。`
          : '收入趋势基线不足，建议持续记录每笔收入来源。',
      abnormalReminder: abnormalRow
        ? `发现异常支出：${abnormalRow.note || '未备注'} ¥${abnormalRow.amount.toFixed(2)}（${abnormalRow.date.slice(5)}）。`
        : '暂无明显异常支出，当前波动在正常区间。',
      insights,
      pushInsights,
      riskAlert:
        monthBalance < 0
          ? '风险提示：本月净额为负，建议优先削减非必要消费并预留还款缓冲。'
          : '风险提示：当前净额为正，但仍建议为突发支出预留至少 10% 安全垫。'
    };
  }, [accounts, previousMonthKey, thisMonthKey, todayKey, transactions]);

  const behaviorRecommendedQuestions = useMemo(() => {
    const categoryNameMap = new Map(categories.map((item) => [item.id, item.name]));
    const recentExpenses = [...transactions]
      .filter((item) => item.type === 'expense')
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 25);
    const topRecentCategory = Object.values(
      recentExpenses.reduce<Record<string, { name: string; amount: number }>>((acc, item) => {
        const name = categoryNameMap.get(item.categoryId) || '其他';
        if (!acc[name]) acc[name] = { name, amount: 0 };
        acc[name].amount += item.amount;
        return acc;
      }, {})
    ).sort((a, b) => b.amount - a.amount)[0];

    const fallback: PresetQuestion[] = [
      {
        id: 'behavior-fallback-1',
        label: '本月支出压力点',
        prompt: '请结合我最近账单，指出本月最容易超支的 3 个场景，并给出逐条控费动作。'
      },
      {
        id: 'behavior-fallback-2',
        label: '下周现金流提醒',
        prompt: '请基于最近消费节奏，预测我下周资金压力，并给出可执行的预算分配建议。'
      }
    ];

    if (!topRecentCategory) return fallback;

    return [
      {
        id: 'behavior-top-category',
        label: `重点看${topRecentCategory.name}`,
        prompt: `请专项分析我最近在“${topRecentCategory.name}”上的支出结构，说明可立刻执行的降本动作。`
      },
      {
        id: 'behavior-trend-check',
        label: '最近行为趋势',
        prompt: '请结合我最近 14 天消费，找出 2 个行为变化趋势，并说明对应的预算影响。'
      }
    ];
  }, [categories, transactions]);

  // 每次状态或消息变化后，自动将视图滚动到底部，保持聊天体验。
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [wb.status, wb.rawContent, wb.rawReasoning, wb.entries.length, wb.error]);

  // 当 AI 助手/AI 记账收到新的助手回复时，始终自动滚到底部。
  useEffect(() => {
    const latestMessage = chatHistory[chatHistory.length - 1];
    if (!latestMessage || latestMessage.role !== 'assistant') return;
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, mode]);

  const appendMessageToMode = useCallback(
    (targetMode: AssistantMode, message: ChatHistoryItem) => {
      if (targetMode === mode) {
        setChatHistory((prev) => [...prev, message]);
        return;
      }
      const next = [...readChatHistory(targetMode), message];
      try {
        window.sessionStorage.setItem(CHAT_HISTORY_CACHE_KEYS[targetMode], JSON.stringify(next));
      } catch {
        // ignore storage write errors
      }
    },
    [mode]
  );

  const submitPrompt = (prompt: string) => {
    const clean = prompt.trim();
    const hasAttachments = wb.imageDataUrls.length > 0 || wb.pdfDataUrls.length > 0;
    if (wb.status === 'recognizing' || (!clean && !hasAttachments)) return;

    const requestQuestion = clean || '请根据我上传的附件完成识别与提炼。';
    const requestPrompt =
      mode === 'assistant'
        ? buildAssistantConversationPrompt(requestQuestion, chatHistory)
        : requestQuestion;
    const imagePayload = [...wb.imageDataUrls];
    const pdfPayload = [...wb.pdfDataUrls];

    pendingRequestModeRef.current = mode;
    setChatHistory((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        role: 'user',
        text: clean || '（仅发送附件）',
        imageDataUrls: imagePayload,
        pdfDataUrls: pdfPayload
      }
    ]);
    wb.setTextInput('');
    void wb.handleRecognizeWithPrompt(requestPrompt, {
      imageDataUrls: imagePayload,
      pdfDataUrls: pdfPayload
    });
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
    const responseMode = pendingRequestModeRef.current;
    if (!wb.rawContent || wb.rawContent === lastAssistantRef.current[responseMode]) return;
    lastAssistantRef.current[responseMode] = wb.rawContent;
    const usageText = wb.lastUsage
      ? `Token 消耗：输入 ${wb.lastUsage.promptTokens} / 输出 ${wb.lastUsage.completionTokens} / 总计 ${wb.lastUsage.totalTokens}`
      : undefined;
    appendMessageToMode(responseMode, {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      text: wb.rawContent,
      usageText,
      reasoningText: wb.rawReasoning || undefined
    });
  }, [appendMessageToMode, wb.lastUsage, wb.rawContent, wb.rawReasoning]);

  const removeMessage = (id: string) =>
    setChatHistory((prev) => prev.filter((item) => item.id !== id));

  const retryMessage = (index: number) => {
    const previousUser = [...chatHistory]
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user');
    if (!previousUser) return;
    wb.setTextInput(previousUser.text === '（仅发送附件）' ? '' : previousUser.text);
    wb.setImageDataUrls(previousUser.imageDataUrls || []);
    wb.setPdfDataUrls(previousUser.pdfDataUrls || []);
    submitPrompt(previousUser.text === '（仅发送附件）' ? '' : previousUser.text);
  };

  const retryLastPrompt = () => {
    const latestUser = [...chatHistory].reverse().find((item) => item.role === 'user');
    if (!latestUser) return;
    wb.setTextInput(latestUser.text === '（仅发送附件）' ? '' : latestUser.text);
    wb.setImageDataUrls(latestUser.imageDataUrls || []);
    wb.setPdfDataUrls(latestUser.pdfDataUrls || []);
    submitPrompt(latestUser.text === '（仅发送附件）' ? '' : latestUser.text);
  };

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  }).format(new Date());

  const aiRequestContextRef = useRef({ baseUrl, apiKey, model });

  useEffect(() => {
    aiRequestContextRef.current = { baseUrl, apiKey, model };
  }, [apiKey, baseUrl, model]);

  const loadPersonalizedQuestions = useCallback(
    async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
      const signature = buildPresetQuestionsSignature(transactions, categories);
      const fallback = () => {
        const local = buildLocalPresetQuestions(transactions, categories);
        setPresetQuestions(local);
        writePresetQuestionsCache(
          signature,
          local.map((item) => ({ label: item.label, prompt: item.prompt }))
        );
      };

      if (!forceRefresh) {
        const cached = readPresetQuestionsCache(signature);
        if (cached) {
          setPresetQuestions(withPresetIds(cached, 'preset-cache'));
          return;
        }
      }

      const {
        baseUrl: currentBaseUrl,
        apiKey: currentApiKey,
        model: currentModel
      } = aiRequestContextRef.current;

      if (!currentApiKey || !currentModel) {
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
          baseUrl: currentBaseUrl,
          apiKey: currentApiKey,
          model: currentModel,
          systemPrompt:
            '你是记账系统中的数据分析助手。请基于用户账单快照一次性生成 4 条快捷提问。每条都要返回 label 和 prompt：label 供 UI 展示（8-16字，像按钮标题），prompt 是实际发送给模型的完整指令（更宽泛、包含分析目标与输出要求，不能与 label 相同）。仅返回 JSON 数组，格式：[{"label":"...","prompt":"..."}]，不要输出其他文本。',
          messages: [
            {
              role: 'user',
              text: `随机种子: ${randomSeed}
分类映射: ${JSON.stringify(categoryMap)}
最近账单: ${JSON.stringify(snapshot)}`
            }
          ]
        });

        const normalized = reply.content
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/```$/, '');
        const parsed = JSON.parse(normalized) as unknown;
        if (!Array.isArray(parsed) || parsed.length < 2) {
          fallback();
          return;
        }
        const list = parsed
          .filter(
            (item): item is { label: string; prompt: string } =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as { label?: string }).label === 'string' &&
              typeof (item as { prompt?: string }).prompt === 'string'
          )
          .map((item) => ({ label: item.label.trim(), prompt: item.prompt.trim() }))
          .filter((item) => item.label && item.prompt && item.label !== item.prompt)
          .slice(0, 4);

        const nextQuestions =
          list.length >= 2
            ? [...ANALYSIS_SHORTCUT_SEEDS, ...list]
            : buildLocalPresetQuestions(transactions, categories).map((item) => ({
                label: item.label,
                prompt: item.prompt
              }));

        setPresetQuestions(withPresetIds(nextQuestions, 'preset'));
        writePresetQuestionsCache(signature, nextQuestions);
      } catch {
        fallback();
      } finally {
        setLoadingPresets(false);
      }
    },
    [categories, transactions]
  );

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
          <div className="chat-mode-switch" aria-label="模式切换">
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
          <button
            type="button"
            className="chat-secondary-action-btn"
            onClick={() => navigate('/transactions/new?quick=1')}
          >
            记一笔
          </button>
          <button
            type="button"
            className="chat-clear-btn"
            onClick={() => {
              setChatHistory([]);
              wb.resetWorkbench();
              try {
                window.sessionStorage.removeItem(CHAT_HISTORY_CACHE_KEYS[mode]);
              } catch {
                // ignore storage write errors
              }
            }}
            disabled={chatHistory.length === 0}
          >
            清空上下文
          </button>
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
              <div className="chat-kawaii-mascot" aria-hidden>
                <span>૮₍ ˶•⤙•˶ ₎ა</span>
                <small>来嘛来嘛，点我就能秒记账～</small>
              </div>
            </section>
          ) : (
            <section className="chat-kawaii-panel chat-assistant-panel">
              <div className="chat-assistant-hero">
                <h2>🤖 你好，我是你的财务助手</h2>
                <p>先看关键数据，再像聊天一样提问，我会主动给你可执行建议。</p>
              </div>
              <div className="chat-auto-insight-block">
                <p>
                  <strong>本月消费总结：</strong>
                  {assistantOverview.monthlySummary}
                </p>
                <p>
                  <strong>收入趋势变化：</strong>
                  {assistantOverview.incomeTrend}
                </p>
                <p>
                  <strong>异常支出提醒：</strong>
                  {assistantOverview.abnormalReminder}
                </p>
              </div>
              <div className="chat-insight-list" aria-label="主动洞察">
                {assistantOverview.insights.map((insight) => (
                  <p key={insight}>💡 {insight}</p>
                ))}
                <p className="chat-risk-alert">⚠️ {assistantOverview.riskAlert}</p>
              </div>
              <div className="chat-push-insights" aria-label="主动洞察推送">
                {assistantOverview.pushInsights.map((item) => (
                  <article
                    key={item.id}
                    className={`chat-push-insight-item ${item.level === 'warning' ? 'warning' : ''}`}
                  >
                    <h4>{item.title}</h4>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
              <div className="chat-preset-head">
                <strong>智能场景提问</strong>
                <button
                  type="button"
                  onClick={() => void loadPersonalizedQuestions({ forceRefresh: true })}
                >
                  {loadingPresets ? '生成中...' : '换一批'}
                </button>
              </div>
              <div className="chat-preset-list chat-preset-list-smart">
                {behaviorRecommendedQuestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chat-preset-item chat-preset-item-smart"
                    onClick={() => submitPrompt(item.prompt)}
                    disabled={wb.status === 'recognizing'}
                  >
                    <span className="chat-preset-item-tag">最近行为推荐</span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
              <div className="chat-preset-list">
                {presetQuestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chat-preset-item"
                    onClick={() => submitPrompt(item.prompt)}
                    disabled={wb.status === 'recognizing'}
                  >
                    {item.label}
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
                <p>
                  {mode === 'assistant'
                    ? `今天 ${todayLabel}，我已为你准备好今日概览与主动洞察，直接用自然语言继续问我。`
                    : '输入一句话或贴截图，我会帮你快速生成可保存账单。'}
                </p>
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
                {item.role === 'user' &&
                ((item.imageDataUrls && item.imageDataUrls.length > 0) ||
                  (item.pdfDataUrls && item.pdfDataUrls.length > 0)) ? (
                  <div className="chat-image-strip chat-msg-attachments">
                    <div className="chat-thumb-list">
                      {(item.imageDataUrls || []).map((url, idx) => (
                        <div className="chat-thumb-item" key={`sent-img-${item.id}-${idx}`}>
                          <img className="chat-thumb" src={url} alt={`发送图片${idx + 1}`} />
                        </div>
                      ))}
                      {(item.pdfDataUrls || []).map((url, idx) => (
                        <div
                          className="chat-thumb-item"
                          key={`sent-pdf-${item.id}-${idx}-${url.slice(0, 12)}`}
                        >
                          <div
                            className="chat-thumb"
                            style={{ display: 'grid', placeItems: 'center' }}
                          >
                            📄 PDF
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {item.role === 'assistant' && item.reasoningText ? (
                  <details className="chat-reasoning-collapse">
                    <summary>模型思考过程（点击展开）</summary>
                    <pre>{item.reasoningText}</pre>
                  </details>
                ) : null}
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
                  onSave={startDuplicateReview}
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
        {shouldShowError ? (
          <div className="chat-error-strip" role="alert">
            <span>{wb.error}</span>
            <button type="button" onClick={retryLastPrompt} disabled={wb.status === 'recognizing'}>
              重试
            </button>
          </div>
        ) : null}

        {wb.imageDataUrls.length > 0 || wb.pdfDataUrls.length > 0 ? (
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
              {wb.pdfDataUrls.map((url, idx) => (
                <div className="chat-thumb-item" key={`pending-pdf-${idx}-${url.slice(0, 12)}`}>
                  <div className="chat-thumb" style={{ display: 'grid', placeItems: 'center' }}>
                    📄 PDF
                  </div>
                  <button
                    type="button"
                    className="chat-thumb-remove"
                    onClick={() => wb.setPdfDataUrls((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                wb.setImageDataUrls([]);
                wb.setPdfDataUrls([]);
              }}
            >
              清空附件
            </button>
          </div>
        ) : null}

        <p className="chat-disclaimer">AI 生成内容仅供参考，请结合原始账单核对后再保存。</p>

        {latestTransaction ? (
          <div className="chat-latest-bill" aria-label="最近一笔账单">
            <span>最近一笔</span>
            <strong>
              {latestTransaction.note || '未备注'} ·
              {getTransactionDirection(latestTransaction) === 'inflow' ? ' +' : ' -'}¥
              {latestTransaction.amount.toFixed(2)}
            </strong>
          </div>
        ) : null}

        <form className="chat-input-form" onSubmit={onSubmit}>
          <button
            type="button"
            className="chat-upload-btn"
            title="上传图片/PDF"
            onClick={() => wb.fileInputRef.current?.click()}
            disabled={wb.status === 'recognizing'}
          >
            ＋
          </button>

          <textarea
            ref={wb.textareaRef}
            className="chat-input-textarea"
            rows={3}
            placeholder={inputPlaceholder(wb.status, wb.hasApiKey, mode)}
            value={wb.textInput}
            onChange={(e) => wb.setTextInput(e.target.value)}
            onPaste={(e) => void wb.handlePasteImage(e)}
            onKeyDown={onInputKeyDown}
          />

          <input
            ref={wb.fileInputRef}
            className="chat-file-input-hidden"
            type="file"
            accept="image/*,application/pdf"
            title="上传账单图片或 PDF"
            aria-label="上传账单图片或 PDF"
            onChange={(e) => void wb.handleSetFile(e.target.files?.[0])}
          />

          <button
            type={wb.status === 'recognizing' ? 'button' : 'submit'}
            className={`chat-send-btn ${wb.status === 'recognizing' ? 'chat-send-btn-stop' : ''}`}
            title={wb.status === 'recognizing' ? '停止' : '发送'}
            onClick={wb.status === 'recognizing' ? wb.stopRecognize : undefined}
            disabled={wb.status !== 'recognizing' && !wb.canRecognize}
          >
            {wb.status === 'recognizing' ? '■' : '↑'}
          </button>
        </form>
      </section>

      {duplicateReviewOpen && currentDuplicateReview ? (
        <div className="dialog-overlay" role="presentation" onClick={handleCancelDuplicateReview}>
          <section
            className="dialog chat-dup-compare-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="重复账单对比确认"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dialog-header">
              重复账单确认（{duplicateReviewIndex + 1}/{duplicateReviewPairs.length}）
            </header>
            <div className="dialog-body chat-dup-compare-body">
              <p className="chat-dup-compare-tip">
                请核对左侧新识别数据与右侧已有账单，确认是否覆盖旧账单。
              </p>
              <div className="chat-dup-compare-grid">
                <article className="chat-dup-compare-card is-new">
                  <h4>新数据（AI 识别）</h4>
                  <dl>
                    <div>
                      <dt>日期</dt>
                      <dd>{currentDuplicateReview.entry.date.slice(0, 10)}</dd>
                    </div>
                    <div>
                      <dt>类型</dt>
                      <dd>{currentDuplicateReview.entry.type}</dd>
                    </div>
                    <div>
                      <dt>金额</dt>
                      <dd>¥{currentDuplicateReview.entry.amount.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>分类</dt>
                      <dd>{currentDuplicateReview.entry.category || '未分类'}</dd>
                    </div>
                    <div>
                      <dt>账户</dt>
                      <dd>{currentDuplicateReview.entry.account || '未指定账户'}</dd>
                    </div>
                    <div>
                      <dt>备注</dt>
                      <dd>{currentDuplicateReview.entry.note || '—'}</dd>
                    </div>
                  </dl>
                </article>
                <article className="chat-dup-compare-card is-existing">
                  <h4>已有账单（命中重复）</h4>
                  <dl>
                    <div>
                      <dt>日期</dt>
                      <dd>{currentDuplicateReview.existing.date.slice(0, 10)}</dd>
                    </div>
                    <div>
                      <dt>类型</dt>
                      <dd>{currentDuplicateReview.existing.type}</dd>
                    </div>
                    <div>
                      <dt>金额</dt>
                      <dd>¥{currentDuplicateReview.existing.amount.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>分类</dt>
                      <dd>
                        {categories.find(
                          (item) => item.id === currentDuplicateReview.existing.categoryId
                        )?.name || '未分类'}
                      </dd>
                    </div>
                    <div>
                      <dt>账户</dt>
                      <dd>
                        {accounts.find(
                          (item) => item.id === currentDuplicateReview.existing.accountId
                        )?.name || '未指定账户'}
                      </dd>
                    </div>
                    <div>
                      <dt>备注</dt>
                      <dd>{currentDuplicateReview.existing.note || '—'}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>
            <footer className="dialog-footer chat-dup-compare-footer">
              <button type="button" onClick={handleCancelDuplicateReview}>
                取消本次保存
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => handleDuplicateDecision(false)}
              >
                保留旧账单并新增
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => handleDuplicateDecision(true)}
              >
                覆盖旧账单
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <Toast
        message={wb.toast.message}
        variant={wb.toast.variant}
        visible={wb.toast.visible}
        onClose={() => wb.setToastVisible(false)}
      />
    </div>
  );
}
