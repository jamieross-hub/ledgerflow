import { describe, expect, it } from 'vitest';
import type { Account } from '../../../entities/account/types';
import { ensureAccountId } from './workbenchMapping';
import { extractJsonString, normalizeAiBill } from './workbenchUtils';

describe('workbenchUtils', () => {
  it('应能从带解释文本的响应中提取 transactions JSON', () => {
    const raw = `这是识别结果：\n\n{\n  "transactions": [{"type":"expense","amount":12.3,"date":"2025-01-01","note":"午餐","category":"餐饮","account":"微信","tags":["餐饮"]}]\n}\n\n请核对。`;
    const jsonText = extractJsonString(raw);
    const parsed = JSON.parse(jsonText) as unknown;
    const result = normalizeAiBill(parsed);

    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0].note).toBe('午餐');
  });

  it('应兼容图片 OCR 常见金额与日期格式', () => {
    const result = normalizeAiBill({
      transactions: [
        {
          type: 'expense',
          amount: '¥1,299.50',
          date: '2025年1月2日',
          note: '酒店',
          category: '旅行',
          account: '支付宝',
          tags: ['出差']
        }
      ]
    });

    expect(result?.transactions[0].amount).toBe(1299.5);
    expect(result?.transactions[0].date).toBe('2025-01-02');
  });
  it('应能在找不到账户时自动创建账户并复用（支付宝示例）', () => {
    const accounts: Account[] = [{ id: 'acc-cash', name: '现金', type: 'cash' }];
    let createdCount = 0;
    const addAccount = (name: string, type?: Account['type']) => {
      createdCount += 1;
      accounts.push({ id: `acc-${createdCount}`, name, type: type || 'virtual' });
      return `acc-${createdCount}`;
    };

    const id1 = ensureAccountId('支付宝', accounts, addAccount, { source: 'alipay', type: 'expense' });
    expect(id1).toBe('acc-1');
    expect(createdCount).toBe(1);

    const id2 = ensureAccountId('支付宝', accounts, addAccount, { source: 'alipay', type: 'expense' });
    expect(id2).toBe('acc-1');
    expect(createdCount).toBe(1);
  });
});
