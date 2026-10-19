/** Catálogos del área Service de El Rapidin: tarifas de estancia y tipos de multa. */

// ── Tarifas / tipos de estancia ────────────────────────────────────────────────────────────

export interface ServiceStayType {
  serviceStayTypeId: number;
  roomTypeId: number | null;
  roomTypeName: string | null;
  name: string;
  durationHours: number;
  price: number;
  isExtension: boolean;
  isActive: boolean;
}

export interface ServiceStayTypeQuery {
  pageNumber: number;
  pageSize: number;
  name: string;
  isActive: boolean | null;
  isExtension: boolean | null;
}

export interface ServiceStayTypePage {
  totalRecords: number;
  page: number;
  pageSize: number;
  items: readonly ServiceStayType[];
  /** Contadores del SP para las tarjetas de resumen. */
  stats?: ServiceStayTypeStats;
}

export interface ServiceStayTypeStats {
  total: number;
  active: number;
  inactive: number;
  extensions: number;
}

export interface ServiceStayTypeUpsert {
  id?: number | null;
  roomTypeId: number | null;
  name: string;
  durationHours: number;
  price: number;
  isExtension: boolean;
  isActive: boolean;
}

// ── Tipos de multa ─────────────────────────────────────────────────────────────────────────

export interface FineType {
  fineTypeId: number;
  name: string;
  description: string | null;
  defaultAmount: number;
  isActive: boolean;
  createdOn: string;
}

export interface FineTypeQuery {
  pageNumber: number;
  pageSize: number;
  name: string;
  isActive: boolean | null;
}

export interface FineTypePage {
  totalRecords: number;
  page: number;
  pageSize: number;
  items: readonly FineType[];
  /** Contadores del SP para las tarjetas de resumen. */
  stats?: FineTypeStats;
}

export interface FineTypeStats {
  total: number;
  active: number;
  inactive: number;
  averageAmount: number;
}

export interface FineTypeUpsert {
  id?: number | null;
  name: string;
  description: string | null;
  defaultAmount: number;
  isActive: boolean;
}
