/** Pagos a empleados de El Rapidin (modelo alineado al backend motel). */

/** Deducción detallada aplicada a un pago (INSS, IR, préstamo, adelanto u otro). */
export interface EmployeeDeductionInput {
  type: string;
  description: string | null;
  amount: number;
}

export interface EmployeePayment {
  paymentId: number;
  employeeId: number;
  employeeName: string;
  position: string;
  paymentType: string;
  periodStart: string;
  periodEnd: string;
  unitsWorked: number;
  rateApplied: number;
  baseAmount: number;
  bonusAmount: number;
  deductionsAmount: number;
  totalPaid: number;
  netPaid: number;
  currencyCode: string;
  paidFromCashBoxSessionId: number | null;
  /** El pago fue un turno extra fuera del contrato vigente. */
  isExtraShift: boolean;
  contractId: number | null;
  hasContract: boolean;
  deductionsCount: number;
  notes: string | null;
  paidAtUtc: string;
  paidAtManagua: string;
}

export interface EmployeePaymentPage {
  items: readonly EmployeePayment[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface EmployeePaymentUpsert {
  employeeId: number;
  paymentType: string;
  /** Clave AAAA-MM-DD. */
  periodStart: string;
  periodEnd: string;
  unitsWorked: number;
  rateApplied: number;
  bonusAmount: number;
  deductionsAmount: number;
  currencyCode: string;
  notes: string | null;
  /** Turno extra pagado fuera del contrato vigente (por día u hora). */
  isExtraShift: boolean;
  /** Deducciones detalladas: el SP calcula el total como su suma. */
  deductions: readonly EmployeeDeductionInput[];
  /**
   * Sesión de caja del turno cuando el pago en efectivo sale de la caja
   * (el turno extra del caso del dueño). Opcional: si va vacío el pago se
   * registra sin tocar el efectivo del turno.
   */
  cashBoxSessionId?: number | null;
}
