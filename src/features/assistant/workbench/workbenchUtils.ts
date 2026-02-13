import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionItem, TransactionType } from '../../../entities/transaction/types';
import type { AiBillItem, AiBillResult, DraftBillEntry, ValidationIssue } from './workbenchTypes';

const MAX_PROMPT_TRANSACTIONS = 240;
const CHINA_NETWORK_TIME_API = 'https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp';

export const JSON_AGENT_PROMPT = `你是 LedgerFlow 个人记账助手，专门处理用户账本中的“记账录入 + 交易分析”。

【任务分流】
1) 当用户是“记账录入/识别账单”意图时：输出结构化 JSON。
2) 当用户是“统计分析/预算预测”意图时：输出中文分析结论，不输出 JSON schema。

【分析约束】
- 分析类回答只能基于我提供的“账本交易数据快照”。
- 禁止编造快照之外的数据；若数据不足，必须明确写“数据不足”。
- 优先围绕交易维度：时间、收支、分类、账户、标签、还款。

【记账 JSON schema（仅录入类请求时使用）】
{"transactions":[{"type":"expense|income|budget|repayment","amount":number,"date":"YYYY-MM-DD","note":"string","category":"string","account":"string","tags":["string"],"sourceHint":"wechat|alipay|bank|cash|unknown","orderNo":"string(可选)","merchantOrderNo":"string(可选)"}]}

【记账规则】
- type 只能是 expense（支出）、income（收入）、budget（预算）、repayment（还款）
- amount 为正数，保留两位小数
- date 格式为 YYYY-MM-DD，未提供则用今天日期
- 必须识别交易来源 sourceHint：如微信/支付宝/银行卡/现金，未知用 unknown
- account 必须与来源一致（例如微信流水优先微信相关账户，支付宝同理）
- category 必须给出并尽量使用常见生活分类；不确定时先给最保守分类
- tags 必须给出，至少 1 个
- 如未识别到订单号，orderNo / merchantOrderNo 可省略，不要伪造`;

function toDateKey(raw?: string): string {
  if (!raw) return '';
  const text = String(raw);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

export function buildTransactionPromptContext(
  transactions: TransactionItem[],
  categories: Category[],
  accounts: Account[]
): string {
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
  const accountMap = new Map(accounts.map((item) => [item.id, item.name]));
  const rows = transactions
    .map((item) => ({
      date: toDateKey(item.date),
      type: item.type,
      amount: Number((Math.round((Number(item.amount) || 0) * 100) / 100).toFixed(2)),
      category: categoryMap.get(item.categoryId) || item.categoryId || '未分类',
      account: accountMap.get(item.accountId || '') || item.accountId || '未指定账户',
      tags: (item.tags || []).slice(0, 6),
      note: String(item.note || '').slice(0, 80)
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_PROMPT_TRANSACTIONS);

  const totals = rows.reduce(
    (acc, item) => {
      if (item.type === 'income') acc.income += item.amount;
      if (item.type === 'expense' || item.type === 'repayment') acc.expense += item.amount;
      if (item.type === 'repayment') acc.repayment += item.amount;
      return acc;
    },
    { income: 0, expense: 0, repayment: 0 }
  );

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalTransactions: transactions.length,
      includedTransactions: rows.length,
      summary: {
        totalIncome: Number(totals.income.toFixed(2)),
        totalExpense: Number(totals.expense.toFixed(2)),
        totalRepayment: Number(totals.repayment.toFixed(2))
      },
      rows
    },
    null,
    2
  );
}

function normalizeType(type: unknown): TransactionType | null {
  if (type === 'expense' || type === 'income' || type === 'budget' || type === 'repayment')
    return type;
  return null;
}

export function normalizeAiBill(raw: unknown): AiBillResult | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as { transactions?: unknown }).transactions)
  )
    return null;
  const txs: AiBillItem[] = [];
  for (const entry of (raw as { transactions: unknown[] }).transactions) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Partial<AiBillItem>;
    const type = normalizeType(row.type);
    const amount = Number(row.amount);
    // 录入金额统一保留两位，避免后续 UI 出现浮点展示噪音。
    const normalizedAmount = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
    if (!type || normalizedAmount <= 0) continue;
    txs.push({
      type,
      amount: normalizedAmount,
      date: row.date || new Date().toISOString(),
      note: String(row.note || 'AI 识别账单'),
      category: String(row.category || ''),
      account: String(row.account || ''),
      tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item)).filter(Boolean) : [],
      sourceHint:
        row.sourceHint === 'wechat' ||
        row.sourceHint === 'alipay' ||
        row.sourceHint === 'bank' ||
        row.sourceHint === 'cash' ||
        row.sourceHint === 'unknown'
          ? row.sourceHint
          : 'unknown',
      orderNo: row.orderNo?.trim() || undefined,
      merchantOrderNo: row.merchantOrderNo?.trim() || undefined
    });
  }
  return txs.length > 0 ? { transactions: txs } : null;
}

export function extractJsonString(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const generic = text.match(/```\s*([\s\S]*?)```/i);
  if (generic?.[1]) return generic[1].trim();
  return text.trim();
}

export function validateDraft(entry: DraftBillEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(entry.amount) || entry.amount <= 0)
    issues.push({ field: 'amount', message: '金额必须大于 0' });
  if (!entry.date || Number.isNaN(new Date(entry.date).getTime()))
    issues.push({ field: 'date', message: '日期格式无效' });
  if (!normalizeType(entry.type)) issues.push({ field: 'type', message: '交易类型无效' });
  return issues;
}

export function toDraftEntries(payload: AiBillResult): DraftBillEntry[] {
  return payload.transactions.map((item, index) => {
    const entry: DraftBillEntry = {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      selected: true,
      type: item.type,
      amount: Number((Math.round((Number(item.amount) || 0) * 100) / 100).toFixed(2)),
      date: item.date || new Date().toISOString(),
      note: item.note || '',
      category: item.category || '',
      account: item.account || '',
      tags: item.tags || [],
      sourceHint: item.sourceHint || 'unknown',
      orderNo: item.orderNo,
      merchantOrderNo: item.merchantOrderNo,
      issues: []
    };
    return { ...entry, issues: validateDraft(entry) };
  });
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function formatChinaTimeText(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .format(date)
    .replace(/\//g, '-');
}

export async function buildTimeContext(): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(CHINA_NETWORK_TIME_API, {
      method: 'GET',
      signal: controller.signal
    });
    const payload = (await response.json()) as { data?: { t?: string } };
    const timestamp = Number(payload?.data?.t);
    if (response.ok && Number.isFinite(timestamp) && timestamp > 0) {
      return `当前中国标准时间：${formatChinaTimeText(new Date(timestamp))}（来源：中国互联网授时）。`;
    }
  } catch {
    // ignore
  } finally {
    window.clearTimeout(timer);
  }
  return `当前中国标准时间：${formatChinaTimeText(new Date())}（来源：本机时间兜底）。`;
}
