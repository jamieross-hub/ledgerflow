import { describe, expect, it } from 'vitest';
import {
  calculateOvertimePay,
  calculateSalaryMetrics,
  getOvertimeInputError,
  getSalaryInputError,
  sanitizePositiveNumberInput
} from './salaryCalculator';

describe('salaryCalculator', () => {
  it('sanitizes positive number input and removes extra dots', () => {
    expect(sanitizePositiveNumberInput('12a.3.4元')).toBe('12.34');
    expect(sanitizePositiveNumberInput('..8')).toBe('.8');
    expect(sanitizePositiveNumberInput('abc')).toBe('');
  });

  it('calculates daily, hourly and weekly salary metrics', () => {
    const result = calculateSalaryMetrics({
      monthlySalary: '12000',
      workingDays: '21.75',
      dailyHours: '8'
    });

    expect(result).not.toBeNull();
    expect(result?.dailySalary).toBeCloseTo(551.7241, 4);
    expect(result?.hourlySalary).toBeCloseTo(68.9655, 4);
    expect(result?.weeklySalary).toBeCloseTo(2758.6207, 4);
  });

  it('rejects invalid salary metric inputs', () => {
    expect(
      calculateSalaryMetrics({
        monthlySalary: '0',
        workingDays: '21.75',
        dailyHours: '8'
      })
    ).toBeNull();

    expect(
      calculateSalaryMetrics({
        monthlySalary: '12000',
        workingDays: '32',
        dailyHours: '8'
      })
    ).toBeNull();

    expect(
      calculateSalaryMetrics({
        monthlySalary: '12000',
        workingDays: '21.75',
        dailyHours: '25'
      })
    ).toBeNull();
  });

  it('returns targeted salary input error messages', () => {
    expect(
      getSalaryInputError({
        monthlySalary: '',
        workingDays: '21.75',
        dailyHours: '8'
      })
    ).toBe('请先填写月薪、计薪天数和每日工时');

    expect(
      getSalaryInputError({
        monthlySalary: '12000',
        workingDays: '32',
        dailyHours: '8'
      })
    ).toBe('计薪天数需为大于 0 且不超过 31 的合法数字');

    expect(
      getSalaryInputError({
        monthlySalary: '12000',
        workingDays: '21.75',
        dailyHours: '25'
      })
    ).toBe('每日工时需为大于 0 且不超过 24 的合法数字');
  });

  it('calculates overtime pay by workday, rest day and holiday rates', () => {
    const result = calculateOvertimePay(68.9655, '2');

    expect(result).not.toBeNull();
    expect(result?.workdayOvertimePay).toBeCloseTo(206.8965, 4);
    expect(result?.restDayOvertimePay).toBeCloseTo(275.862, 4);
    expect(result?.holidayOvertimePay).toBeCloseTo(413.793, 4);
  });

  it('rejects invalid overtime input and reports clear errors', () => {
    expect(calculateOvertimePay(68.9655, '25')).toBeNull();
    expect(calculateOvertimePay(0, '2')).toBeNull();

    expect(getOvertimeInputError(0, '2', false)).toBe('请先完成上方工资基础输入，才能计算加班工资');
    expect(getOvertimeInputError(68.9655, '', true)).toBe('请输入加班时长');
    expect(getOvertimeInputError(68.9655, '25', true)).toBe('加班时长需为大于 0 且不超过 24 的合法数字');
  });
});
