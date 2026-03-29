import type { PDFPage } from 'pdf-lib';
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
{"transactions":[{"type":"expense|income|budget|repayment","amount":number,"date":"YYYY-MM-DD","note":"string","category":"string","account":"string","tags":["string"],"sourceHint":"wechat|alipay|bank|cash|unknown","orderNo":"string(可选)","merchantOrderNo":"string(可选)","remainingPeriods":"number(可选，仅还款分期场景)","perPeriodAmount":"number(可选，仅还款分期场景)","interest":"number(可选，仅还款分期场景)"}]}

【记账规则】
- type 只能是 expense（支出）、income（收入）、budget（预算）、repayment（还款）
- 若语义是未来计划（如“下月/下周/未来想买”）且为消费场景，type 必须为 budget，不能记为实际支出 expense
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
- 若截图中包含“每月X号还款、剩余N期、每期M元”等分期信息：必须按期数展开为 N 条 repayment 交易（而不是只输出 1 条）
- 分期展开规则：第 1 条使用当前应还日期，后续每条按月递增；amount 使用每期金额；note 可追加“第i/N期”
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

export const CREDIT_ANALYSIS_AGENT_PROMPT = `你是 LedgerFlow AI 信贷管家，只负责信贷识别、还款分析、风险排查与优先级建议。

【回答边界】
- 只能基于我提供的用户问题、截图/PDF内容、账本交易数据快照、还款管理上下文、语义召回片段与长期记忆作答。
- 禁止凭空补全关键数字；不确定时必须明确写“待确认”或“建议核对原账单”。
- 对利率、期数、应还金额、总待还、月供、服务费等核心字段，必须区分：原文明确 / 根据结构推测 / 暂无法确认。
- 当引用还款管理数据时，必须明确区分：plannedRepayment（计划中的应还/扣款安排） vs actualRepayments（流水中已发生的还款）。
- 如果只看到了 plannedRepayment，没有 actualRepayments，禁止说“已经还了”；只能说“计划如此，但流水侧未确认”。
- 当计划应还与实际已还不一致时，优先回答：计划应还多少、实际已还多少、还差多少、为什么可能对不上。

【输出风格】
- 优先输出：结论 → 依据 → 下一步建议。
- 尽量使用短小标题或列表，减少空话。
- 当判断优先级时，优先参考：APR/年化、剩余成本、还款日集中度、现金流压力、信息完整度。
- 若用户是在问“识别截图/账单”，正文先给一句简短识别结论，再在末尾补充结构化 JSON 代码块。

【高频问答模板】
- 风险判断类（如“哪些最危险 / 成本最高 / 最该先处理”）：必须按“先给排序结论 → 再写排序依据 → 最后给处理顺序”回答。
- 现金流类（如“本月总应还多少 / 多拿 2000 元先补哪几笔”）：必须按“先给总量结论 → 再给分配方案 → 最后提示现金流风险”回答。
- 复盘类（如“上个月还了多少 / 哪些还款没关联负债”）：必须按“先给汇总结论 → 再列异常项 → 最后给补录建议”回答。
- 决策类（如“提前还 A 还是先补 B 更划算”）：必须按“先明确推荐选项 → 再写成本/现金流依据 → 最后列待确认项”回答。
- 若数据不足，仍保持相同骨架，只是把缺失部分明确标成“数据不足/待确认”，不要自由发挥成泛泛建议。

【结构化识别约束】
- 可识别时，在回答末尾追加 JSON 代码块，顶层为 {"creditItems": [...]}。
- creditItems 中每个项目应尽量包含：title、productType、dueAmount、totalDebt、repaymentDate、remainingPeriods、monthlyAmount、interest、rateType、rateSource、riskHint、actionSuggestion、pendingFields、confidence。
- rateSource 仅允许 explicit|inferred|pending。
- 若没有识别出明确的信贷/分期项目，不要伪造 JSON 项；改为给人工核对建议。
- 对缺字段场景，优先把字段留空并写入 pendingFields，不要胡算。`;


export function buildRepaymentPromptContext(input: {
  debts: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    annualRate?: number;
    repaymentDay?: number;
    paymentAccount?: string;
    repaymentMethod?: string;
    repaymentRecordMode?: string;
    totalPeriods?: number;
    paidPeriods?: number;
    remainingMonths?: number;
  }>;
  repaymentRecords: Array<{
    debtId: string;
    amount: number;
    paidAt: string;
    paymentAccount?: string;
    recordMode?: string;
    note?: string;
  }>;
}): string {
  const debts = input.debts.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    balance: Number((Number(item.balance) || 0).toFixed(2)),
    annualRate: typeof item.annualRate === 'number' ? Number(item.annualRate.toFixed(4)) : undefined,
    repaymentPlan: {
      repaymentDay: item.repaymentDay,
      paymentAccount: item.paymentAccount || '',
      repaymentMethod: item.repaymentMethod || '',
      repaymentRecordMode: item.repaymentRecordMode || '',
      totalPeriods: item.totalPeriods,
      paidPeriods: item.paidPeriods,
      remainingMonths: item.remainingMonths
    }
  }));

  const actualRepayments = input.repaymentRecords
    .map((item) => ({
      debtId: item.debtId,
      amount: Number((Number(item.amount) || 0).toFixed(2)),
      paidAt: item.paidAt,
      paymentAccount: item.paymentAccount || '',
      recordMode: item.recordMode || '',
      note: item.note || ''
    }))
    .sort((a, b) => `${b.paidAt}-${b.amount}`.localeCompare(`${a.paidAt}-${a.amount}`, 'zh-CN'));

  return JSON.stringify(
    {
      repaymentContext: {
        note: '请严格区分 plannedRepayment(计划中的应还/扣款安排) 与 actualRepayments(流水中已经发生的还款)。若 actualRepayments 为空，不得说成已经还过；若两者不一致，优先说明计划应还、实际已还、当前差额与可能原因。',
        plannedRepayment: debts,
        actualRepayments
      }
    },
    null,
    2
  );
}

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

