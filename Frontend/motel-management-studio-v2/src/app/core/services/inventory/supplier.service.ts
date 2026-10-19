import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  Supplier,
  SupplierDetail,
  SupplierPage,
  SupplierQuery,
  SupplierStats,
  SupplierUpsert,
} from '../../models/inventory/supplier.model';

/** Tope de filas que admite el SP del maestro al cargar el selector de proveedores. */
const STATS_PAGE_SIZE = 500;

/**
 * Servicio del maestro de proveedores de El Rapidin.
 *
 * El backend pagina en servidor: la búsqueda, el filtro de estado y la página se
 * envían al SP; las tarjetas de resumen salen de los contadores del mismo SP.
 */
@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: SupplierQuery): Observable<SupplierPage> {
    const params = new HttpParams()
      .set('search', query.search.trim())
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));
    if (query.isActive !== null) params.set('onlyActive', String(query.isActive));
    return this.http.get<SupplierPage>(`${this.endpoint}/suppliers`, { params });
  }

  stats(): Observable<SupplierStats> {
    const params = new HttpParams().set('page', '1').set('pageSize', '1');
    return this.http.get<SupplierPage>(`${this.endpoint}/suppliers`, { params }).pipe(
      map((page) => page.stats ?? {
        total: page.totalRecords,
        active: 0,
        withPurchases: 0,
      }),
    );
  }

  /** Proveedores activos para el selector de compras (`?onlyActive=true`, tope del SP). */
  listActive(): Observable<readonly Supplier[]> {
    const params = new HttpParams()
      .set('onlyActive', 'true')
      .set('page', '1')
      .set('pageSize', String(STATS_PAGE_SIZE));
    return this.http.get<SupplierPage>(`${this.endpoint}/suppliers`, { params }).pipe(map((page) => page.items));
  }

  getById(supplierId: number): Observable<SupplierDetail | null> {
    return this.http.get<SupplierDetail | null>(`${this.endpoint}/suppliers/${supplierId}`);
  }

  create(supplier: SupplierUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/suppliers`, this.toBody(supplier));
  }

  update(supplierId: number, supplier: SupplierUpsert): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/suppliers/${supplierId}`, this.toBody(supplier));
  }

  setActive(supplierId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/suppliers/${supplierId}/set-active`, { supplierId, isActive });
  }

  private toBody(supplier: SupplierUpsert) {
    return {
      name: supplier.name.trim(),
      contactName: supplier.contactName?.trim() || null,
      phone: supplier.phone?.trim() || null,
      email: supplier.email?.trim() || null,
      address: supplier.address?.trim() || null,
      taxId: supplier.taxId?.trim() || null,
      notes: supplier.notes?.trim() || null,
    };
  }
}
