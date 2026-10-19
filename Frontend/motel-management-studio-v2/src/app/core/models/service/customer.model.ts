/** Clientes registrados del motel (paginado en servidor). */

export interface Customer {
  customerId: number;
  fullName: string;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdOn: string;
}

export interface CustomerStats {
  total: number;
  active: number;
  withContact: number;
}

export interface CustomerPage {
  items: readonly Customer[];
  totalRecords: number;
  page: number;
  pageSize: number;
  stats?: CustomerStats;
}

export interface CustomerQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  onlyActive: boolean | null;
}

export interface CustomerUpsert {
  fullName: string;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}
