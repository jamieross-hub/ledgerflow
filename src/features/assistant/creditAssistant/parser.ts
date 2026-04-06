import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Credit extracted item types                                       */
/* ------------------------------------------------------------------ */

export interface CreditFieldMeta {
  source: 'confirmed' | 'needs-confirmation' | 'low-confidence';
  label: string;
}

export interface CreditExtractedItem {
  id: string;
  title: string;
  productType: string;
  dueAmount?: string;
  totalDebt?: string;
  repaymentDate?: string;
  remainingPeriods?: string;
  monthlyAmount?: string;
  interest?: string;
  riskHint?: string;
  actionSuggestion?: string;
  pendingFields: string[];
  confidence: 'high' | 'medium' | 'low';
  confirmationState: 'ready' | 'confirming' | 'confirmed';
  bindingProgressText?: string;
  bindingProgress?: number;
  matchedDebtId?: string;
  conflictFields?: string[];
  repaymentLookupSummary?: {
    totalRepaid: number;
    lastRepaymentDate: string;
    remainingPayments: number;
  };
  repaymentGapSummary?: {
    expectedTotal: number;
    actualTotal: number;
    gap: number;
    explanationItems: string[];
  };
}

/* ------------------------------------------------------------------ */
/*  Streaming credit preview extraction                               */
/* ------------------------------------------------------------------ */

export function extractStreamingCreditPreview(answer: string): CreditExtractedItem[] {
  const text = String(answer || '').trim();
  if (!text) return [];

  const blocks = text
    .split(/\n(?=产品|平台|项目|标题|1\.|2\.|3\.|-\s*(?:产品|平台|项目|标题))/)
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates: Array<CreditExtractedItem | null> = (blocks.length > 1 ? blocks : [text]).map(
    (block, index) => {
      const pick = (patterns: RegExp[]) => {
        for (const pattern of patterns) {
          const matched = block.match(pattern);
          if (matched?.[1]?.trim()) return matched[1].trim();
        }
        return '';
      };

      const title = pick([
        /产品(?:\/平台)?[：:】]\s*([^\n]+)/i,
        /平台(?:\/产品)?[：:】]\s*([^\n]+)/i,
        /标题[：:】]\s*([^\n]+)/i,
      ]);
      const dueAmount = pick([/当前应还(?:金额)?[：:】]\s*([^\n]+)/i, /本期应还[：:】]\s*([^\n]+)/i]);
      const totalDebt = pick([
        /总欠款[：:】]\s*([^\n]+)/i,
        /剩余待还[：:】]\s*([^\n]+)/i,
        /总待还[：:】]\s*([^\n]+)/i,
      ]);
      const repaymentDate = pick([/还款日(?:期)?[：:】]\s*([^\n]+)/i, /扣款日[：:】]\s*([^\n]+)/i]);
      const remainingPeriods = pick([
        /剩余期数[：:】]\s*([^\n]+)/i,
        /(剩余[0-9一二三四五六七八九十]+期)/i,
      ]);
      const monthlyAmount = pick([/每期(?:金额|应还)?[：:】]\s*([^\n]+)/i, /月供[：:】]\s*([^\n]+)/i]);
      const interest = pick([
        /利息(?:\/费率|\/手续费|\/服务费)?[：:】]\s*([^\n]+)/i,
        /费率[：:】]\s*([^\n]+)/i,
        /服务费[：:】]\s*([^\n]+)/i,
      ]);
      const riskHint = pick([/风险提示[：:】]\s*([^\n]+)/i, /风险[：:】]\s*([^\n]+)/i]);
      const actionSuggestion = pick([
        /下一步(?:建议)?[：:】]\s*([^\n]+)/i,
        /建议动作[：:】]\s*([^\n]+)/i,
        /建议[：:】]\s*([^\n]+)/i,
      ]);

      const productTypeText = `${title} ${block}`;
      const productType = /房贷|车贷|按揭|贷款/i.test(productTypeText)
        ? '贷款'
        : /花呗|白条|分期|消费贷|借呗|现金贷/i.test(productTypeText)
          ? '消费贷'
          : /信用卡/i.test(productTypeText)
            ? '信用卡'
            : '待识别';

      const pendingFields = [
        !dueAmount ? '当前应还' : '',
        !totalDebt ? '剩余待还' : '',
        !repaymentDate ? '还款日' : '',
        !monthlyAmount ? '每期金额' : '',
      ].filter(Boolean);

      if (!title && !dueAmount && !totalDebt && !repaymentDate && !monthlyAmount && !interest) {
        return null;
      }

      return {
        id: `streaming-credit-${index}`,
        title: title || `识别中项目 ${index + 1}`,
        productType,
        dueAmount: dueAmount || undefined,
        totalDebt: totalDebt || undefined,
        repaymentDate: repaymentDate || undefined,
        remainingPeriods: remainingPeriods || undefined,
        monthlyAmount: monthlyAmount || undefined,
        interest: interest || undefined,
        riskHint: riskHint || undefined,
        actionSuggestion: actionSuggestion || undefined,
        pendingFields,
        confidence: 'low' as const,
        confirmationState: 'ready' as const,
      };
    }
  );

  return candidates.filter((item): item is CreditExtractedItem => item !== null);
}

