/** Contratos laborales de El Rapidin (modelo alineado al backend motel). */

export interface EmployeeContract {
  contractId: number;
  tenantId: string;
  employeeId: number;
  employeeName: string;
  employeePosition: string | null;
  position: string;
  paymentType: string;
  paymentTypeName: string;
  baseAmount: number;
  currencyCode: string;
  /** Clave AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  /** Días hasta la fecha de fin; negativo = ya venció. */
  daysToEnd: number | null;
  scheduleNotes: string | null;
  notes: string | null;
  createdOn: string;
  createdBy: number | null;
}

export type ContractStatus = 'active' | 'expiring' | 'expired' | 'ended' | 'all';

export interface EmployeeContractQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  paymentType: string | null;
  status: ContractStatus;
}

export interface EmployeeContractStats {
  active: number;
  expiring: number;
  expired: number;
  ended: number;
}

/** Página del histórico de contratos: la ventana pedida + total y contadores del SP. */
export interface EmployeeContractPage {
  items: readonly EmployeeContract[];
  totalRecords: number;
  page: number;
  pageSize: number;
  stats: EmployeeContractStats;
}

export interface EmployeeContractUpsert {
  employeeId: number;
  position: string;
  paymentType: string;
  baseAmount: number;
  currencyCode: string;
  /** Clave AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
  scheduleNotes: string | null;
  notes: string | null;
}
