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

export type OvertimeCalculatorResult = {
  overtimeHours: number;
  workdayOvertimePay: number;
  restDayOvertimePay: number;
  holidayOvertimePay: number;
};

export function sanitizePositiveNumberInput(value: string): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const firstDotIndex = sanitized.indexOf('.');
  if (firstDotIndex === -1) return sanitized;
  return `${sanitized.slice(0, firstDotIndex + 1)}${sanitized
    .slice(firstDotIndex + 1)
    .replace(/\./g, '')}`;
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

export function calculateOvertimePay(hourlySalary: number, overtimeHoursInput: string): OvertimeCalculatorResult | null {
  if (!Number.isFinite(hourlySalary) || hourlySalary <= 0) {
    return null;
  }

  const overtimeHours = parsePositiveNumber(overtimeHoursInput);
  if (!overtimeHours) {
    return null;
  }

  return {
    overtimeHours,
    workdayOvertimePay: hourlySalary * overtimeHours * 1.5,
    restDayOvertimePay: hourlySalary * overtimeHours * 2,
    holidayOvertimePay: hourlySalary * overtimeHours * 3
  };
}
