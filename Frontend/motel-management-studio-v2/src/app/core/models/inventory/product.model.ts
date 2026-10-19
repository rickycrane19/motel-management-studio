/** Productos del minibar de El Rapidin (modelo alineado al backend motel). */

export interface Product {
  productId: number;
  categoryId: number;
  categoryName: string;
  code: string;
  name: string;
  description: string | null;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStock: number;
  unitOfMeasure: string;
  imageUrl: string | null;
  isActive: boolean;
  isLowStock: boolean;
}

export interface ProductPage {
  items: readonly Product[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface ProductQuery {
  pageNumber: number;
  pageSize: number;
  name: string;
  categoryId: number | null;
  isActive: boolean | null;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  lowStock: number;
}

export interface ProductUpsert {
  id?: number | null;
  name: string;
  code: string;
  description: string | null;
  categoryId: number;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStock: number;
  unitOfMeasure: string;
  imageUrl: string | null;
  isActive: boolean;
  imageFile?: File;
}
