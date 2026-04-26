import type { CreditExtractedItem } from './types';

function splitCreditBlocks(answer: string) {
  const text = String(answer || '').trim();
  if (!text) return [];

  return text
    .split(/\n(?=产品|平台|项目|标题|1\.|2\.|3\.|-\s*(?:产品|平台|项目|标题))/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickFirstMatchedText(block: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const matched = block.match(pattern);
    if (matched?.[1]?.trim()) {
      return matched[1].trim();
    }
  }

  return '';
}

export function extractStreamingCreditPreview(answer: string): CreditExtractedItem[] {
  const text = String(answer || '').trim();
  if (!text) return [];

  const blocks = splitCreditBlocks(text);

  const candidates: Array<CreditExtractedItem | null> = (blocks.length > 1 ? blocks : [text]).map(
    (block, index) => {
      const title = pickFirstMatchedText(block, [
        /产品(?:\/平台)?[：:】]\s*([^\n]+)/i,
        /平台(?:\/产品)?[：:】]\s*([^\n]+)/i,
        /标题[：:】]\s*([^\n]+)/i
      ]);
      const dueAmount = pickFirstMatchedText(block, [
        /当前应还(?:金额)?[：:】]\s*([^\n]+)/i,
        /本期应还[：:】]\s*([^\n]+)/i
      ]);
      const totalDebt = pickFirstMatchedText(block, [
        /总欠款[：:】]\s*([^\n]+)/i,
        /剩余待还[：:】]\s*([^\n]+)/i,
        /总待还[：:】]\s*([^\n]+)/i
      ]);
      const repaymentDate = pickFirstMatchedText(block, [
        /还款日(?:期)?[：:】]\s*([^\n]+)/i,
        /扣款日[：:】]\s*([^\n]+)/i
      ]);
      const remainingPeriods = pickFirstMatchedText(block, [
        /剩余期数[：:】]\s*([^\n]+)/i,
        /(剩余[0-9一二三四五六七八九十]+期)/i
      ]);
      const monthlyAmount = pickFirstMatchedText(block, [
        /每期(?:金额|应还)?[：:】]\s*([^\n]+)/i,
        /月供[：:】]\s*([^\n]+)/i
      ]);
      const interest = pickFirstMatchedText(block, [
        /利息(?:\/费率|\/手续费|\/服务费)?[：:】]\s*([^\n]+)/i,
        /费率[：:】]\s*([^\n]+)/i,
        /服务费[：:】]\s*([^\n]+)/i
      ]);
      const riskHint = pickFirstMatchedText(block, [
        /风险提示[：:】]\s*([^\n]+)/i,
        /风险[：:】]\s*([^\n]+)/i
      ]);
      const actionSuggestion = pickFirstMatchedText(block, [
        /下一步(?:建议)?[：:】]\s*([^\n]+)/i,
        /建议动作[：:】]\s*([^\n]+)/i,
        /建议[：:】]\s*([^\n]+)/i
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
        confidence: title && (dueAmount || totalDebt || repaymentDate) ? 'medium' : 'low'
      };
    }
  );

  return candidates.filter((item): item is CreditExtractedItem => item !== null).slice(0, 3);
}

export function extractCreditStructuredItems(answer: string): CreditExtractedItem[] {
  const jsonBlockMatch = answer.match(/```json\s*([\s\S]*?)```/i);
  const rawJson = jsonBlockMatch?.[1]?.trim();
  if (!rawJson) return [];

  try {
    const parsed = JSON.parse(rawJson) as { creditItems?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.creditItems)) return [];

    const items: Array<CreditExtractedItem | null> = parsed.creditItems.map((item, index) => {
        const title = String(item.title || item.product || item.platform || '').trim();
        const productType = String(item.productType || item.type || '其他').trim();
        const dueAmount = String(item.dueAmount || '').trim();
        const totalDebt = String(item.totalDebt || item.remainingDebt || '').trim();
        const repaymentDate = String(item.repaymentDate || item.dueDate || '').trim();
        const remainingPeriods = String(item.remainingPeriods || item.periodsLeft || '').trim();
        const monthlyAmount = String(item.monthlyAmount || item.perPeriodAmount || '').trim();
        const interest = String(item.interest || item.fee || '').trim();
        const rateType = String(item.rateType || item.rateLabel || '').trim();
        const rateSource: CreditExtractedItem['rateSource'] =
          item.rateSource === 'explicit' || item.rateSource === 'inferred' || item.rateSource === 'pending'
            ? item.rateSource
            : undefined;
        const riskHint = String(item.riskHint || item.risk || '').trim();
        const actionSuggestion = String(item.actionSuggestion || item.nextStep || '').trim();
        const pendingFields = Array.isArray(item.pendingFields)
          ? item.pendingFields.map((field) => String(field).trim()).filter(Boolean)
          : [];
        const confidence: CreditExtractedItem['confidence'] =
          item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
            ? item.confidence
            : 'medium';

        if (!title && !productType && !dueAmount && !totalDebt) {
          return null;
        }

        return {
          id: `credit-${index}-${title || productType || 'unknown'}`,
          title: title || '待确认信贷项目',
          productType: productType || '其他',
          dueAmount: dueAmount || undefined,
          totalDebt: totalDebt || undefined,
          repaymentDate: repaymentDate || undefined,
          remainingPeriods: remainingPeriods || undefined,
          monthlyAmount: monthlyAmount || undefined,
          interest: interest || undefined,
          rateType: rateType || undefined,
          rateSource,
          riskHint: riskHint || undefined,
          actionSuggestion: actionSuggestion || undefined,
          pendingFields,
          confidence
        };
      });

    return items.filter((item): item is CreditExtractedItem => item !== null);
  } catch {
    return [];
  }
}

export function stripCreditJsonBlock(answer: string): string {
  return answer.replace(/```json\s*[\s\S]*?```/gi, '').trim();
}

export function buildCreditAssistantMessageText(answer: string): string {
  const plain = stripCreditJsonBlock(answer).trim();
  if (!plain) return answer.trim();

  const paragraphs = plain
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const joined = paragraphs.slice(0, 3).join('\n\n');
  if (joined.length <= 280) {
    return joined;
  }

  return `${joined.slice(0, 280).trimEnd()}…`;
}
