import { describe, expect, it } from 'vitest';
import { resolveImportDefaultAccountId } from './importAccount';

describe('resolveImportDefaultAccountId', () => {
  it('微信导入时优先匹配微信账户', () => {
    const accountId = resolveImportDefaultAccountId(
      [
        { id: 'acc-alipay', name: '支付宝' },
        { id: 'acc-wechat', name: '微信钱包' }
      ],
      'wechat',
      'acc-alipay'
    );

    expect(accountId).toBe('acc-wechat');
  });

  it('支付宝导入时优先匹配支付宝账户', () => {
    const accountId = resolveImportDefaultAccountId(
      [
        { id: 'acc-wechat', name: '微信' },
        { id: 'acc-alipay', name: '支付宝余额' }
      ],
      'alipay'
    );

    expect(accountId).toBe('acc-alipay');
  });

  it('未匹配到账户时回落到fallback', () => {
    const accountId = resolveImportDefaultAccountId(
      [{ id: 'acc-card', name: '招商银行' }],
      'wechat',
      'acc-card'
    );

    expect(accountId).toBe('acc-card');
  });
});