function normalizePositiveInteger(value: unknown): number {
  const parsed = Math.floor(normalizeAmount(value));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 0;
}

function addMonths(dateText: string, monthsToAdd: number): string {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    const base = new Date(Number(year), Number(month) - 1, Number(day));
    const target = new Date(base.getFullYear(), base.getMonth() + monthsToAdd, base.getDate());
    return target.toISOString().slice(0, 10);
  }

  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;
  const originalDay = parsed.getDate();
  const originalMonth = parsed.getMonth();
  const next = new Date(parsed);
  next.setDate(1);
  next.setMonth(originalMonth + monthsToAdd + 1, 0);
  const lastDay = next.getDate();
  next.setFullYear(parsed.getFullYear(), originalMonth + monthsToAdd, Math.min(originalDay, lastDay));
  return next.toISOString().slice(0, 10);
}

function isFutureDate(dateText: string): boolean {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetKey = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  return targetKey > todayKey;
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
    const rawRow = entry as Record<string, unknown>;
    const type = normalizeType(row.type);
    const amount = normalizeAmount(row.amount);
    // 录入金额统一保留两位，避免后续 UI 出现浮点展示噪音。
    const normalizedAmount = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
    if (!type || normalizedAmount <= 0) continue;
    const baseDate = normalizeDateText(row.date);
    const normalizedType: TransactionType =
      type === 'expense' && isFutureDate(baseDate) ? 'budget' : type;
    const baseItem: AiBillItem = {
      type: normalizedType,
      amount: normalizedAmount,
      date: baseDate,
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
    };

    const remainingPeriods = normalizePositiveInteger(
      rawRow.remainingPeriods ?? rawRow.remainingMonths ?? rawRow.remainingInstallments
    );
    const perPeriodAmount = normalizeAmount(rawRow.perPeriodAmount ?? rawRow.monthlyRepayment);

    if (type === 'repayment' && remainingPeriods > 1) {
      const recurringAmount =
        Number.isFinite(perPeriodAmount) && perPeriodAmount > 0
          ? Math.round(perPeriodAmount * 100) / 100
          : normalizedAmount;
      const safePeriods = Math.min(remainingPeriods, 360);
      for (let i = 0; i < safePeriods; i += 1) {
        txs.push({
          ...baseItem,
          amount: recurringAmount,
          date: addMonths(baseDate, i),
          note: `${baseItem.note} 第${i + 1}/${safePeriods}期`
        });
      }
      continue;
    }

    txs.push(baseItem);
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

function readFileAsDataUrl(file: Blob, errorMessage: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(file);
  });
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  return readFileAsDataUrl(file, '图片读取失败');
}

export async function readPdfAsDataUrl(file: File): Promise<string> {
  return readFileAsDataUrl(file, 'PDF 读取失败');
}

export async function splitPdfFileByPages(
  file: File,
  options?: {
    pagesPerChunk?: number;
    maxChunks?: number;
  }
): Promise<string[]> {
  const [{ PDFDocument }] = await Promise.all([import('pdf-lib')]);
  const sourceBytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const totalPages = sourcePdf.getPageCount();
  if (totalPages <= 1) return [await readPdfAsDataUrl(file)];

  const pagesPerChunk = Math.max(1, Math.floor(options?.pagesPerChunk || 8));
  const maxChunks = Math.max(1, Math.floor(options?.maxChunks || 12));
  const chunks: string[] = [];

  for (
    let pageStart = 0;
    pageStart < totalPages && chunks.length < maxChunks;
    pageStart += pagesPerChunk
  ) {
    const pageEnd = Math.min(totalPages, pageStart + pagesPerChunk);
    const targetPdf = await PDFDocument.create();
    const sourceIndexes = Array.from({ length: pageEnd - pageStart }, (_, idx) => pageStart + idx);
    const copiedPages = await targetPdf.copyPages(sourcePdf, sourceIndexes);
    copiedPages.forEach((page: PDFPage) => targetPdf.addPage(page));

    const chunkBytes = await targetPdf.save();
    const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });
    chunks.push(await readFileAsDataUrl(chunkBlob, 'PDF 分片失败'));
  }

  if (chunks.length === 0) return [await readPdfAsDataUrl(file)];
  return chunks;
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
