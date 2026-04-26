/**
 * 安全评估计算器表达式
 * 仅支持记账场景下常用的四则运算与括号，禁止访问其他全局对象
 */
export function evaluateCalculatorExpression(rawExpression: string): number | null {
  const normalized = rawExpression.trim();
  if (!normalized) {
    return null;
  }

  const canonical = normalized
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/');

  if (!/^[0-9+\-*/().\s]*$/.test(canonical)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${canonical});`)() as number;
    if (!Number.isFinite(result)) {
      return null;
    }
    return Math.round(result * 1000000) / 1000000;
  } catch {
    return null;
  }
}
