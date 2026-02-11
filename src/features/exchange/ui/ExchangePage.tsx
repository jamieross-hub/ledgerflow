import { useExchangeRates } from '../hooks/useExchangeRates';
import { ExchangeRateTable } from './ExchangeRateTable';
import { ExchangeConverter } from './ExchangeConverter';
import { getCurrencyFlag, getCurrencyName, CURRENCY_NAMES } from '../model/types';

/** 基准货币候选列表 */
const BASE_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'AUD', 'CAD', 'CHF'];

export function ExchangePage() {
  const { rates, base, date, loading, error, fromCache, setBase, refresh } =
    useExchangeRates('CNY');

  /** 所有可用货币代码（用于基准切换下拉） */
  const allCodes = Object.keys(CURRENCY_NAMES).sort();

  return (
    <div>
      <section className="panel exchange-priority-converter">
        <div className="exchange-header">
          <h2 style={{ margin: 0 }}>💱 汇率换算器</h2>
          <div className="exchange-base-picker">
            <label htmlFor="exchange-base-code">基准货币：</label>
            <select
              id="exchange-base-code"
              aria-label="基准货币"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            >
              {/* 常用 */}
              <optgroup label="常用">
                {BASE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {getCurrencyFlag(code)} {code} - {getCurrencyName(code)}
                  </option>
                ))}
              </optgroup>
              {/* 全部 */}
              <optgroup label="全部">
                {allCodes
                  .filter((c) => !BASE_OPTIONS.includes(c))
                  .map((code) => (
                    <option key={code} value={code}>
                      {getCurrencyFlag(code)} {code} - {getCurrencyName(code)}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        <ExchangeConverter rates={rates} base={base} />
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <details className="exchange-rates-collapse">
          <summary>汇率数据（点击展开）</summary>
          <ExchangeRateTable
            rates={rates}
            base={base}
            date={date}
            fromCache={fromCache}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
        </details>
      </section>
    </div>
  );
}
