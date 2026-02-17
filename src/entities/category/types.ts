export interface Category {
  id: string;
  name: string;
  kind?: 'income' | 'expense';
  color?: string;
  icon?: string;
  sortOrder?: number;
}
