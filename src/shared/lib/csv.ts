import { TransactionItem } from '../../entities/transaction/types';

export function exportTransactionsCsv(rows: TransactionItem[]) {
  const headers = ['id', 'type', 'categoryId', 'accountId', 'amount', 'date', 'note', 'tags'];
  const body = rows.map((row) =>
    [
      row.id,
      row.type,
      row.categoryId,
      row.accountId,
      row.amount.toFixed(2),
      row.date,
      row.note.replaceAll('"', '""'),
      row.tags.join('|')
    ]
      .map((item) => `"${item}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `transactions-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
