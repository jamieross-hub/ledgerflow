export type TransactionSource = 'manual' | 'wechat' | 'alipay' | 'ai';

export interface TransactionItem {
  id: string;
  type: 'expense' | 'income';
  categoryId: string;
  accountId: string;
  amount: number;
  date: string;
  note: string;
  tags: string[];
  source?: TransactionSource;
}
