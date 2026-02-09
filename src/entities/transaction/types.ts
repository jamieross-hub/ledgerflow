export type TransactionSource = 'manual' | 'wechat' | 'alipay' | 'ai';

export type TransactionType = 'expense' | 'income' | 'budget' | 'repayment';

export interface TransactionItem {
  id: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  amount: number;
  date: string;
  note: string;
  tags: string[];
  source?: TransactionSource;
}
