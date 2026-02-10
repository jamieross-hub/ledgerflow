import { TransactionItem, TransactionStatus } from '../../entities/transaction/types';

type BillSource = 'wechat' | 'alipay';

interface ParseBillInput {
  csvText: string;
  source: BillSource;
  defaultCategoryId: string;
  defaultAccountId: string;
}

const DATE_KEYS = ['交易时间', '入账时间', '创建时间', '交易创建时间', '付款时间', '完成时间', '最近修改时间'];
const AMOUNT_KEYS = ['金额', '金额(元)', '金额（元）', '订单金额', '交易金额', '收/支金额'];
const TYPE_KEYS = ['收/支', '收支类型', '交易类型', '资金类型', '类型'];
const NOTE_KEYS = ['商品名称', '商品', '商品说明', '交易对方', '备注', '商户', '收款方'];
const STATUS_KEYS = ['交易状态', '当前状态', '状态'];
const ORDER_NO_KEYS = ['交易号', '交易订单号', '订单号'];
const MERCHANT_ORDER_NO_KEYS = ['商家订单号', '商户订单号'];

const HEADER_HINT_KEYS = [
  ...DATE_KEYS,
  ...AMOUNT_KEYS,
  ...TYPE_KEYS,
  ...NOTE_KEYS,
  ...STATUS_KEYS,
  ...ORDER_NO_KEYS,
  ...MERCHANT_ORDER_NO_KEYS
];

function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
}

function parseDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^\uFEFF/, '').trim());
}

function detectDelimiter(lines: string[]): ',' | '\t' {
  let commaScore = 0;
  let tabScore = 0;

  const sample = lines.slice(0, Math.min(lines.length, 60));
  sample.forEach((line) => {
    commaScore += (line.match(/,/g) || []).length;
    tabScore += (line.match(/\t/g) || []).length;
  });

  return tabScore > commaScore ? '\t' : ',';
}

function pickByKeys(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const matched = Object.keys(row).find((k) => k.includes(key));
    if (matched && row[matched]) {
      return row[matched];
    }
  }
  return '';
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[¥￥,\s]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function parseType(row: Record<string, string>, amountRaw: string): 'income' | 'expense' {
  const typeText = pickByKeys(row, TYPE_KEYS);
  const all = `${typeText} ${amountRaw}`;

  if (/收入|收款|入账|退款|退回|转入|收入到账|收/i.test(all)) {
    return 'income';
  }

  if (/支出|付款|消费|转出|支付|扣款|不计收支|支/i.test(all)) {
    return 'expense';
  }

  return amountRaw.trim().startsWith('-') ? 'expense' : 'income';
}

function parseStatus(row: Record<string, string>): TransactionStatus | undefined {
  const status = pickByKeys(row, STATUS_KEYS);
  if (!status) {
    return undefined;
  }

  if (/关闭/.test(status)) return 'closed';
  if (/失败/.test(status)) return 'failed';
  if (/退款/.test(status)) return 'refunded';
  if (/成功|完成|已收款|已到账/.test(status)) return 'completed';
  if (/待|确认中|发货|收入|支出/.test(status)) return 'pending';

  return undefined;
}

function shouldSkipByStatus(row: Record<string, string>): boolean {
  const status = pickByKeys(row, STATUS_KEYS);
  if (!status) {
    return false;
  }

  return /失败|撤销|未支付/.test(status);
}

function parseDate(raw: string): string {
  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-').trim();
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}

function isLikelyHeader(cells: string[]): boolean {
  if (cells.length < 4) {
    return false;
  }

  const hitCount = cells.reduce((count, cell) => {
    const matched = HEADER_HINT_KEYS.some((key) => cell.includes(key));
    return matched ? count + 1 : count;
  }, 0);

  const hasAmount = cells.some((cell) => AMOUNT_KEYS.some((key) => cell.includes(key)));
  const hasDate = cells.some((cell) => DATE_KEYS.some((key) => cell.includes(key)));

  return hitCount >= 3 && hasAmount && hasDate;
}

function findHeaderIndex(lines: string[], delimiter: ',' | '\t'): number {
  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const line = lines[i];
    if (/^-{4,}$/.test(line) || /^—{4,}$/.test(line)) {
      continue;
    }

    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < 4) {
      continue;
    }

    const score = cells.reduce((count, cell) => {
      return HEADER_HINT_KEYS.some((key) => cell.includes(key)) ? count + 1 : count;
    }, 0);

    if (score > bestScore && isLikelyHeader(cells)) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    return bestIndex;
  }

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (/交易号|商家订单号|交易创建时间|金额|收\/支/.test(lines[i])) {
      return i;
    }
  }

  return 0;
}

function buildNote(row: Record<string, string>, source: BillSource): string {
  const counterparty = pickByKeys(row, ['交易对方', '收款方', '商户']);
  const goods = pickByKeys(row, ['商品名称', '商品', '商品说明']);
  const remark = pickByKeys(row, ['备注']);
  const sourcePrefix = source === 'wechat' ? '微信账单导入' : '支付宝账单导入';

  const parts = [counterparty, goods, remark].map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) {
    return sourcePrefix;
  }

  return `${sourcePrefix}：${parts.join(' · ')}`;
}

function shouldSkipRow(line: string): boolean {
  if (!line) {
    return true;
  }

  if (/^[-—]+$/.test(line)) {
    return true;
  }

  if (/^支付宝交易记录明细查询|^微信支付账单明细|^账号:|^起始日期:|^终止日期:|交易记录明细列表/.test(line)) {
    return true;
  }

  return false;
}

export function parseBillCsvToTransactions(input: ParseBillInput): Omit<TransactionItem, 'id'>[] {
  const text = normalizeText(input.csvText);
  if (!text) {
    return [];
  }

  const lines = text
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines);
  const headerIndex = findHeaderIndex(lines, delimiter);
  const headers = parseDelimitedLine(lines[headerIndex], delimiter);
  const rows = lines.slice(headerIndex + 1);
  const result: Omit<TransactionItem, 'id'>[] = [];

  for (const line of rows) {
    if (shouldSkipRow(line)) {
      continue;
    }

    const cols = parseDelimitedLine(line, delimiter);
    if (cols.length < 2) {
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) {
        row[h] = cols[idx] ?? '';
      }
    });

    if (shouldSkipByStatus(row)) {
      continue;
    }

    const amountRaw = pickByKeys(row, AMOUNT_KEYS);
    const amount = parseAmount(amountRaw);
    if (amount <= 0) {
      continue;
    }

    const dateRaw = pickByKeys(row, DATE_KEYS);
    const orderNo = pickByKeys(row, ORDER_NO_KEYS) || undefined;
    const merchantOrderNo = pickByKeys(row, MERCHANT_ORDER_NO_KEYS) || undefined;
    const status = parseStatus(row);

    result.push({
      type: parseType(row, amountRaw),
      amount,
      date: parseDate(dateRaw),
      note: buildNote(row, input.source),
      tags: [input.source === 'wechat' ? '微信导入' : '支付宝导入'],
      categoryId: input.defaultCategoryId,
      accountId: input.defaultAccountId,
      source: input.source,
      orderNo,
      merchantOrderNo,
      status
    });
  }

  return result;
}
