import { useCallback, useMemo, useState } from 'react';
import type { ExchangeRate } from '../model/types';
import { getCurrencyName } from '../model/types';

interface ExchangeConverterProps {
  rates: ExchangeRate[];
  base: string;
}

const KEYPAD = [
  'C',
  '⌫',
  '(',
  ')',
  '7',
  '8',
  '9',
  '÷',
  '4',
  '5',
  '6',
  '×',
  '1',
  '2',
  '3',
  '-',
  '±',
  '0',
  '.',
  '+',
  'x²',
  '√x',
  '1/x',
  '='
] as const;

function normalizeExpression(input: string): string {
  return input.replace(/×/g, '*').replace(/÷/g, '/');
}

function evaluateExpression(input: string): number | null {
  const expression = normalizeExpression(input).trim();
  if (!expression) {
    return null;
  }

  if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
    return null;
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression});`)() as unknown;
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

function prettyNumber(value: number): string {
  const fixed = value.toFixed(10);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function ExchangeConverter({ rates, base }: ExchangeConverterProps) {
  const [fromCode, setFromCode] = useState(base);
  const [toCode, setToCode] = useState('USD');
  const [expression, setExpression] = useState('1');
  const [error, setError] = useState('');

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

  const numAmount = useMemo(() => {
    const parsed = evaluateExpression(expression);
    return parsed ?? 0;
  }, [expression]);

  const converted = fromRate > 0 && toRate > 0 ? (numAmount / fromRate) * toRate : 0;

  const swap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const appendToken = (token: string) => {
    setError('');
    setExpression((prev) => {
      if (prev === '0' && /^\d$/.test(token)) {
        return token;
      }
      return `${prev}${token}`;
    });
  };

  const applyUnary = (kind: 'square' | 'sqrt' | 'inv' | 'sign') => {
    const current = evaluateExpression(expression);
    if (current === null) {
      setError('表达式无效，无法执行计算');
      return;
    }

    let next = current;
    if (kind === 'square') {
      next = current * current;
    }
    if (kind === 'sqrt') {
      if (current < 0) {
        setError('负数无法开方');
        return;
      }
      next = Math.sqrt(current);
    }
    if (kind === 'inv') {
      if (current === 0) {
        setError('0 无法作为除数');
        return;
      }
      next = 1 / current;
    }
    if (kind === 'sign') {
      next = -current;
    }

    setError('');
    setExpression(prettyNumber(next));
  };

  const applyEqual = () => {
    const value = evaluateExpression(expression);
    if (value === null) {
      setError('表达式无效，无法计算');
      return;
    }
    setError('');
    setExpression(prettyNumber(value));
  };

  const applyKey = (key: (typeof KEYPAD)[number]) => {
    if (key === 'C') {
      setExpression('0');
      setError('');
      return;
    }
    if (key === '⌫') {
      setError('');
      setExpression((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === '=') {
      applyEqual();
      return;
    }
    if (key === 'x²') {
      applyUnary('square');
      return;
    }
    if (key === '√x') {
      applyUnary('sqrt');
      return;
    }
    if (key === '1/x') {
      applyUnary('inv');
      return;
    }
    if (key === '±') {
      applyUnary('sign');
      return;
    }

    appendToken(key);
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
          {expression}
        </div>
        {error ? <p className="exchange-calculator-error">{error}</p> : null}
        <div className="exchange-keypad" role="group" aria-label="计算器键盘">
          {KEYPAD.map((key) => {
            const isNum = /^\d$/.test(key) || key === '.';
            const isOperator = ['÷', '×', '-', '+', '='].includes(key);
            const isFn = ['(', ')', 'x²', '√x', '1/x', '±'].includes(key);
            const isDanger = key === 'C' || key === '⌫';

            return (
              <button
                key={key}
                type="button"
                className={`exchange-key ${isNum ? 'exchange-key-num' : ''} ${isOperator ? 'exchange-key-op' : ''} ${isFn ? 'exchange-key-fn' : ''} ${isDanger ? 'exchange-key-danger' : ''} ${key === '=' ? 'exchange-key-equal primary' : ''}`.trim()}
                onClick={() => applyKey(key)}
              >
                {key}
              </button>
            );
          })}
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
