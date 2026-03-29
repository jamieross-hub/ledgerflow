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

type NumberValidationOptions = {
  min?: number;
  max?: number;
};

const DEFAULT_NUMBER_MAX = 999999999;

export function sanitizePositiveNumberInput(value: string): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const firstDotIndex = sanitized.indexOf('.');
  if (firstDotIndex === -1) return sanitized;
  return `${sanitized.slice(0, firstDotIndex + 1)}${sanitized
    .slice(firstDotIndex + 1)
    .replace(/\./g, '')}`;
}

function parsePositiveNumber(value: string, options: NumberValidationOptions = {}): number | null {
  const normalized = String(value || '').trim();
  const min = options.min ?? 0;
  const max = options.max ?? DEFAULT_NUMBER_MAX;

  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= min) return null;
  if (parsed > max) return null;

  return parsed;
}

export function getSalaryInputError(input: SalaryCalculatorInput): string {
  if (!input.monthlySalary.trim() || !input.workingDays.trim() || !input.dailyHours.trim()) {
    return '请先填写月薪、计薪天数和每日工时';
  }

  const monthlySalary = parsePositiveNumber(input.monthlySalary);
  if (!monthlySalary) {
    return '月薪需为大于 0 的合法数字';
  }

  const workingDays = parsePositiveNumber(input.workingDays, { max: 31 });
  if (!workingDays) {
    return '计薪天数需为大于 0 且不超过 31 的合法数字';
  }

  const dailyHours = parsePositiveNumber(input.dailyHours, { max: 24 });
  if (!dailyHours) {
    return '每日工时需为大于 0 且不超过 24 的合法数字';
  }

  return '';
}

export function calculateSalaryMetrics(input: SalaryCalculatorInput): SalaryCalculatorResult | null {
  const monthlySalary = parsePositiveNumber(input.monthlySalary);
  const workingDays = parsePositiveNumber(input.workingDays, { max: 31 });
  const dailyHours = parsePositiveNumber(input.dailyHours, { max: 24 });

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

export function getOvertimeInputError(
  hourlySalary: number,
  overtimeHoursInput: string,
  hasSalaryMetrics: boolean
): string {
  if (!hasSalaryMetrics || !Number.isFinite(hourlySalary) || hourlySalary <= 0) {
    return '请先完成上方工资基础输入，才能计算加班工资';
  }

  if (!overtimeHoursInput.trim()) {
    return '请输入加班时长';
  }

  const overtimeHours = parsePositiveNumber(overtimeHoursInput, { max: 24 });
  if (!overtimeHours) {
    return '加班时长需为大于 0 且不超过 24 的合法数字';
  }

  return '';
}

export function calculateOvertimePay(hourlySalary: number, overtimeHoursInput: string): OvertimeCalculatorResult | null {
  if (!Number.isFinite(hourlySalary) || hourlySalary <= 0) {
    return null;
  }

  const overtimeHours = parsePositiveNumber(overtimeHoursInput, { max: 24 });
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
