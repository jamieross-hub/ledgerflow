import { describe, expect, it } from 'vitest';
import { buildTransactionFilterParams, parseTransactionFilterParams } from './useTransactionFilters';

describe('useTransactionFilters', () => {
  it('应正确解析 query 并约束非法值', () => {
    const params = new URLSearchParams('keyword=coffee&type=income&source=wechat&datePreset=custom&dateFrom=2026-01-01&dateTo=2026-01-31&page=2');
    const parsed = parseTransactionFilterParams(params);

    expect(parsed.keyword).toBe('coffee');
    expect(parsed.type).toBe('income');
    expect(parsed.source).toBe('wechat');
    expect(parsed.datePreset).toBe('custom');
    expect(parsed.dateFrom).toBe('2026-01-01');
    expect(parsed.dateTo).toBe('2026-01-31');
    expect(parsed.page).toBe(2);
  });

  it('应将默认值省略并生成稳定 query', () => {
    const params = buildTransactionFilterParams({
      keyword: '',
      type: 'all',
      source: 'all',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      page: 1
    });

    expect(params.toString()).toBe('');
  });
});
