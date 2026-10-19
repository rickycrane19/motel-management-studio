/** Empleados de El Rapidin (modelo alineado al backend motel). */

export interface Employee {
  employeeId: number;
  fullName: string;
  position: string;
  paymentType: string;
  paymentTypeName: string;
  rate: number;
  commissionRatePercent: number;
  currencyCode: string;
  phone: string | null;
  isActive: boolean;
  createdOn: string;
  /** Contrato vigente del empleado, si lo tiene (lo resuelve el SP). */
  hasActiveContract?: boolean;
  contractId?: number | null;
  contractPaymentType?: string | null;
  contractBaseAmount?: number | null;
}

export interface EmployeePage {
  totalRecords: number;
  page: number;
  pageSize: number;
  items: readonly Employee[];
}

export interface EmployeeQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  paymentType: string | null;
  isActive: boolean | null;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
}

export interface EmployeeUpsert {
  fullName: string;
  position: string;
  paymentType: string;
  rate: number;
  /** Porcentaje de comisión sobre ventas cobradas (0–100). */
  commissionRatePercent: number;
  currencyCode: string;
  phone: string | null;
}
