export type TransactionSource = 'manual' | 'wechat' | 'alipay' | 'ai';

export type TransactionType = 'expense' | 'income' | 'budget' | 'repayment';

export type TransactionStatus = 'pending' | 'completed' | 'refunded' | 'closed' | 'failed';

export type TransactionAdjustmentKind = 'normal' | 'refund' | 'reversal';

export type BalanceChangeType =
  | 'transaction-income'
  | 'transaction-expense'
  | 'transaction-budget'
  | 'transaction-repayment'
  | 'transaction-refund'
  | 'manual-adjustment';

export interface TransactionAttachmentItem {
  id: string;
  name: string;
  uploadedAt: string;
  remotePath: string;
  mimeType?: string;
  size?: number;
}

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
  adjustmentKind?: TransactionAdjustmentKind;
  refundOfTransactionId?: string;
  attachments?: TransactionAttachmentItem[];
  updatedAt?: string;
  trashedAt?: string;
}

export interface BalanceChangeEntry {
  id: string;
  accountId: string;
  transactionId?: string;
  relatedTransactionId?: string;
  type: BalanceChangeType;
  amount: number;
  beforeBalance: number;
  afterBalance: number;
  createdAt: string;
  note?: string;
  remark?: string;
}
