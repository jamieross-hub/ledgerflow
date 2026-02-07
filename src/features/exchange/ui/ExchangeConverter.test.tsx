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
    // 默认 from=CNY, to=USD, amount=1
    // 1 CNY → 0.14 USD
    expect(screen.getByText('0.1400')).toBeTruthy();
  });

  it('交换按钮应互换 from/to 货币', () => {
    render(<ExchangeConverter rates={mockRates} base="CNY" />);

    const swapBtn = screen.getByTitle('交换货币');
    fireEvent.click(swapBtn);

    // 交换后 from=USD, to=CNY
    // 1 USD → (1/0.14)*1 = 7.142857 CNY
    const result = screen.getByText(/7\.1428/);
    expect(result).toBeTruthy();
  });
});
