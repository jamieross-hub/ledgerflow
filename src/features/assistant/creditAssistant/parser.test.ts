import { describe, expect, it } from 'vitest';
import {
  buildCreditAssistantMessageText,
  extractCreditStructuredItems,
  extractStreamingCreditPreview,
  stripCreditJsonBlock
} from './parser';

describe('creditAssistant parser', () => {
  it('extracts structured items from assistant json blocks', () => {
    const answer = [
      '这里是总结。',
      '```json',
      JSON.stringify(
        {
          creditItems: [
            {
              title: '花呗分期',
              productType: '消费贷',
              dueAmount: '¥800',
              totalDebt: '¥3200',
              repaymentDate: '每月 8 日',
              rateType: 'APR',
              rateSource: 'explicit',
              confidence: 'high'
            }
          ]
        },
        null,
        2
      ),
      '```'
    ].join('\n');

    expect(extractCreditStructuredItems(answer)).toEqual([
      expect.objectContaining({
        title: '花呗分期',
        productType: '消费贷',
        dueAmount: '¥800',
        totalDebt: '¥3200',
        repaymentDate: '每月 8 日',
        rateType: 'APR',
        rateSource: 'explicit',
        confidence: 'high'
      })
    ]);
  });

  it('extracts top streaming preview cards from plain text', () => {
    const answer = [
      '产品：招行信用卡',
      '当前应还：¥1200',
      '还款日：每月12日',
      '',
      '产品：花呗',
      '总待还：¥3000',
      '月供：¥500',
      '',
      '产品：房贷',
      '当前应还：¥4200',
      '',
      '产品：不应该出现在预览里的第四项',
      '当前应还：¥1'
    ].join('\n');

    const preview = extractStreamingCreditPreview(answer);
    expect(preview).toHaveLength(3);
    expect(preview[0]).toEqual(
      expect.objectContaining({
        title: '招行信用卡',
        productType: '信用卡',
        dueAmount: '¥1200'
      })
    );
    expect(preview[1].pendingFields).toContain('当前应还');
  });

  it('strips json blocks when building short credit assistant copy', () => {
    const answer = [
      '第一段说明。',
      '',
      '第二段说明。',
      '',
      '```json',
      '{"creditItems":[]}',
      '```'
    ].join('\n');

    expect(stripCreditJsonBlock(answer)).toContain('第一段说明。');
    expect(stripCreditJsonBlock(answer)).not.toContain('creditItems');
    expect(buildCreditAssistantMessageText(answer)).toBe('第一段说明。\n\n第二段说明。');
  });
});