/* ------------------------------------------------------------------ */
/*  Full credit structured extraction                                 */
/* ------------------------------------------------------------------ */

export function extractCreditStructuredItems(answer: string): CreditExtractedItem[] {
  const text = String(answer || '').trim();
  if (!text) return [];

  const blocks = text
    .split(/\n(?=产品|平台|项目|标题|1\.|2\.|3\.|-\s*(?:产品|平台|项目|标题))/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (blocks.length > 1 ? blocks : [text])
    .map((item, index) => {
      const pick = (patterns: RegExp[]) => {
        for (const pattern of patterns) {
          const matched = item.match(pattern);
          if (matched?.[1]?.trim()) return matched[1].trim();
        }
        return '';
      };

      const title = pick([
        /产品(?:\/平台)?[：:】]\s*([^\n]+)/i,
        /平台(?:\/产品)?[：:】]\s*([^\n]+)/i,
        /标题[：:】]\s*([^\n]+)/i,
      ]);
      const dueAmount = pick([/当前应还(?:金额)?[：:】]\s*([^\n]+)/i, /本期应还[：:】]\s*([^\n]+)/i]);
      const totalDebt = pick([
        /总欠款[：:】]\s*([^\n]+)/i,
        /剩余待还[：:】]\s*([^\n]+)/i,
        /总待还[：:】]\s*([^\n]+)/i,
      ]);
      const repaymentDate = pick([/还款日(?:期)?[：:】]\s*([^\n]+)/i, /扣款日[：:】]\s*([^\n]+)/i]);
      const remainingPeriods = pick([
        /剩余期数[：:】]\s*([^\n]+)/i,
        /(剩余[0-9一二三四五六七八九十]+期)/i,
      ]);
      const monthlyAmount = pick([/每期(?:金额|应还)?[：:】]\s*([^\n]+)/i, /月供[：:】]\s*([^\n]+)/i]);
      const interest = pick([
        /利息(?:\/费率|\/手续费|\/服务费)?[：:】]\s*([^\n]+)/i,
        /费率[：:】]\s*([^\n]+)/i,
        /服务费[：:】]\s*([^\n]+)/i,
      ]);
      const riskHint = pick([/风险提示[：:】]\s*([^\n]+)/i, /风险[：:】]\s*([^\n]+)/i]);
      const actionSuggestion = pick([
        /下一步(?:建议)?[：:】]\s*([^\n]+)/i,
        /建议动作[：:】]\s*([^\n]+)/i,
        /建议[：:】]\s*([^\n]+)/i,
      ]);

      const productTypeText = `${title} ${item}`;
      const productType = /房贷|车贷|按揭|贷款/i.test(productTypeText)
        ? '贷款'
        : /花呗|白条|分期|消费贷|借呗|现金贷/i.test(productTypeText)
          ? '消费贷'
          : /信用卡/i.test(productTypeText)
            ? '信用卡'
            : '待识别';

      const pendingFields = [
        !dueAmount ? '当前应还' : '',
        !totalDebt ? '剩余待还' : '',
        !repaymentDate ? '还款日' : '',
        !monthlyAmount ? '每期金额' : '',
      ].filter(Boolean);

      const filledCount = [dueAmount, totalDebt, repaymentDate, monthlyAmount, interest].filter(
        Boolean
      ).length;
      const confidence: CreditExtractedItem['confidence'] =
        filledCount >= 4 ? 'high' : filledCount >= 2 ? 'medium' : 'low';

      return {
        id: `credit-${index}`,
        title: title || `信贷产品 ${index + 1}`,
        productType,
        dueAmount: dueAmount || undefined,
        totalDebt: totalDebt || undefined,
        repaymentDate: repaymentDate || undefined,
        remainingPeriods: remainingPeriods || undefined,
        monthlyAmount: monthlyAmount || undefined,
        interest: interest || undefined,
        riskHint: riskHint || undefined,
        actionSuggestion: actionSuggestion || undefined,
        pendingFields,
        confidence,
        confirmationState: 'ready' as const,
      };
    })
    .filter(
      (item) =>
        item.title !== `信贷产品` ||
        item.dueAmount ||
        item.totalDebt ||
        item.repaymentDate ||
        item.monthlyAmount ||
        item.interest
    );
}

/* ------------------------------------------------------------------ */
/*  Normalize credit debt payload                                     */
/* ------------------------------------------------------------------ */

export function normalizeCreditDebtPayload(
  item: CreditExtractedItem
): Omit<{ id?: string; title: string; amount: number; dueDate: string; category: string }, 'id'> {
  const toNumber = (value?: string) => {
    if (!value) return 0;
    const num = parseFloat(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(num) ? num : 0;
  };

  return {
    title: item.title,
    amount: toNumber(item.totalDebt || item.dueAmount),
    dueDate: item.repaymentDate || '',
    category: item.productType,
  };
}

/* ------------------------------------------------------------------ */
/*  Map credit item to repayment prefill                              */
/* ------------------------------------------------------------------ */

export function mapCreditItemToRepaymentPrefill(item: CreditExtractedItem) {
  const extractNumberText = (value?: string) => {
    if (!value) return '';
    const match = value.match(/[\d,.]+/);
    return match ? match[0] : '';
  };

  const extractDayText = (value?: string) => {
    if (!value) return '';
    const match = value.match(/\d{1,2}/);
    return match ? match[0] : '';
  };

  return {
    amount: extractNumberText(item.monthlyAmount || item.dueAmount),
    dueDay: extractDayText(item.repaymentDate),
    totalAmount: extractNumberText(item.totalDebt),
    remainingPeriods: item.remainingPeriods || '',
  };
}

/* ------------------------------------------------------------------ */
/*  Build follow-up prompts                                           */
/* ------------------------------------------------------------------ */

export function buildFollowUpPrompts(
  answer: string,
  _history: Array<{ role: string; content: string }>
): string[] {
  const prompts: string[] = [];
  if (/风险/.test(answer)) prompts.push('详细说明风险和应对策略');
  if (/利率|费率|利息/.test(answer)) prompts.push('帮我计算实际年化利率');
  if (/还款|期数/.test(answer)) prompts.push('制定提前还款计划');
  if (/信用卡/.test(answer)) prompts.push('分析账单分期是否划算');
  if (prompts.length === 0) prompts.push('还有其他建议吗？');
  return prompts.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/*  Render field meta tag                                             */
/* ------------------------------------------------------------------ */

export function renderFieldMetaTag(meta?: CreditFieldMeta): ReactNode {
  if (!meta) return null;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Render credit field                                               */
/* ------------------------------------------------------------------ */

export function renderCreditField(
  label: string,
  value: string | undefined,
  meta?: CreditFieldMeta
): ReactNode {
  return { label, value, meta };
}
