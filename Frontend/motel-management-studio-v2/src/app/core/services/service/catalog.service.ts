import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, shareReplay } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  FineType,
  FineTypePage,
  FineTypeQuery,
  FineTypeStats,
  FineTypeUpsert,
  ServiceStayType,
  ServiceStayTypePage,
  ServiceStayTypeQuery,
  ServiceStayTypeStats,
  ServiceStayTypeUpsert,
} from '../../models/service/catalog.model';

/**
 * Catálogos del área Service de El Rapidin: tarifas de estancia (stay-types)
 * y tipos de multa (fine-types).
 *
 * El listado lo pagina el SP (búsqueda, estado y página viajan al servidor).
 * Los contadores y la ficha puntual se resuelven sobre una ventana amplia (200)
 * y se cachean hasta el próximo cambio del catálogo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/service`;
  private stayTypesCache: ServiceStayType[] | null = null;
  private fineTypesCache: FineType[] | null = null;

  // ── Tarifas de estancia ──────────────────────────────────────────────────────────────────

  listStayTypes(query: ServiceStayTypeQuery): Observable<ServiceStayTypePage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.name.trim();
    if (search) params = params.set('search', search);
    if (query.isActive !== null) params = params.set('onlyActive', String(query.isActive));
    if (query.isExtension !== null) params = params.set('isExtension', String(query.isExtension));

    return this.http.get<ServiceStayTypePage>(`${this.endpoint}/stay-types`, { params });
  }

  stayTypesStats(): Observable<ServiceStayTypeStats> {
    // El SP entrega los contadores junto a la página: se pide una sola fila.
    return this.http
      .get<ServiceStayTypePage>(`${this.endpoint}/stay-types`, { params: { page: '1', pageSize: '1' } })
      .pipe(map((page) => page.stats ?? { total: 0, active: 0, inactive: 0, extensions: 0 }));
  }

  getStayTypeById(id: number): Observable<ServiceStayType | null> {
    return this.fetchStayTypes().pipe(
      map((catalog) => catalog.find((row) => row.serviceStayTypeId === id) ?? null),
    );
  }

  createStayType(stayType: ServiceStayTypeUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/stay-types`, this.toStayTypeBody(stayType));
  }

  updateStayType(stayType: ServiceStayTypeUpsert & { readonly id: number }): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/stay-types/${stayType.id}`, this.toStayTypeBody(stayType));
  }

  setStayTypeActive(id: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/stay-types/${id}/set-active`, { serviceStayTypeId: id, isActive });
  }

  // ── Tipos de multa ───────────────────────────────────────────────────────────────────────

  listFineTypes(query: FineTypeQuery): Observable<FineTypePage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.name.trim();
    if (search) params = params.set('search', search);
    if (query.isActive !== null) params = params.set('onlyActive', String(query.isActive));

    return this.http.get<FineTypePage>(`${this.endpoint}/fine-types`, { params });
  }

  fineTypesStats(): Observable<FineTypeStats> {
    // El SP entrega los contadores junto a la página: se pide una sola fila.
    return this.http
      .get<FineTypePage>(`${this.endpoint}/fine-types`, { params: { page: '1', pageSize: '1' } })
      .pipe(map((page) => page.stats ?? { total: 0, active: 0, inactive: 0, averageAmount: 0 }));
  }

  getFineTypeById(id: number): Observable<FineType | null> {
    return this.fetchFineTypes().pipe(
      map((catalog) => catalog.find((row) => row.fineTypeId === id) ?? null),
    );
  }

  createFineType(fineType: FineTypeUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/fine-types`, this.toFineTypeBody(fineType));
  }

  updateFineType(fineType: FineTypeUpsert & { readonly id: number }): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/fine-types/${fineType.id}`, this.toFineTypeBody(fineType));
  }

  setFineTypeActive(id: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/fine-types/${id}/set-active`, { fineTypeId: id, isActive });
  }

  // ── Tipos de cuarto (filtro del formulario de tarifas) ───────────────────────────────────

  listRoomTypes(): Observable<readonly { id: number; name: string }[]> {
    return this.http
      .get<{ items: readonly { roomTypeId: number; name: string }[] }>(`${this.endpoint}/room-types`, {
        params: { page: '1', pageSize: '200' },
      })
      .pipe(map((page) => (page.items ?? []).map((roomType) => ({ id: roomType.roomTypeId, name: roomType.name }))));
  }

  // ── Interno ───────────────────────────────────────────────────────────────────────────────

  invalidateCache(): void {
    this.stayTypesCache = null;
    this.fineTypesCache = null;
  }

  /** Ventana amplia (máximo del SP) sin `onlyActive`: activos e inactivos. */
  private fetchStayTypes(): Observable<ServiceStayType[]> {
    if (this.stayTypesCache) return of(this.stayTypesCache);
    return this.http
      .get<{ items: ServiceStayType[] }>(`${this.endpoint}/stay-types`, {
        params: { page: '1', pageSize: '200' },
      })
      .pipe(
        map((page) => (this.stayTypesCache = [...(page.items ?? [])])),
        shareReplay(1),
      );
  }

  private fetchFineTypes(): Observable<FineType[]> {
    if (this.fineTypesCache) return of(this.fineTypesCache);
    return this.http
      .get<{ items: FineType[] }>(`${this.endpoint}/fine-types`, {
        params: { page: '1', pageSize: '200' },
      })
      .pipe(
        map((page) => (this.fineTypesCache = [...(page.items ?? [])])),
        shareReplay(1),
      );
  }

  private toStayTypeBody(stayType: ServiceStayTypeUpsert) {
    return {
      roomTypeId: stayType.roomTypeId,
      name: stayType.name.trim(),
      durationHours: stayType.durationHours,
      price: stayType.price,
      isExtension: stayType.isExtension,
      // El SP de alta siempre crea activas; el estado se cambia con set-active.
      isActive: stayType.isActive,
    };
  }

  private toFineTypeBody(fineType: FineTypeUpsert) {
    return {
      name: fineType.name.trim(),
      description: fineType.description?.trim() || null,
      defaultAmount: fineType.defaultAmount,
      // El SP de alta siempre crea activos; el estado se cambia con set-active.
      isActive: fineType.isActive,
    };
  }
}
