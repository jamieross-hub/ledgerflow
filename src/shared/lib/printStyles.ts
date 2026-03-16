export function buildA4PrintBaseStyles(options?: {
  margin?: string;
  bodyColor?: string;
  bodyBackground?: string;
  fontFamily?: string;
}) {
  const margin = options?.margin || '12mm 10mm 14mm';
  const bodyColor = options?.bodyColor || '#111827';
  const bodyBackground = options?.bodyBackground || '#ffffff';
  const fontFamily =
    options?.fontFamily ||
    "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  return `
    @page {
      size: A4;
      margin: ${margin};
    }

    * {
      box-sizing: border-box;
    }

    html {
      background: ${bodyBackground};
    }

    body {
      margin: 0;
      color: ${bodyColor};
      background: ${bodyBackground};
      font-family: ${fontFamily};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      html, body {
        background: #ffffff;
      }
    }
  `;
}
