/**
 * Modelos de caja de El Rapidin (contrato del backend del motel).
 * El efectivo se contabiliza en moneda base (NIO) y los conteos en otras
 * monedas se convierten con la tasa vigente que publica cada denominación.
 */

export interface CashBoxDto {
  readonly cashBoxId: number;
  readonly tenantId: string;
  readonly locationId: string;
  readonly name: string;
  readonly code: string | null;
  readonly isActive: boolean;
}

export interface DenominationDto {
  readonly denominationId: number;
  readonly currencyCode: string;
  readonly currencyName: string | null;
  readonly currencySymbol: string | null;
  readonly value: number;
  readonly label: string;
  /** Tipo de cambio vigente hacia NIO. La moneda base siempre es NIO. */
  readonly exchangeRateToNIO: number | null;
}

export interface ActiveCashSessionDto {
  readonly cashBoxSessionId: number;
  readonly cashBoxId: number;
  readonly cashBoxName: string;
  readonly userId: number;
  readonly userName: string | null;
  readonly shiftName: string | null;
  readonly openedAtUtc: string | null;
  readonly openedAtManagua: string | null;
  readonly statusCode: string | null;
  readonly openingBalanceBase: number;
  readonly totalSalesBase: number;
  readonly totalInAdjustmentsBase: number;
  readonly totalOutAdjustmentsBase: number;
  readonly currentCalculatedBase: number;
  readonly notes: string | null;
}

export interface CashBoxSessionHeader {
  readonly cashBoxSessionId: number;
  readonly cashBoxId: number;
  readonly cashBoxName: string;
  readonly userId: number;
  readonly userName: string | null;
  readonly shiftName: string | null;
  readonly openedAtUtc: string | null;
  readonly closedAtUtc: string | null;
  readonly openedAtManagua: string | null;
  readonly closedAtManagua: string | null;
  readonly statusCode: string | null;
  readonly statusName: string | null;
  readonly openingBalanceBase: number;
  readonly totalSalesBase: number;
  readonly totalInAdjustmentsBase: number;
  readonly totalOutAdjustmentsBase: number;
  readonly closingCalculatedBase: number | null;
  readonly closingActualBase: number | null;
  readonly differenceBase: number | null;
  /** Resultado del arqueo calculado por el backend al cerrar. */
  readonly arqueoResult: string | null;
  readonly notes: string | null;
}

export interface CashBoxCountRow {
  readonly cashBoxCountId: number;
  readonly countTypeId: number;
  readonly countTypeName: string;
  readonly currencyCode: string;
  readonly denominationValue: number;
  readonly label: string;
  readonly count: number;
  readonly subTotal: number;
  readonly subTotalInBase: number;
  readonly recordedAt: string | null;
  readonly recordedAtManagua: string | null;
}

export interface CashBoxAdjustmentRow {
  readonly adjustmentId: number;
  readonly adjustmentType: 'IN' | 'OUT';
  readonly adjustmentTypeName: string;
  readonly currencyCode: string;
  readonly amount: number;
  readonly exchangeRate: number | null;
  readonly amountInBase: number;
  readonly reason: string | null;
  readonly recordedAt: string | null;
  readonly recordedAtManagua: string | null;
}

export interface CashBoxSessionSummary {
  readonly header: CashBoxSessionHeader;
  readonly counts: readonly CashBoxCountRow[];
  readonly adjustments: readonly CashBoxAdjustmentRow[];
}

/**
 * Turno del historial con su reconciliación (montos en moneda base NIO).
 * `differenceKind` es el resultado del arqueo que calcula el backend:
 * 'Cuadrada' | 'Sobrante' | 'Faltante'.
 */
export interface CashBoxSessionHistoryRow {
  readonly cashBoxSessionId: number;
  readonly cashBoxName: string;
  readonly shiftName: string | null;
  readonly userName: string | null;
  readonly openedAtUtc: string;
  readonly openedAtManagua: string | null;
  readonly closedAtUtc: string | null;
  readonly closedAtManagua: string | null;
  readonly statusCode: number;
  readonly statusName: string;
  readonly openingBalanceBase: number;
  readonly totalSalesBase: number;
  readonly totalInAdjustmentsBase: number;
  readonly totalOutAdjustmentsBase: number;
  readonly closingCalculatedBase: number;
  readonly closingActualBase: number;
  readonly differenceBase: number;
  readonly differenceKind: string;
  readonly notes: string | null;
  /** Número de ajustes de salida/gasto (OUT) del turno. */
  readonly outAdjustmentsCount: number;
  /** Número de líneas de conteo físico (denominaciones) del turno. */
  readonly countsCount: number;
}

/** Página del historial de turnos + el rango UTC realmente aplicado por el backend. */
export interface CashBoxSessionsHistoryPage {
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly items: readonly CashBoxSessionHistoryRow[];
  readonly totalRecords: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface CashBoxSessionsHistoryFilter {
  readonly fromUtc?: string | null;
  readonly toUtc?: string | null;
  readonly cashBoxId?: number | null;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CashBoxCountLine {
  readonly currencyCode: string;
  readonly denominationLabel: string;
  readonly denominationValue: number;
  readonly count: number;
  readonly subtotal: number;
  readonly subTotalInBase: number;
  readonly recordedAt: string | null;
}

/** Grupo de conteo por tipo (1 = Apertura, 2 = Pre-Arqueo, 3 = Cierre). */
export interface CashBoxCountGroup {
  readonly countTypeId: number;
  readonly countType: string;
  readonly recordedAt: string | null;
  readonly counts: readonly CashBoxCountLine[];
}

export interface CashBoxMonitorRow {
  readonly cashBoxId: number;
  readonly name: string;
  readonly code: string | null;
  readonly isActive: boolean;
  readonly sessionId: number | null;
  readonly shiftName: string | null;
  readonly userName: string | null;
  readonly openedAtUtc: string | null;
  readonly openingBalanceBase: number;
  readonly totalSalesBase: number;
  readonly inAdjustBase: number;
  readonly outAdjustBase: number;
  readonly currentCalculatedBase: number;
  readonly isOpen: boolean;
}
