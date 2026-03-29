import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { TransactionItem, TransactionType } from '../../../entities/transaction/types';

export type BulkPrintTemplate = 'full' | 'summary';

export type BulkPdfFieldOptions = {
  includeAccount: boolean;
  includeNote: boolean;
  includeOrderNo: boolean;
  includeTags: boolean;
};

export type BulkPdfRow = {
  item: TransactionItem;
  categoryName: string;
  accountName: string;
};

export type ExportTransactionsPdfInput = {
  rows: BulkPdfRow[];
  privacyMode: boolean;
  bulkPrintTemplate: BulkPrintTemplate;
  bulkPrintFields: BulkPdfFieldOptions;
  maskShareText: (value: string) => string;
};

function txTypeLabel(type: TransactionType) {
  return type === 'income' ? '收入' : type === 'budget' ? '预算' : type === 'repayment' ? '还款' : '支出';
}

function txStatusLabel(status?: TransactionItem['status']) {
  if (!status) return '—';
  return (
    {
      pending: '待处理',
      completed: '已完成',
      refunded: '已退款',
      closed: '已关闭',
      failed: '失败'
    }[status] || status
  );
}

export async function exportTransactionsPdf(input: ExportTransactionsPdfInput) {
  const { rows, privacyMode, bulkPrintTemplate, bulkPrintFields, maskShareText } = input;

  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import('pdf-lib'),
    import('fontkit')
  ]);

  const pdfDoc = await PDFDocument.create();
  const fontkit = 'default' in fontkitModule ? fontkitModule.default : fontkitModule;
  pdfDoc.registerFontkit(fontkit);

  const fontModule = await import('../../../assets/NotoSansSC-Regular.ttf?url');
  const fontResponse = await fetch(fontModule.default);
  if (!fontResponse.ok) {
    throw new Error('中文字体加载失败，请联网后重试。');
  }

  const fontBytes = await fontResponse.arrayBuffer();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const fontSize = 10;
  const titleSize = 16;
  const lineHeight = 16;
  const margin = 40;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxTextWidth = pageWidth - margin * 2;

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.item.amount || 0), 0);
  const incomeTotal = rows.reduce(
    (sum, row) => sum + (row.item.type === 'income' ? Number(row.item.amount || 0) : 0),
    0
  );
  const expenseTotal = rows.reduce(
    (sum, row) => sum + (row.item.type !== 'income' ? Number(row.item.amount || 0) : 0),
    0
  );

  const maskAmountText = (value: number) => (privacyMode ? '¥••••' : formatCurrency(value));
  const maskPrintText = (value?: string) => {
    if (!value?.trim()) return '—';
    return privacyMode ? maskShareText(value) : value;
  };

  const dateTimestamps = rows
    .map((row) => new Date(row.item.date).getTime())
    .filter((value) => Number.isFinite(value));
  const dateRangeText = dateTimestamps.length
    ? `${formatDate(new Date(Math.min(...dateTimestamps)).toISOString())} ～ ${formatDate(
        new Date(Math.max(...dateTimestamps)).toISOString()
      )}`
    : '—';
  const generatedAtText = new Date().toLocaleString('zh-CN', { hour12: false });

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  };

  const drawLine = (textLine: string, x = margin, color = rgb(0.07, 0.09, 0.15), size = fontSize) => {
    page.drawText(textLine, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  };

  page.drawText('LedgerFlow 批量交易导出', {
    x: margin,
    y: cursorY,
    size: titleSize,
    font,
    color: rgb(0.07, 0.09, 0.15)
  });
  cursorY -= 26;
  drawLine(`时间范围：${dateRangeText}`);
  drawLine(`生成时间：${generatedAtText}`);
  drawLine(`交易条数：${rows.length} 条`);
  drawLine(`金额合计：${maskAmountText(totalAmount)} ｜ 收入合计：${maskAmountText(incomeTotal)} ｜ 支出合计：${maskAmountText(expenseTotal)}`);
  drawLine(`导出模式：${privacyMode ? '隐私模式（已脱敏）' : '完整模式'} ｜ 模板：${bulkPrintTemplate === 'summary' ? '摘要' : '完整'}`);
  cursorY -= 6;

  rows.forEach(({ item, categoryName, accountName }, index) => {
    const detailLineParts = [
      `分类：${maskPrintText(categoryName || '未分类')}`,
      bulkPrintFields.includeAccount ? `账户：${maskPrintText(accountName || '未指定账户')}` : '',
      `状态：${txStatusLabel(item.status)}`,
      bulkPrintFields.includeOrderNo && item.orderNo ? `订单号：${maskPrintText(item.orderNo)}` : '',
      bulkPrintFields.includeOrderNo && item.merchantOrderNo ? `商户单号：${maskPrintText(item.merchantOrderNo)}` : ''
    ].filter(Boolean);

    const extraLines = [
      bulkPrintFields.includeNote && bulkPrintTemplate !== 'summary' ? `备注：${maskPrintText(item.note || '—')}` : '',
      bulkPrintFields.includeTags && item.tags?.length ? `标签：${maskPrintText(item.tags.join(' / '))}` : ''
    ].filter(Boolean);

    const lines = bulkPrintTemplate === 'summary'
      ? [
          `${index + 1}. ${formatDate(item.date)}  ${txTypeLabel(item.type)}  ${item.type === 'income' ? '+' : '-'}${maskAmountText(item.amount)}`,
          detailLineParts.filter((part) => !part.startsWith('账户：') && !part.startsWith('订单号：') && !part.startsWith('商户单号：')).join(' ｜ ')
        ]
      : [
          `${index + 1}. ${formatDate(item.date)}  ${txTypeLabel(item.type)}  ${item.type === 'income' ? '+' : '-'}${maskAmountText(item.amount)}`,
          detailLineParts.join(' ｜ '),
          ...extraLines
        ];

    const requiredHeight = lines.length * lineHeight + 10;
    ensureSpace(requiredHeight);

    lines.forEach((line) => {
      const normalized = String(line);
      if (font.widthOfTextAtSize(normalized, fontSize) <= maxTextWidth) {
        drawLine(normalized);
        return;
      }

      let buffer = '';
      for (const ch of normalized) {
        const next = buffer + ch;
        if (font.widthOfTextAtSize(next, fontSize) > maxTextWidth && buffer) {
          drawLine(buffer);
          buffer = ch;
        } else {
          buffer = next;
        }
      }
      if (buffer) drawLine(buffer);
    });

    cursorY -= 8;
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledgerflow-transactions-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
