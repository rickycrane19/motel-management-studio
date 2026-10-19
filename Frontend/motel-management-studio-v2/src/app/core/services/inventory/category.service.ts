import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Category, CategoryPage, CategoryQuery } from '../../models/inventory/category.model';

/** Tope de filas que admite el SP de categorías al pedir el catálogo completo para un selector. */
const CATALOG_PAGE_SIZE = 200;

/**
 * Servicio de categorías de inventario de El Rapidin.
 *
 * El backend pagina en servidor (RT-05): la búsqueda, el estado y la página se
 * envían al SP; los selectores piden la primera página de activas con un tope
 * de 200 filas.
 */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: CategoryQuery): Observable<CategoryPage> {
    const params = new HttpParams()
      .set('search', query.search.trim())
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));
    if (query.isActive !== null) params.set('onlyActive', String(query.isActive));
    return this.http.get<CategoryPage>(`${this.endpoint}/categories`, { params });
  }

  /** Categorías activas para los selectores (`?onlyActive=true&pageSize=200`). */
  listActive(): Observable<readonly Category[]> {
    const params = new HttpParams()
      .set('onlyActive', 'true')
      .set('page', '1')
      .set('pageSize', String(CATALOG_PAGE_SIZE));
    return this.http.get<CategoryPage>(`${this.endpoint}/categories`, { params }).pipe(map((page) => page.items));
  }
}
