const CALCULATOR_ALLOWED_FUNCS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'log',
  'ln',
  'abs',
  'floor',
  'ceil',
  'round',
  'pow',
  'PI',
  'E'
]);

/**
 * 安全评估计算器表达式
 * 支持基本运算、三角函数、对数、平方根等，禁止访问其他全局对象
 */
export function evaluateCalculatorExpression(rawExpression: string): number | null {
  const normalized = rawExpression.trim();
  if (!normalized) {
    return null;
  }

  const canonical = normalized
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/，/g, ',')
    .replace(/π/gi, 'PI')
    .replace(/\bpi\b/gi, 'PI')
    .replace(/\blog\(/gi, 'Math.log10(')
    .replace(/\bln\(/gi, 'Math.log(')
    .replace(/\bsin\(/gi, 'Math.sin(')
    .replace(/\bcos\(/gi, 'Math.cos(')
    .replace(/\btan\(/gi, 'Math.tan(')
    .replace(/\basin\(/gi, 'Math.asin(')
    .replace(/\bacos\(/gi, 'Math.acos(')
    .replace(/\batan\(/gi, 'Math.atan(')
    .replace(/\bsqrt\(/gi, 'Math.sqrt(')
    .replace(/\babs\(/gi, 'Math.abs(')
    .replace(/\bfloor\(/gi, 'Math.floor(')
    .replace(/\bceil\(/gi, 'Math.ceil(')
    .replace(/\bround\(/gi, 'Math.round(')
    .replace(/\bpow\(/gi, 'Math.pow(')
    .replace(/\bE\b/g, 'Math.E')
    .replace(/\bPI\b/g, 'Math.PI')
    .replace(/\^/g, '**');

  if (!/^[0-9+\-*/%().,\sA-Za-z]*$/.test(canonical)) {
    return null;
  }

  const words = canonical.match(/[A-Za-z_]+/g) || [];
  const isSafe = words.every((word) =>
    ['Math', ...Array.from(CALCULATOR_ALLOWED_FUNCS)].some(
      (allowed) => allowed.toLowerCase() === word.toLowerCase()
    )
  );
  if (!isSafe) {
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
