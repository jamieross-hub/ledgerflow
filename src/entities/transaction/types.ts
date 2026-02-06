export interface TransactionItem {
  id: string;
  type: 'expense' | 'income';
  categoryId: string;
  accountId: string;
  amount: number;
  date: string;
  note: string;
  tags: string[];
}
