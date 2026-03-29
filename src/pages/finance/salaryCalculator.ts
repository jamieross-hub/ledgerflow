export type SalaryCalculatorInput = {
  monthlySalary: string;
  workingDays: string;
  dailyHours: string;
};

export type SalaryCalculatorResult = {
  monthlySalary: number;
  workingDays: number;
  dailyHours: number;
  dailySalary: number;
  hourlySalary: number;
  weeklySalary: number;
};

export function sanitizePositiveNumberInput(value: string): string {
  return value.replace(/[^\d.]/g, '');
}

function parsePositiveNumber(value: string): number | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function calculateSalaryMetrics(input: SalaryCalculatorInput): SalaryCalculatorResult | null {
  const monthlySalary = parsePositiveNumber(input.monthlySalary);
  const workingDays = parsePositiveNumber(input.workingDays);
  const dailyHours = parsePositiveNumber(input.dailyHours);

  if (!monthlySalary || !workingDays || !dailyHours) {
    return null;
  }

  const dailySalary = monthlySalary / workingDays;
  const hourlySalary = dailySalary / dailyHours;
  const weeklySalary = dailySalary * 5;

  return {
    monthlySalary,
    workingDays,
    dailyHours,
    dailySalary,
    hourlySalary,
    weeklySalary
  };
}
