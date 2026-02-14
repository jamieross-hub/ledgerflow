import { describe, expect, it } from 'vitest';
import type { Account } from '../../../entities/account/types';
import { ensureAccountId, inferAccountNameFromText } from './workbenchMapping';
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
  it('应能在银行文本场景提取账户名并自动创建后复用（平安银行示例）', () => {
    const accounts: Account[] = [{ id: 'acc-cash', name: '现金', type: 'cash' }];
    let createdCount = 0;
    const addAccount = (name: string, type?: Account['type']) => {
      createdCount += 1;
      accounts.push({ id: `acc-bank-${createdCount}`, name, type: type || 'debit' });
      return `acc-bank-${createdCount}`;
    };

    const inferred = inferAccountNameFromText('平安银行入账10000', 'bank', { type: 'income' });
    expect(inferred).toBe('平安银行');

    const id1 = ensureAccountId(inferred, accounts, addAccount, { source: 'bank', type: 'income' });
    expect(id1).toBe('acc-bank-1');
    expect(createdCount).toBe(1);

    const id2 = ensureAccountId('平安银行', accounts, addAccount, { source: 'bank', type: 'income' });
    expect(id2).toBe('acc-bank-1');
    expect(createdCount).toBe(1);
  });
  it('应支持还款账单字段标准化（贷款截图识别场景）', () => {
    const result = normalizeAiBill({
      transactions: [
        {
          type: 'repayment',
          amount: '¥2,345.67',
          date: '2025/02/03',
          note: '平安银行房贷月供扣款',
          category: '还款',
          account: '平安银行',
          tags: ['房贷', '月供'],
          sourceHint: 'bank'
        }
      ]
    });

    expect(result?.transactions).toHaveLength(1);
    expect(result?.transactions[0].type).toBe('repayment');
    expect(result?.transactions[0].amount).toBe(2345.67);
    expect(result?.transactions[0].date).toBe('2025-02-03');
    expect(result?.transactions[0].sourceHint).toBe('bank');
  });

  it('还款场景应优先推断为负债/信用账户，而非银行借记卡账户', () => {
    const inferred = inferAccountNameFromText('平安银行房贷月供扣款', 'bank', { type: 'repayment' });
    expect(inferred).toBe('房贷账户');

    const accounts: Account[] = [{ id: 'acc-cash', name: '现金', type: 'cash' }];
    const created: Array<{ name: string; type?: Account['type'] }> = [];
    const addAccount = (name: string, type?: Account['type']) => {
      created.push({ name, type });
      return `acc-${created.length}`;
    };

    const accountId = ensureAccountId(inferred, accounts, addAccount, {
      source: 'bank',
      type: 'repayment'
    });

    expect(accountId).toBe('acc-1');
    expect(created).toEqual([{ name: '房贷账户', type: 'liability' }]);
  });
});
