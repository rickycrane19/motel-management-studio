/** Compras, devoluciones a proveedor y devoluciones de cliente (modelo alineado al backend motel). */

export const PURCHASE_TYPES = ['Compra', 'DevolucionProveedor'] as const;
export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export interface Purchase {
  purchaseId: number;
  purchaseType: PurchaseType;
  supplierId: number | null;
  supplierName: string | null;
  referenceDoc: string | null;
  totalAmount: number;
  currencyCode: string;
  cashBoxSessionId: number | null;
  notes: string | null;
  lineCount: number;
  createdOnUtc: string;
  createdOnManagua: string;
}

export interface PurchaseItem {
  purchaseItemId: number;
  productId: number;
  productName: string;
  productCode: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  notes: string | null;
}

export interface PurchaseDetail {
  header: PurchaseDetailHeader | null;
  items: readonly PurchaseItem[];
}

export interface PurchaseDetailHeader {
  purchaseId: number;
  purchaseType: PurchaseType;
  supplierId: number | null;
  supplierName: string | null;
  referenceDoc: string | null;
  totalAmount: number;
  currencyCode: string;
  cashBoxSessionId: number | null;
  notes: string | null;
  createdOnUtc: string;
  createdOnManagua: string;
}

export interface PurchaseQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  purchaseType: PurchaseType | null;
  /** Claves AAAA-MM-DD en la zona de Managua. */
  startDate: string;
  endDate: string;
}

export interface PurchaseStats {
  documents: number;
  boughtAmount: number;
  returnedAmount: number;
}

/** Página del histórico de compras: la ventana pedida + total y contadores del SP. */
export interface PurchasePage {
  items: readonly Purchase[];
  totalRecords: number;
  page: number;
  pageSize: number;
  stats: PurchaseStats;
}

export interface PurchaseLineDraft {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface PurchaseUpsert {
  purchaseType: PurchaseType;
  supplierId: number | null;
  supplierName: string | null;
  referenceDoc: string | null;
  cashBoxSessionId: number | null;
  notes: string | null;
  items: readonly PurchaseLineDraft[];
}

export interface CustomerReturn {
  customerReturnId: number;
  customerName: string | null;
  roomStayId: number | null;
  totalRefund: number;
  currencyCode: string;
  cashBoxSessionId: number | null;
  notes: string | null;
  lineCount: number;
  createdOnUtc: string;
  createdOnManagua: string;
}

export interface CustomerReturnItem {
  customerReturnItemId: number;
  productId: number;
  productName: string;
  productCode: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}

export interface CustomerReturnDetail {
  header: CustomerReturnDetailHeader | null;
  items: readonly CustomerReturnItem[];
}

export interface CustomerReturnDetailHeader {
  customerReturnId: number;
  customerName: string | null;
  roomStayId: number | null;
  totalRefund: number;
  currencyCode: string;
  cashBoxSessionId: number | null;
  notes: string | null;
  createdOnUtc: string;
  createdOnManagua: string;
}

export interface CustomerReturnQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  /** Claves AAAA-MM-DD en la zona de Managua. */
  startDate: string;
  endDate: string;
}

export interface CustomerReturnStats {
  documents: number;
  refundedAmount: number;
}

/** Página del histórico de devoluciones: la ventana pedida + total y contadores del SP. */
export interface CustomerReturnPage {
  items: readonly CustomerReturn[];
  totalRecords: number;
  page: number;
  pageSize: number;
  stats: CustomerReturnStats;
}

export interface CustomerReturnLineDraft {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface CustomerReturnUpsert {
  customerName: string | null;
  roomStayId: number | null;
  cashBoxSessionId: number | null;
  notes: string | null;
  items: readonly CustomerReturnLineDraft[];
}
