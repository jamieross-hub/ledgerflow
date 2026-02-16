import { describe, expect, it } from 'vitest';
import { EMPTY_CATEGORY_FILTER_VALUE, matchesCategoryQuickFilter } from './categoryQuickFilter';

describe('matchesCategoryQuickFilter', () => {
  it('returns true for all categories when filter is empty', () => {
    expect(matchesCategoryQuickFilter('', 'cat-1')).toBe(true);
    expect(matchesCategoryQuickFilter('', '')).toBe(true);
  });

  it('matches specific category id', () => {
    expect(matchesCategoryQuickFilter('cat-1', 'cat-1')).toBe(true);
    expect(matchesCategoryQuickFilter('cat-1', 'cat-2')).toBe(false);
  });

  it('matches uncategorized transactions when empty-category filter is selected', () => {
    expect(matchesCategoryQuickFilter(EMPTY_CATEGORY_FILTER_VALUE, '')).toBe(true);
    expect(matchesCategoryQuickFilter(EMPTY_CATEGORY_FILTER_VALUE, '   ')).toBe(true);
    expect(matchesCategoryQuickFilter(EMPTY_CATEGORY_FILTER_VALUE, 'cat-1')).toBe(false);
  });
});
