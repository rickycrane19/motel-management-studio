/** Modelos de pérdidas registrables (Finance.FinancialLoss). Registro inmutable: solo listar/crear. */

export type LossCategoryCode = 'Habitacion' | 'Minibar' | 'Caja' | 'Otro';

export const LOSS_CATEGORY_LABELS: Record<LossCategoryCode, string> = {
  Habitacion: 'Habitación',
  Minibar: 'Minibar',
  Caja: 'Caja',
  Otro: 'Otro',
};

export interface FinancialLossDto {
  readonly lossId: number;
  readonly tenantId: string;
  readonly locationId: string | null;
  readonly categoryCode: LossCategoryCode;
  readonly categoryName: string;
  readonly roomId: number | null;
  readonly roomNumber: string | null;
  readonly roomStayId: number | null;
  readonly description: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly exchangeRate: number;
  readonly amountInBase: number;
  /** Si la pérdida se descontó del efectivo del turno activo; null = quedó solo en reportes. */
  readonly cashBoxSessionId: number | null;
  readonly recordedAtManagua: string | null;
  readonly createdByName: string | null;
}

export interface RecordFinancialLossInput {
  readonly categoryCode: LossCategoryCode;
  readonly description: string;
  readonly amount: number;
  readonly currencyCode?: string;
  readonly roomId?: number | null;
  readonly roomStayId?: number | null;
  readonly cashBoxSessionId?: number | null;
}

/** Página del listado de pérdidas: solo la ventana pedida + el total para paginar. */
export interface FinancialLossPage {
  readonly items: readonly FinancialLossDto[];
  readonly totalRecords: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface LossListFilter {
  readonly fromUtc?: string | null;
  readonly toUtc?: string | null;
  readonly category?: string | null;
  readonly page?: number;
  readonly pageSize?: number;
}

/** Sesión de caja activa del usuario (para el check «descontar de caja del turno»). */
export interface ActiveLossCashSession {
  readonly cashBoxSessionId: number;
  readonly cashBoxId: number;
  readonly cashBoxName: string;
  readonly shiftName: string;
  readonly userName: string;
  readonly statusCode: number;
  readonly openedAtUtc: string;
}
