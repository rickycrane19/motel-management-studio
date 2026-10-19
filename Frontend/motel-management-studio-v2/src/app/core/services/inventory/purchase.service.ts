import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { dateKeyInTimeZone, startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../time/location-date';
import {
  Purchase,
  PurchasePage,
  PurchaseQuery,
  PurchaseType,
  PurchaseUpsert,
} from '../../models/inventory/purchase.model';

/** Etiquetas legibles de los tipos de documento de compra / devolución a proveedor. */
export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
  Compra: 'Compra',
  DevolucionProveedor: 'Devolución a proveedor',
};

/**
 * Servicio de compras y devoluciones a proveedor de El Rapidin.
 *
 * El SP pagina el histórico: búsqueda, tipo, rango de fechas (días completos de
 * Managua) y página viajan al servidor. Los contadores del rango vuelven en la
 * misma página que entrega el SP.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: PurchaseQuery): Observable<PurchasePage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.purchaseType !== null) params = params.set('type', query.purchaseType);
    if (query.startDate) {
      params = params.set('from', startOfLocalDayUtc(query.startDate, 'America/Managua').toISOString());
    }
    if (query.endDate) {
      params = params.set('to', startOfNextLocalDayUtc(query.endDate, 'America/Managua').toISOString());
    }

    return this.http.get<PurchasePage>(`${this.endpoint}/purchases`, { params });
  }

  getById(purchaseId: number): Observable<PurchaseDetailEnvelope | null> {
    return this.http.get<PurchaseDetailEnvelope | null>(`${this.endpoint}/purchases/${purchaseId}`);
  }

  create(purchase: PurchaseUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/purchases`, {
      purchaseType: purchase.purchaseType,
      supplierId: purchase.supplierId ?? null,
      supplierName: purchase.supplierName?.trim() || null,
      referenceDoc: purchase.referenceDoc?.trim() || null,
      cashBoxSessionId: purchase.cashBoxSessionId ?? null,
      notes: purchase.notes?.trim() || null,
      items: purchase.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    });
  }

  /** Sin caché: cada vista pide su ventana al SP (método conservado por compatibilidad). */
  invalidateCache(): void {
    // No-op: el histórico ya no se cachea en el cliente.
  }

  /** Clave de día (AAAA-MM-DD) de un documento, en la zona horaria de Managua. */
  dayKey(purchase: Purchase): string {
    return dateKeyInTimeZone(new Date(purchase.createdOnUtc), 'America/Managua');
  }

  label(purchaseType: string): string {
    return PURCHASE_TYPE_LABELS[purchaseType as PurchaseType] ?? purchaseType;
  }
}

/** Respuesta del detalle del backend: encabezado + líneas. */
export interface PurchaseDetailEnvelope {
  header: Omit<Purchase, 'lineCount'>;
  items: readonly PurchaseDetailItem[];
}

export interface PurchaseDetailItem {
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
