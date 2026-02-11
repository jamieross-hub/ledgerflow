export function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2
  }).format(value);
}

/** 货币格式化（固定两位小数） */
export function formatCurrencyFixed2(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/** 格式化日期（仅日期） */
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN').format(new Date(value));
}

/** 格式化日期+时间（24小时制） */
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value));
}
