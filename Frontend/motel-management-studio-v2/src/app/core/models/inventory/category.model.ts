/** Categorías de inventario de El Rapidin (modelo alineado al backend motel). */

export interface Category {
  categoryId: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CategoryPage {
  items: readonly Category[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface CategoryQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  isActive: boolean | null;
}
