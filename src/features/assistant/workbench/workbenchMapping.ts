import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionType } from '../../../entities/transaction/types';
import type { DraftBillEntry } from './workbenchTypes';

export function inferCategoryFromText(type: TransactionType, text: string): string {
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

export function inferTags(
  type: TransactionType,
  note: string,
  category: string,
  currentTags: string[]
): string[] {
  const normalized = `${note} ${category}`.toLowerCase();
  const tags = currentTags
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 6);
  const pushTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 6) tags.push(tag);
  };
  if (type === 'income') pushTag('收入');
  else if (type === 'budget') pushTag('预算');
  else if (type === 'repayment') pushTag('还款');
  else pushTag('支出');
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

export function resolveCategoryId(name: string | undefined, categories: Category[]): string {
  const normalized = (name || '').trim();
  if (!normalized) return categories[0]?.id || 'cat-unknown';
  const matched = categories.find(
    (item) => item.name.trim().toLowerCase() === normalized.toLowerCase()
  );
  return matched?.id || categories[0]?.id || 'cat-unknown';
}

export function ensureCategoryId(
  name: string | undefined,
  categories: Category[],
  addCategory: (name: string) => string
): string {
  const normalized = (name || '').trim();
  if (!normalized) return resolveCategoryId(normalized, categories);
  const matched = categories.find(
    (item) => item.name.trim().toLowerCase() === normalized.toLowerCase()
  );
  if (matched) return matched.id;
  return addCategory(normalized) || categories[0]?.id || 'cat-unknown';
}

export function resolveAccountId(name: string | undefined, accounts: Account[]): string {
  const normalized = (name || '').trim().toLowerCase();
  const matched = accounts.find((item) => item.name.trim().toLowerCase() === normalized);
  return matched?.id || accounts[0]?.id || 'acc-unknown';
}

export function mapAssistantErrorMessage(raw: string): string {
  const text = raw.toLowerCase();
  if (
    text.includes('http 400') ||
    text.includes('improperly formed request') ||
    text.includes('bad_response_status_code')
  ) {
    return '请求格式有误：模型接口未能解析本次请求。请切换标准模型后重试。';
  }
  if (text.includes('http 401') || text.includes('unauthorized'))
    return '鉴权失败：请检查 API Key。';
  if (text.includes('http 403') || text.includes('forbidden'))
    return '权限不足：当前 API Key 无模型访问权限。';
  if (text.includes('http 404')) return '接口地址或模型不存在：请检查 Base URL 与模型名称。';
  if (text.includes('http 429') || text.includes('rate limit'))
    return '请求过于频繁：已触发限流，请稍后重试。';
  if (text.includes('http 5')) return '服务暂时不可用：供应商服务异常，请稍后重试。';
  return raw;
}

export function toPayloadRows(entries: DraftBillEntry[]) {
  return entries
    .filter((item) => item.selected && item.issues.length === 0)
    .map((item) => ({
      type: item.type === 'unknown' ? 'expense' : item.type,
      amount: item.amount,
      date: item.date,
      note: item.note,
      category: item.category,
      account: item.account,
      tags: item.tags,
      orderNo: item.orderNo,
      merchantOrderNo: item.merchantOrderNo
    }));
}
