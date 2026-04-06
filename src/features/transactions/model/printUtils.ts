import { buildA4PrintBaseStyles, buildA4PrintSheetStyles } from '../../../shared/lib/printStyles';

/**
 * 构建批量打印样式
 */
export function buildBulkPrintStyles() {
  return `
    ${buildA4PrintBaseStyles({
      margin: '12mm 10mm 14mm',
      bodyBackground: '#f3f4f6',
      bodyColor: '#111827'
    })}
    ${buildA4PrintSheetStyles({
      bodyFontSize: '12px',
      bodyLineHeight: '1.6',
      sheetBackground: '#ffffff',
      sheetBorder: '1px solid #e5e7eb',
      sheetRadius: '14px',
      sheetPadding: '14px 16px 12px',
      sheetShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
      printSheetPadding: '0'
    })}
    .title {
      margin: 0;
      font-size: 22px;
      line-height: 1.3;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .meta {
      margin: 10px 0 16px 0;
      color: #6b7280;
      font-size: 12px;
      line-height: 1.6;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 0 0 16px 0;
    }
    .summary-card {
      border: 1px solid #dbe3f0;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .summary-label {
      color: #6b7280;
      font-size: 11px;
      margin-bottom: 6px;
    }
    .summary-value {
      color: #111827;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #ffffff;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 6px;
      font-size: 12px;
      line-height: 1.5;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    th {
      background: #f3f4f6;
      color: #111827;
      text-align: left;
      font-weight: 700;
    }
    .col-date { width: 86px; white-space: nowrap; }
    .col-type { width: 56px; text-align: center; }
    .col-category { width: 88px; }
    .col-account { width: 96px; }
    .col-amount { width: 92px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-status { width: 72px; text-align: center; }
    .col-note { width: auto; }
    .amount-income { color: #059669; font-weight: 700; }
    .amount-expense { color: #dc2626; font-weight: 700; }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
      color: #6b7280;
      font-size: 11px;
      line-height: 1.5;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    }
  `;
}

/**
 * 使用 iframe 打印 HTML 内容
 */
export function printHtmlWithIframe(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error('无法创建打印 iframe');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 0);
  };

  const onAfterPrint = () => {
    win.removeEventListener('afterprint', onAfterPrint);
    cleanup();
  };
  win.addEventListener('afterprint', onAfterPrint);

  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 80);
}
