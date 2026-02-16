import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { ExchangeRateTable } from './ExchangeRateTable';
import { ExchangeConverter } from './ExchangeConverter';
import { getCurrencyFlag, getCurrencyName, CURRENCY_NAMES } from '../model/types';

/** 基准货币候选列表 */
const BASE_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'AUD', 'CAD', 'CHF'];

const MIN_LEFT_WIDTH = 320;
const MIN_RIGHT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 420;

export function ExchangePage() {
  const { rates, base, date, loading, error, fromCache, setBase, refresh } =
    useExchangeRates('CNY');
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);

  /** 所有可用货币代码（用于基准切换下拉） */
  const allCodes = Object.keys(CURRENCY_NAMES).sort();

  useEffect(() => {
    const clampByContainer = () => {
      const node = layoutRef.current;
      if (!node) {
        return;
      }

      const total = node.getBoundingClientRect().width;
      const maxLeft = Math.max(MIN_LEFT_WIDTH, total - MIN_RIGHT_WIDTH);
      setLeftWidth((prev) => Math.min(Math.max(prev, MIN_LEFT_WIDTH), maxLeft));
    };

    clampByContainer();
    window.addEventListener('resize', clampByContainer);

    return () => {
      window.removeEventListener('resize', clampByContainer);
    };
  }, []);

  const handleDividerMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = layoutRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const maxLeft = Math.max(MIN_LEFT_WIDTH, rect.width - MIN_RIGHT_WIDTH);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(Math.max(moveEvent.clientX - rect.left, MIN_LEFT_WIDTH), maxLeft);
      setLeftWidth(nextWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('exchange-resizing');
    };

    document.body.classList.add('exchange-resizing');
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className="exchange-layout"
      ref={layoutRef}
      style={{ '--exchange-left-width': `${leftWidth}px` } as CSSProperties}
    >
      <section className="panel exchange-priority-converter">
        <div className="exchange-header exchange-card-header">
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

      <div
        className="exchange-resize-divider"
        role="separator"
        aria-label="调整汇率换算器与汇率数据宽度"
        aria-orientation="vertical"
        onMouseDown={handleDividerMouseDown}
      />

      <section className="panel exchange-data-card">
        <div className="exchange-data-header exchange-card-header">
          <h2 style={{ margin: 0 }}>📊 汇率数据</h2>
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
    </div>
  );
}
