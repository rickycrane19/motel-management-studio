import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../time/location-date';
import {
  InventoryMovement,
  InventoryMovementPage,
  InventoryMovementQuery,
  InventoryMovementStats,
  InventoryMovementUpsert,
} from '../../models/inventory/movement.model';

/** Tipos que SUMAN al inventario (el SP los trata como entrada). */
export const IN_MOVEMENT_TYPES = ['Compra', 'AjusteEntrada', 'DevolucionCliente'] as const;
/** Tipos que RESTAN del inventario (el SP trata como salida y exige stock suficiente). */
export const OUT_MOVEMENT_TYPES = ['Venta', 'AjusteSalida', 'DevolucionProveedor'] as const;

export function movementSign(movementType: string): 1 | -1 {
  return (IN_MOVEMENT_TYPES as readonly string[]).includes(movementType) ? 1 : -1;
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  Compra: 'Compra',
  Venta: 'Venta al POS',
  AjusteEntrada: 'Ajuste de entrada',
  AjusteSalida: 'Ajuste de salida',
  DevolucionProveedor: 'Devolución a proveedor',
  DevolucionCliente: 'Devolución de cliente',
};

const TIME_ZONE = 'America/Managua';

export interface MovementStatsRange {
  readonly startDate: string;
  readonly endDate: string;
}

/**
 * Servicio de movimientos de Kardex de El Rapidin.
 *
 * El backend pagina en servidor (RT-05): la búsqueda, el filtro por
 * tipo/producto, el rango de fechas (clave AAAA-MM-DD en la zona de Managua) y
 * la página se envían al SP. Las tarjetas de resumen usan un SP ligero.
 */
@Injectable({ providedIn: 'root' })
export class MovementService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: InventoryMovementQuery): Observable<InventoryMovementPage> {
    const params = new HttpParams()
      .set('search', query.search.trim())
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));
    if (query.productId !== null) params.set('productId', String(query.productId));
    if (query.movementType !== null) params.set('movementType', query.movementType);
    const from = this.toUtcBound(query.startDate, 'from');
    const to = this.toUtcBound(query.endDate, 'to');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.http.get<InventoryMovementPage>(`${this.endpoint}/movements`, { params });
  }

  stats(range: MovementStatsRange): Observable<InventoryMovementStats> {
    let params = new HttpParams();
    const from = this.toUtcBound(range.startDate, 'from');
    const to = this.toUtcBound(range.endDate, 'to');
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<InventoryMovementStats>(`${this.endpoint}/movements/stats`, { params });
  }

  create(movement: InventoryMovementUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/movements`, {
      productId: movement.productId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      unitCost: movement.unitCost ?? null,
      reason: movement.reason?.trim() || null,
      referenceDoc: movement.referenceDoc?.trim() || null,
    });
  }

  /**
   * Sin caché local (la paginación vive en el servidor). Se conserva como no-op
   * para no tocar a los formularios que aún la invocan tras guardar.
   */
  invalidateCache(): void {
    // Intencionalmente vacío: ya no hay historial en memoria.
  }

  /** Límite UTC (ISO) de una clave AAAA-MM-DD de Managua: inicio del día o del día siguiente. */
  private toUtcBound(dateKey: string, bound: 'from' | 'to'): string | null {
    if (!dateKey) return null;
    const date = bound === 'from'
      ? startOfLocalDayUtc(dateKey, TIME_ZONE)
      : startOfNextLocalDayUtc(dateKey, TIME_ZONE);
    return date.toISOString();
  }
}
