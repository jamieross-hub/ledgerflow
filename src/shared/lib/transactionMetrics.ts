import type { TransactionItem, TransactionType } from '../../entities/transaction/types';

export type TransactionDirection = 'inflow' | 'outflow';

function safeAmount(raw: number): number {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return amount;
}

function isRefundLike(tx: TransactionItem): boolean {
  return tx.adjustmentKind === 'refund' || tx.adjustmentKind === 'reversal';
}

function isExpenseLike(type: TransactionType): boolean {
  return type === 'expense' || type === 'budget' || type === 'repayment';
}

export function getTransactionDirection(tx: TransactionItem): TransactionDirection {
  if (tx.type === 'income') {
    return 'inflow';
  }

  if (isRefundLike(tx)) {
    return 'inflow';
  }

  return 'outflow';
}

export function getSignedAmount(tx: TransactionItem): number {
  const amount = safeAmount(tx.amount);
  if (amount <= 0) {
    return 0;
  }
  return getTransactionDirection(tx) === 'inflow' ? amount : -amount;
}

export interface TransactionSummary {
  incomeTotal: number;
  expenseTotal: number;
  refundTotal: number;
  netTotal: number;
  overallTotal: number;
}

/**
 * 统一统计口径：
 * - 退款/冲正不计入收入
 * - 支出按“原始支出 - 退款/冲正”得到净支出
 */
export function summarizeTransactions(rows: TransactionItem[]): TransactionSummary {
  const refundByOrigin = new Map<string, number>();
  let orphanRefundTotal = 0;

  rows.forEach((tx) => {
    if (!isRefundLike(tx)) {
      return;
    }
    const amount = safeAmount(tx.amount);
    if (amount <= 0) {
      return;
    }
    if (tx.refundOfTransactionId) {
      refundByOrigin.set(
        tx.refundOfTransactionId,
        (refundByOrigin.get(tx.refundOfTransactionId) || 0) + amount
      );
      return;
    }
    orphanRefundTotal += amount;
  });

  const incomeTotal = rows.reduce((sum, tx) => {
    if (tx.type !== 'income' || isRefundLike(tx)) {
      return sum;
    }
    return sum + safeAmount(tx.amount);
  }, 0);

  const grossExpense = rows.reduce((sum, tx) => {
    if (isRefundLike(tx) || !isExpenseLike(tx.type)) {
      return sum;
    }
    return sum + safeAmount(tx.amount);
  }, 0);

  const linkedRefundTotal = rows.reduce((sum, tx) => {
    if (isRefundLike(tx) || !isExpenseLike(tx.type)) {
      return sum;
    }
    const sourceAmount = safeAmount(tx.amount);
    const linkedRefund = safeAmount(refundByOrigin.get(tx.id) || 0);
    return sum + Math.min(sourceAmount, linkedRefund);
  }, 0);

  const refundTotal = linkedRefundTotal + orphanRefundTotal;
  const expenseTotal = Math.max(0, grossExpense - refundTotal);

  return {
    incomeTotal,
    expenseTotal,
    refundTotal,
    netTotal: incomeTotal - expenseTotal,
    overallTotal: rows.reduce((sum, tx) => sum + safeAmount(tx.amount), 0)
  };
}
