import { TransactionItem } from '../../entities/transaction/types';

type BillSource = 'wechat' | 'alipay';

interface ParseBillInput {
  csvText: string;
  source: BillSource;
  defaultCategoryId: string;
  defaultAccountId: string;
}

const DATE_KEYS = ['交易时间', '入账时间', '创建时间', '交易创建时间', '付款时间', '完成时间'];
const AMOUNT_KEYS = ['金额', '金额(元)', '金额（元）', '订单金额', '交易金额', '收/支金额'];
const TYPE_KEYS = ['收/支', '收支类型', '交易类型', '资金类型'];
const NOTE_KEYS = ['商品', '商品名称', '商品说明', '交易对方', '备注', '商户', '收款方'];
const STATUS_KEYS = ['交易状态', '当前状态', '状态'];

function parseCsvLine(line: string): string[] {
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

    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result.map((item) => item.replace(/^\uFEFF/, '').trim());
}

function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
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

  if (/收入|收款|入账|退款|退回|转入|收入到账/i.test(all)) {
    return 'income';
  }

  if (/支出|付款|消费|转出|支付|扣款/i.test(all)) {
    return 'expense';
  }

  return amountRaw.trim().startsWith('-') ? 'expense' : 'income';
}

function shouldSkipByStatus(row: Record<string, string>): boolean {
  const status = pickByKeys(row, STATUS_KEYS);
  if (!status) {
    return false;
  }

  return /关闭|失败|撤销|未支付|已退款/i.test(status);
}

function parseDate(raw: string): string {
  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-').trim();
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
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

  // 找到第一行“疑似表头”
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (/交易|金额|时间|收\/支|状态/.test(lines[i])) {
      headerIndex = i;
      break;
    }
  }

  const headers = parseCsvLine(lines[headerIndex]);
  const rows = lines.slice(headerIndex + 1);
  const result: Omit<TransactionItem, 'id'>[] = [];

  for (const line of rows) {
    const cols = parseCsvLine(line);
    if (cols.length < 2) {
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
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
    const noteRaw = pickByKeys(row, NOTE_KEYS);

    const type = parseType(row, amountRaw);
    const notePrefix = input.source === 'wechat' ? '微信账单导入' : '支付宝账单导入';

    result.push({
      type,
      amount,
      date: parseDate(dateRaw),
      note: noteRaw ? `${notePrefix}：${noteRaw}` : notePrefix,
      tags: [input.source === 'wechat' ? '微信导入' : '支付宝导入'],
      categoryId: input.defaultCategoryId,
      accountId: input.defaultAccountId
    });
  }

  return result;
}
