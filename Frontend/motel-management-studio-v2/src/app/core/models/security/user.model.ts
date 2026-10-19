/** Usuarios del sistema de El Rapidin (modelo alineado al backend motel). */

export interface SystemUser {
  userId: number;
  tenantId: string;
  locationId: string | null;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdOn: string;
}

export interface SystemUserPage {
  totalRecords: number;
  page: number;
  pageSize: number;
  items: readonly SystemUser[];
  /** Contadores del SP para las tarjetas de resumen. */
  stats?: SystemUserStats;
}

export interface SystemUserQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  role: string | null;
}

export interface SystemUserStats {
  total: number;
  active: number;
  roles: number;
}

/** Alta y edición de una cuenta. La contraseña vacía en edición conserva la actual. */
export interface SystemUserUpsert {
  username: string;
  email: string;
  fullName: string;
  role: string;
  password: string | null;
}
