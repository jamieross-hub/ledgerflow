export type TransactionSource = 'manual' | 'wechat' | 'alipay' | 'ai';

export type TransactionType = 'expense' | 'income' | 'budget' | 'repayment';

export type TransactionStatus = 'pending' | 'completed' | 'refunded' | 'closed' | 'failed';

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
  orderNo?: string;
  merchantOrderNo?: string;
  status?: TransactionStatus;
}
