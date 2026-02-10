import { describe, expect, it } from 'vitest';
import { parseBillCsvToTransactions } from './billImport';

describe('parseBillCsvToTransactions', () => {
  it('应支持支付宝带说明头的账单并自动识别表头', () => {
    const csvText = [
      '支付宝交易记录明细查询',
      '账号:[demo@outlook.com]',
      '起始日期:[2025-11-10 00:00:00] 终止日期:[2026-02-10 09:06:47]',
      '---------------------------------交易记录明细列表---------------------------------',
      '交易号,商家订单号,交易创建时间,付款时间,最近修改时间,类型,交易对方,商品名称,金额（元）,收/支,交易状态,备注',
      '20260210100032004310286048575,0001N20260210000000001,2026/2/10 07:57,2026/2/10 07:57,2026/2/10 07:57,其他,杭州闲鱼,分账-基础服务,0.07,支出,交易成功,',
      '2026021022001460411415327586,0001N20260210000000002,2026/2/10 07:09,2026/2/10 07:09,2026/2/10 07:13,其他,高德顺风车,退款-高德顺风车,24.59,不计收支,退款成功,',
      '2026020922001460411414415742,6720180330024764010461,2026/2/9 22:21,2026/2/9 22:21,2026/2/9 22:21,其他,神行手打村,美团外卖,32,支出,交易成功,餐饮'
    ].join('\n');

    const rows = parseBillCsvToTransactions({
      csvText,
      source: 'alipay',
      defaultCategoryId: 'cat-food',
      defaultAccountId: 'acc-card'
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].orderNo).toBe('20260210100032004310286048575');
    expect(rows[0].merchantOrderNo).toBe('0001N20260210000000001');
    expect(rows[0].source).toBe('alipay');
  });

  it('应支持制表符分隔的支付宝账单', () => {
    const csvText = [
      '支付宝交易记录明细查询',
      '交易号\t商家订单号\t交易创建时间\t金额（元）\t收/支\t交易状态\t交易对方\t商品名称',
      'T20260210\tM20260210\t2026/2/10 08:00\t9.99\t收入\t交易成功\t淘宝\tGemini Pro'
    ].join('\n');

    const rows = parseBillCsvToTransactions({
      csvText,
      source: 'alipay',
      defaultCategoryId: 'cat-food',
      defaultAccountId: 'acc-card'
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].orderNo).toBe('T20260210');
    expect(rows[0].merchantOrderNo).toBe('M20260210');
    expect(rows[0].amount).toBe(9.99);
  });
});
