import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionItem, TransactionType } from '../../../entities/transaction/types';
import type { AiBillItem, AiBillResult, DraftBillEntry, ValidationIssue } from './workbenchTypes';

const MAX_PROMPT_TRANSACTIONS = 1200;
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
- note 不要照抄用户原话，必须输出“有规律的快捷记账短语”：
  - 结构优先：{场景/商户}{行为}{金额锚点}，示例“午餐-食堂 28”“通勤地铁 4”“工资入账 12000”
  - 长度建议 6-16 个汉字，避免口语助词和完整复述（如“今天我在…然后…”）
  - 多笔交易时每笔 note 风格保持一致，使用同一命名模式（如都用“品类+对象+金额”）
- 必须识别交易来源 sourceHint：如微信/支付宝/银行卡/现金，未知用 unknown
- account 必须优先使用账本快照中的 availableAccounts 已有账户名，且与来源一致（例如微信流水优先微信相关账户，支付宝同理）
- 账户决策要先判断“是否需要新建账户”：仅在用户明确指定账户名，或你能高置信识别到具体账户名（如“平安银行”）时，才输出新账户名
- 若不确定具体账户名，account 输出空字符串，不要虚构泛化名（如“银行卡”“银行账户”）
- category 必须给出并尽量使用常见生活分类；若为贷款/信用卡等还款账单，type 必须为 repayment，category 优先“还款”
- 对账单截图中出现“还款金额/应还/已还/月供/房贷/车贷/贷款扣款”等语义，优先识别为 repayment
- tags 必须给出，至少 1 个
- 如未识别到订单号，orderNo / merchantOrderNo 可省略，不要伪造`;

export const ANALYSIS_AGENT_PROMPT = `你是 LedgerFlow 数据分析助手，只负责账本问答与消费分析，不负责生成可落库的记账 JSON。

【回答边界】
- 只能基于我提供的“账本交易数据快照”回答。
- 禁止捏造快照外的数据；若数据不足，必须明确说明“数据不足”。
- 输出简洁中文结论，优先给可执行建议。

【输出要求】
- 不输出 JSON schema。
- 可以使用小标题、列表、对比结论。
- 金额统一为人民币格式，时间尽量明确到日/周/月。`;

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
  const normalizedAll = transactions
    .map((item) => ({
      date: toDateKey(item.date),
      type: item.type,
      amount: Number((Math.round((Number(item.amount) || 0) * 100) / 100).toFixed(2)),
      category: categoryMap.get(item.categoryId) || item.categoryId || '未分类',
      account: accountMap.get(item.accountId || '') || item.accountId || '未指定账户',
      tags: (item.tags || []).slice(0, 6),
      note: String(item.note || '').slice(0, 80)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const rows = normalizedAll.slice(0, MAX_PROMPT_TRANSACTIONS);

  const allDates = normalizedAll
    .map((item) => item.date)
    .filter(Boolean)
    .sort();
  const coveredFrom = allDates[0] || '';
  const coveredTo = allDates[allDates.length - 1] || '';

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
      availableAccounts: accounts.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type || 'unknown'
      })),
      dateCoverage: {
        from: coveredFrom,
        to: coveredTo
      },
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

function normalizeAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[¥￥,\s]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateText(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return new Date().toISOString();
  const source = value.trim();
  const chinese = source.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (chinese) {
    const [, y, m, d] = chinese;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const slash = source.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (slash) {
    const [, y, m, d] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return source;
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
    const amount = normalizeAmount(row.amount);
    // 录入金额统一保留两位，避免后续 UI 出现浮点展示噪音。
    const normalizedAmount = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
    if (!type || normalizedAmount <= 0) continue;
    txs.push({
      type,
      amount: normalizedAmount,
      date: normalizeDateText(row.date),
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

  const transactionMatch = /\{\s*"transactions"/.exec(text);
  const transactionStart = transactionMatch?.index ?? -1;
  if (transactionStart >= 0) {
    let depth = 0;
    for (let i = transactionStart; i < text.length; i += 1) {
      const char = text[i];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        return text.slice(transactionStart, i + 1).trim();
      }
    }
  }
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
