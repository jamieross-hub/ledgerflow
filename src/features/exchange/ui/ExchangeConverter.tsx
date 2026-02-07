import { useCallback, useMemo, useState } from 'react';
import type { ExchangeRate } from '../model/types';
import { getCurrencyName } from '../model/types';

interface ExchangeConverterProps {
  rates: ExchangeRate[];
  base: string;
}

const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'] as const;
const QUICK_AMOUNTS = ['1', '10', '100', '1000'] as const;

export function ExchangeConverter({ rates, base }: ExchangeConverterProps) {
  const [fromCode, setFromCode] = useState(base);
  const [toCode, setToCode] = useState('USD');
  const [amount, setAmount] = useState('1');

  const allCurrencies = useMemo(() => {
    const codes = [base, ...rates.map((r) => r.code)];
    return [...new Set(codes)].sort();
  }, [rates, base]);

  const getRate = useCallback(
    (code: string): number => {
      if (code === base) return 1;
      const found = rates.find((r) => r.code === code);
      return found ? found.rate : 0;
    },
    [rates, base]
  );

  const fromRate = getRate(fromCode);
  const toRate = getRate(toCode);
  const numAmount = parseFloat(amount) || 0;
  const converted = fromRate > 0 && toRate > 0 ? (numAmount / fromRate) * toRate : 0;

  const swap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const applyKey = (key: (typeof KEYPAD)[number]) => {
    if (key === '⌫') {
      setAmount((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }

    setAmount((prev) => {
      if (key === '.') {
        return prev.includes('.') ? prev : `${prev}.`;
      }
      if (prev === '0') {
        return key;
      }
      return `${prev}${key}`;
    });
  };

  return (
    <section className="panel exchange-converter">
      <h3 style={{ marginTop: 0 }}>💱 货币换算</h3>

      <div className="exchange-converter-row">
        <div className="exchange-converter-field">
          <label>从</label>
          <select value={fromCode} onChange={(e) => setFromCode(e.target.value)}>
            {allCurrencies.map((code) => (
              <option key={code} value={code}>
                {code} - {getCurrencyName(code)}
              </option>
            ))}
          </select>
        </div>

        <button className="exchange-swap-btn" type="button" onClick={swap} title="交换货币" aria-label="交换货币">
          ⇄
        </button>

        <div className="exchange-converter-field">
          <label>到</label>
          <select value={toCode} onChange={(e) => setToCode(e.target.value)}>
            {allCurrencies.map((code) => (
              <option key={code} value={code}>
                {code} - {getCurrencyName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="exchange-calculator">
        <label>金额（{fromCode}）</label>
        <div className="exchange-calculator-screen mono-inline" aria-live="polite">
          {amount}
        </div>
        <div className="exchange-quick-row" role="group" aria-label="快捷金额">
          {QUICK_AMOUNTS.map((v) => (
            <button key={v} type="button" className="exchange-quick-btn" onClick={() => setAmount(v)}>
              {v}
            </button>
          ))}
          <button type="button" className="exchange-quick-btn" onClick={() => setAmount('0')}>
            清零
          </button>
        </div>
        <div className="exchange-keypad" role="group" aria-label="计算器键盘">
          {KEYPAD.map((key) => (
            <button
              key={key}
              type="button"
              className={key === '⌫' ? 'exchange-key danger' : 'exchange-key'}
              onClick={() => applyKey(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="exchange-converter-result mono-inline" aria-label="换算结果">
        {converted === 0 ? '—' : converted.toFixed(converted < 1 ? 6 : 4)}
      </div>

      {fromRate > 0 && toRate > 0 && (
        <p className="exchange-converter-hint">
          1 {fromCode} = {((1 / fromRate) * toRate).toFixed(6)} {toCode}
        </p>
      )}
    </section>
  );
}
