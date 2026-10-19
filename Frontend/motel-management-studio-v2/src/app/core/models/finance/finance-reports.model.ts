/** Modelos de reportes consolidados de Finance (El Rapidin). Montos en moneda base C$ (NIO). */

export interface FinanceReportEnvelope {
  readonly fromUtc: string;
  readonly toUtc: string;
}

/** Resumen financiero: los totales se leen DIRECTO por fuente (nunca vía ajustes de caja). */
export interface FinancialSummaryDto {
  readonly closedStays: number;
  readonly revenueStays: number;
  readonly revenueProducts: number;
  readonly revenueFines: number;
  readonly expensePurchases: number;
  readonly recoverySupplierReturns: number;
  readonly expenseCustomerReturns: number;
  readonly expensePayroll: number;
  readonly expenseLosses: number;
  readonly expenseManualAdjustments: number;
  readonly otherIncomeManualAdjustments: number;
}

export interface FinancialSummaryReport extends FinanceReportEnvelope {
  readonly data: FinancialSummaryDto | null;
}

/** Ventas de servicios: fila por (tipo de tarifa × tipo de llegada). */
export interface ServiceSalesRowDto {
  readonly serviceStayTypeId: number;
  readonly stayTypeName: string;
  readonly arrivalType: number;
  readonly arrivalName: string;
  readonly stays: number;
  readonly baseRevenue: number;
  readonly extensionRevenue: number;
  readonly productsRevenue: number;
  readonly finesRevenue: number;
  readonly totalRevenue: number;
  readonly avgStayTotal: number;
  readonly avgHours: number;
}

export interface ServiceSalesReport extends FinanceReportEnvelope {
  readonly rows: readonly ServiceSalesRowDto[];
}

/** Ventas de productos (minibar) por producto consumido en estancias cerradas/cobradas. */
export interface ProductSalesRowDto {
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly categoryName: string | null;
  readonly unitOfMeasure: string;
  readonly soldQuantity: number;
  readonly revenue: number;
  readonly cost: number;
  readonly margin: number;
  readonly staysWithSale: number;
}

export interface ProductSalesReport extends FinanceReportEnvelope {
  readonly rows: readonly ProductSalesRowDto[];
}

/** Inventario: valor de stock (instantánea) + actividad del kardex del período. */
export interface InventoryReportRowDto {
  readonly productId: number;
  readonly productCode: string;
  readonly productName: string;
  readonly categoryName: string;
  readonly unitOfMeasure: string;
  readonly currentStock: number;
  readonly minStock: number;
  readonly isUnderMinStock: boolean;
  readonly costPrice: number;
  readonly salePrice: number;
  readonly stockValue: number;
  readonly purchaseQuantity: number;
  readonly purchaseCost: number;
  readonly supplierReturnQuantity: number;
  readonly supplierReturnCost: number;
  readonly customerReturnCost: number;
  readonly soldQuantity: number;
  readonly soldCost: number;
  readonly adjustmentCost: number;
}

export interface InventoryReport {
  readonly fromUtc: string | null;
  readonly toUtc: string | null;
  readonly rows: readonly InventoryReportRowDto[];
}

/** Nómina: gasto consolidado por empleado contra el tipo de pago de su contrato. */
export interface PayrollExpenseRowDto {
  readonly employeeId: number;
  readonly fullName: string;
  readonly position: string;
  readonly contractPaymentType: string | null;
  readonly paymentsCount: number;
  readonly totalPaid: number;
  readonly grossPaid: number;
  readonly netPaid: number;
  readonly contractPaid: number;
  readonly extraPaid: number;
  readonly extraPayments: number;
  readonly extraShifts: number;
  readonly bonusAmount: number;
  readonly deductionsAmount: number;
  readonly inssDeductions: number;
  readonly irDeductions: number;
  readonly loanDeductions: number;
  readonly advanceDeductions: number;
  readonly otherDeductions: number;
  readonly lastPaidAtUtc: string | null;
}

export interface PayrollExpenseReport extends FinanceReportEnvelope {
  readonly rows: readonly PayrollExpenseRowDto[];
}

/**
 * Rendimiento por cajero/usuario. Una fila por usuario con sesiones en el rango y, al final,
 * una fila TOTAL (userId = 0, role nulo) que el UI usa para los totales del período.
 */
export interface CashierPerformanceRowDto {
  readonly userId: number;
  readonly userName: string;
  readonly userFullName: string;
  readonly role: string | null;
  readonly sessionsCount: number;
  readonly openSessionsCount: number;
  readonly hoursOnShift: number;
  readonly staysCount: number;
  readonly staysRevenue: number;
  readonly productsRevenue: number;
  readonly finesRevenue: number;
  readonly salesCollected: number;
  readonly avgTicket: number;
  readonly adjustmentsInBase: number;
  readonly adjustmentsOutBase: number;
  readonly tipsInBase: number;
  readonly tiesCount: number;
  readonly commissionRuleName: string | null;
  readonly commissionMetricType: string | null;
  readonly commissionRatePercent: number;
  readonly commissionAmount: number;
  readonly differenceBase: number;
  readonly fromManagua: string;
  readonly toManagua: string;
}

export interface CashierPerformanceReport extends FinanceReportEnvelope {
  readonly rows: readonly CashierPerformanceRowDto[];
}

/** Etiquetas del desglose de la pestaña «Resumen financiero». */
export interface SummaryLine {
  readonly label: string;
  readonly amount: number;
  readonly kind: 'income' | 'expense';
}
