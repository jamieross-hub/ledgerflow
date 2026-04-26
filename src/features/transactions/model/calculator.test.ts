import { describe, expect, it } from 'vitest';
import { evaluateCalculatorExpression } from './calculator';

describe('evaluateCalculatorExpression', () => {
  it('supports basic arithmetic used in quick add', () => {
    expect(evaluateCalculatorExpression('100+20*3')).toBe(160);
    expect(evaluateCalculatorExpression('(88+12)/2')).toBe(50);
    expect(evaluateCalculatorExpression('12×3÷2')).toBe(18);
  });

  it('rejects scientific functions and unsupported operators', () => {
    expect(evaluateCalculatorExpression('sqrt(81)')).toBeNull();
    expect(evaluateCalculatorExpression('sin(0)')).toBeNull();
    expect(evaluateCalculatorExpression('2^3')).toBeNull();
    expect(evaluateCalculatorExpression('PI')).toBeNull();
  });
});
