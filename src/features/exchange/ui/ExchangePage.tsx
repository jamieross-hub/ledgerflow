import { useExchangeRates } from '../hooks/useExchangeRates';
import { ExchangeRateTable } from './ExchangeRateTable';
import { ExchangeConverter } from './ExchangeConverter';
import { getCurrencyName, CURRENCY_NAMES } from '../model/types';

/** 基准货币候选列表 */
const BASE_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'AUD', 'CAD', 'CHF'];

export function ExchangePage() {
  const { rates, base, date, loading, error, fromCache, setBase, refresh } = useExchangeRates('CNY');

  /** 所有可用货币代码（用于基准切换下拉） */
  const allCodes = Object.keys(CURRENCY_NAMES).sort();

  return (
    <div>
      <section className="panel">
        <div className="exchange-header">
          <h2 style={{ margin: 0 }}>💱 汇率数据</h2>
          <div className="exchange-base-picker">
            <label>基准货币：</label>
            <select value={base} onChange={(e) => setBase(e.target.value)}>
              {/* 常用 */}
              <optgroup label="常用">
                {BASE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code} - {getCurrencyName(code)}
                  </option>
                ))}
              </optgroup>
              {/* 全部 */}
              <optgroup label="全部">
                {allCodes
                  .filter((c) => !BASE_OPTIONS.includes(c))
                  .map((code) => (
                    <option key={code} value={code}>
                      {code} - {getCurrencyName(code)}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        <ExchangeRateTable
          rates={rates}
          base={base}
          date={date}
          fromCache={fromCache}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
      </section>

      <ExchangeConverter rates={rates} base={base} />
    </div>
  );
}
