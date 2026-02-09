import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExchangeConverter } from './ExchangeConverter';
import type { ExchangeRate } from '../model/types';

const mockRates: ExchangeRate[] = [
  { code: 'USD', name: '美元', rate: 0.14 },
  { code: 'EUR', name: '欧元', rate: 0.13 },
  { code: 'JPY', name: '日元', rate: 21.5 }
];

describe('ExchangeConverter', () => {
  it('应渲染换算器并显示结果', () => {
    render(<ExchangeConverter rates={mockRates} base="CNY" />);

    expect(screen.getByText('💱 货币换算')).toBeTruthy();
    expect(screen.getByLabelText('换算结果').textContent).toContain('0.1400');
  });

  it('交换按钮应互换 from/to 货币', () => {
    render(<ExchangeConverter rates={mockRates} base="CNY" />);

    const swapBtn = screen.getByTitle('交换货币');
    fireEvent.click(swapBtn);

    const result = screen.getByLabelText('换算结果').textContent;
    expect(result).toMatch(/7\.1428/);
  });

  it('计算器键盘可输入表达式并实时换算', () => {
    render(<ExchangeConverter rates={mockRates} base="CNY" />);

    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: '=' }));

    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByLabelText('换算结果').textContent).toContain('2.1000');
  });

  it('应支持基础科学计算按键', () => {
    render(<ExchangeConverter rates={mockRates} base="CNY" />);

    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '√x' }));
    expect(screen.getByText('3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'x²' }));
    expect(screen.getByText('9')).toBeTruthy();
  });
});
