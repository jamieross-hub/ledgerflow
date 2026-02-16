export const EMPTY_CATEGORY_FILTER_VALUE = '__empty_category__';

export function matchesCategoryQuickFilter(categoryFilter: string, categoryId: string): boolean {
  const normalizedCategoryId = categoryId.trim();

  if (!categoryFilter) {
    return true;
  }

  if (categoryFilter === EMPTY_CATEGORY_FILTER_VALUE) {
    return normalizedCategoryId.length === 0;
  }

  return normalizedCategoryId === categoryFilter;
}
