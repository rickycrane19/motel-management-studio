import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { dateKeyInTimeZone, startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../time/location-date';
import {
  CustomerReturn,
  CustomerReturnPage,
  CustomerReturnQuery,
  CustomerReturnUpsert,
} from '../../models/inventory/purchase.model';

/**
 * Servicio de devoluciones de cliente de El Rapidin.
 *
 * El SP pagina el histórico: búsqueda, rango de fechas (días completos de Managua)
 * y página viajan al servidor. Los contadores del rango vuelven con la página.
 */
@Injectable({ providedIn: 'root' })
export class CustomerReturnService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: CustomerReturnQuery): Observable<CustomerReturnPage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.startDate) {
      params = params.set('from', startOfLocalDayUtc(query.startDate, 'America/Managua').toISOString());
    }
    if (query.endDate) {
      params = params.set('to', startOfNextLocalDayUtc(query.endDate, 'America/Managua').toISOString());
    }

    return this.http.get<CustomerReturnPage>(`${this.endpoint}/customer-returns`, { params });
  }

  getById(customerReturnId: number): Observable<CustomerReturnDetailEnvelope | null> {
    return this.http.get<CustomerReturnDetailEnvelope | null>(`${this.endpoint}/customer-returns/${customerReturnId}`);
  }

  create(customerReturn: CustomerReturnUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/customer-returns`, {
      customerName: customerReturn.customerName?.trim() || null,
      roomStayId: customerReturn.roomStayId ?? null,
      cashBoxSessionId: customerReturn.cashBoxSessionId ?? null,
      notes: customerReturn.notes?.trim() || null,
      items: customerReturn.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });
  }

  /** Sin caché: cada vista pide su ventana al SP (método conservado por compatibilidad). */
  invalidateCache(): void {
    // No-op: el histórico ya no se cachea en el cliente.
  }

  /** Clave de día (AAAA-MM-DD) de una devolución, en la zona horaria de Managua. */
  dayKey(customerReturn: CustomerReturn): string {
    return dateKeyInTimeZone(new Date(customerReturn.createdOnUtc), 'America/Managua');
  }
}

/** Respuesta del detalle del backend: encabezado + líneas. */
export interface CustomerReturnDetailEnvelope {
  header: Omit<CustomerReturn, 'lineCount'>;
  items: readonly CustomerReturnDetailItem[];
}

export interface CustomerReturnDetailItem {
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
