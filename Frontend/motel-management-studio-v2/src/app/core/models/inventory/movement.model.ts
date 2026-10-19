/** Movimientos de Kardex de El Rapidin (modelo alineado al backend motel). */

export interface InventoryMovement {
  movementId: number;
  productId: number;
  productName: string;
  productCode: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  referenceDoc: string | null;
  roomStayId: number | null;
  createdOnUtc: string;
  createdOnManagua: string;
}

export interface InventoryMovementPage {
  items: readonly InventoryMovement[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface InventoryMovementQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  movementType: string | null;
  productId: number | null;
  /** Claves AAAA-MM-DD en la zona de Managua. */
  startDate: string;
  endDate: string;
}

export interface InventoryMovementStats {
  total: number;
  entries: number;
  exits: number;
}

export interface InventoryMovementUpsert {
  productId: number;
  /** Buy, Venta, AjusteEntrada, AjusteSalida, DevolucionProveedor o DevolucionCliente. */
  movementType: string;
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  referenceDoc?: string | null;
}
