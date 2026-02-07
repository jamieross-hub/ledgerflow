import { useCallback, useMemo, useState } from 'react';
import type { ExchangeRate } from '../model/types';
import { getCurrencyName } from '../model/types';

interface ExchangeConverterProps {
  rates: ExchangeRate[];
  base: string;
}

export function ExchangeConverter({ rates, base }: ExchangeConverterProps) {
  const [fromCode, setFromCode] = useState(base);
  const [toCode, setToCode] = useState('USD');
  const [amount, setAmount] = useState('1');

  /** 构建完整的货币列表（含 base 自身） */
  const allCurrencies = useMemo(() => {
    const codes = [base, ...rates.map((r) => r.code)];
    return [...new Set(codes)].sort();
  }, [rates, base]);

  /** 获取相对于 base 的汇率 */
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

  return (
    <section className="panel exchange-converter">
      <h3 style={{ marginTop: 0 }}>💱 货币换算</h3>

      <div className="exchange-converter-row">
        {/* 源货币 */}
        <div className="exchange-converter-field">
          <label>从</label>
          <select value={fromCode} onChange={(e) => setFromCode(e.target.value)}>
            {allCurrencies.map((code) => (
              <option key={code} value={code}>
                {code} - {getCurrencyName(code)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金额"
          />
        </div>

        {/* 交换按钮 */}
        <button className="exchange-swap-btn" onClick={swap} title="交换货币">
          ⇄
        </button>

        {/* 目标货币 */}
        <div className="exchange-converter-field">
          <label>到</label>
          <select value={toCode} onChange={(e) => setToCode(e.target.value)}>
            {allCurrencies.map((code) => (
              <option key={code} value={code}>
                {code} - {getCurrencyName(code)}
              </option>
            ))}
          </select>
          <div className="exchange-converter-result mono-inline">
            {converted === 0 ? '—' : converted.toFixed(converted < 1 ? 6 : 4)}
          </div>
        </div>
      </div>

      {fromRate > 0 && toRate > 0 && (
        <p className="exchange-converter-hint">
          1 {fromCode} = {((1 / fromRate) * toRate).toFixed(6)} {toCode}
        </p>
      )}
    </section>
  );
}
