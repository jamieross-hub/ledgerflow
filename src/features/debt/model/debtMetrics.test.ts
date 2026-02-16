import { describe, expect, it } from 'vitest';
import { calculateDebtMinimumPayment, calculateDebtSummary, DebtItem } from './debtMetrics';

describe('debtMetrics', () => {
  it('calculates minimum payment for credit card and consumer loan by rules', () => {
    const creditCard: DebtItem = {
      id: 'd1',
      name: '招商信用卡',
      type: 'credit-card',
      balance: 1200
    };
    const consumerLoan: DebtItem = {
      id: 'd2',
      name: '消费贷',
      type: 'consumer-loan',
      balance: 200
    };

    expect(calculateDebtMinimumPayment(creditCard)).toBe(120);
    expect(calculateDebtMinimumPayment(consumerLoan)).toBe(50);
  });

  it('uses amortized formula for loans', () => {
    const loan: DebtItem = {
      id: 'd3',
      name: '消费贷',
      type: 'loan',
      balance: 120000,
      annualRate: 4.8,
      remainingMonths: 60
    };

    const result = calculateDebtMinimumPayment(loan);
    expect(result).toBeGreaterThan(2200);
    expect(result).toBeLessThan(2300);
  });

  it('returns debt pressure ratio by monthly income', () => {
    const summary = calculateDebtSummary(
      [
        { id: 'd1', name: '信用卡', type: 'credit-card', balance: 6000 },
        { id: 'd2', name: '消费贷', type: 'consumer-loan', balance: 3000 }
      ],
      10000
    );

    expect(summary.totalDebt).toBe(9000);
    expect(summary.totalMinimumPayment).toBe(900);
    expect(summary.pressureRatio).toBe(0.09);
  });
});
