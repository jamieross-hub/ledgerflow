export type DebtType = 'credit-card' | 'huabei' | 'loan';

export type DebtItem = {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  annualRate?: number;
  remainingMonths?: number;
  customMinPayment?: number;
};

export type DebtSummary = {
  totalDebt: number;
  totalMinimumPayment: number;
  pressureRatio: number;
};

const debtRules: Record<DebtType, { rate: number; minFloor: number }> = {
  'credit-card': { rate: 0.1, minFloor: 100 },
  huabei: { rate: 0.1, minFloor: 50 },
  loan: { rate: 0.03, minFloor: 0 }
};

function toPositiveNumber(value: number | undefined): number {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) {
    return 0;
  }
  return safe;
}

function calcLoanAmortizedPayment(balance: number, annualRate?: number, months?: number): number {
  const principal = toPositiveNumber(balance);
  const safeMonths = Math.max(1, Math.floor(toPositiveNumber(months)));
  if (principal === 0) {
    return 0;
  }

  const monthlyRate = toPositiveNumber(annualRate) / 12 / 100;
  if (monthlyRate === 0) {
    return principal / safeMonths;
  }

  const pow = Math.pow(1 + monthlyRate, safeMonths);
  const payment = (principal * monthlyRate * pow) / (pow - 1);
  return Number.isFinite(payment) ? payment : 0;
}

export function calculateDebtMinimumPayment(debt: DebtItem): number {
  const principal = toPositiveNumber(debt.balance);
  if (principal === 0) {
    return 0;
  }

  const custom = toPositiveNumber(debt.customMinPayment);
  if (custom > 0) {
    return custom;
  }

  if (debt.type === 'loan') {
    return calcLoanAmortizedPayment(principal, debt.annualRate, debt.remainingMonths);
  }

  const rule = debtRules[debt.type];
  return Math.max(principal * rule.rate, rule.minFloor);
}

export function calculateDebtSummary(debts: DebtItem[], monthlyIncome: number): DebtSummary {
  const totalDebt = debts.reduce((sum, item) => sum + toPositiveNumber(item.balance), 0);
  const totalMinimumPayment = debts.reduce(
    (sum, item) => sum + calculateDebtMinimumPayment(item),
    0
  );
  const income = toPositiveNumber(monthlyIncome);
  const pressureRatio = income > 0 ? totalMinimumPayment / income : 0;

  return {
    totalDebt,
    totalMinimumPayment,
    pressureRatio
  };
}
