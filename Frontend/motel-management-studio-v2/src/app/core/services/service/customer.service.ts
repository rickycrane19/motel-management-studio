import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CustomerPage,
  CustomerQuery,
  CustomerStats,
  CustomerUpsert,
} from '../../models/service/customer.model';

/** Servicio de clientes: el SP pagina, filtra y devuelve los contadores. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/service/customers`;

  list(query: CustomerQuery): Observable<CustomerPage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.onlyActive !== null) params = params.set('onlyActive', String(query.onlyActive));

    return this.http.get<CustomerPage>(this.endpoint, { params });
  }

  stats(): Observable<CustomerStats> {
    return this.http
      .get<CustomerPage>(this.endpoint, { params: { page: '1', pageSize: '1' } })
      .pipe(map((page) => page.stats ?? { total: 0, active: 0, withContact: 0 }));
  }

  create(payload: CustomerUpsert): Observable<number> {
    return this.http.post<number>(this.endpoint, payload);
  }

  update(customerId: number, payload: CustomerUpsert): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${customerId}`, payload);
  }

  setActive(customerId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${customerId}/set-active`, { isActive });
  }
}
