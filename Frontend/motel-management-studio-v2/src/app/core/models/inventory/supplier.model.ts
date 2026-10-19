/** Maestro de proveedores de El Rapidin (modelo alineado al backend motel). */

export interface Supplier {
  supplierId: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  createdOnUtc: string;
  createdOnManagua: string | null;
  purchasesCount: number;
  lastPurchaseManagua: string | null;
}

export interface SupplierPage {
  items: readonly Supplier[];
  totalRecords: number;
  page: number;
  pageSize: number;
  /** Contadores del maestro que calcula el SP. */
  stats?: SupplierStats;
}

export interface SupplierQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  isActive: boolean | null;
}

export interface SupplierStats {
  total: number;
  active: number;
  withPurchases: number;
}

export interface SupplierUpsert {
  id?: number | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
}

/** Compra reciente del proveedor para el detalle del listado. */
export interface SupplierPurchase {
  purchaseId: number;
  purchaseType: string;
  totalAmount: number;
  currencyCode: string;
  createdOnManagua: string | null;
}

export interface SupplierDetail {
  supplier: Supplier | null;
  recentPurchases: readonly SupplierPurchase[];
}
