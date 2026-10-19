import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  SystemUser,
  SystemUserPage,
  SystemUserQuery,
  SystemUserStats,
  SystemUserUpsert,
} from '../../models/security/user.model';

/**
 * Servicio de usuarios del sistema de El Rapidin.
 *
 * El SP pagina en servidor: búsqueda, estado, perfil y página viajan al backend.
 * Las tarjetas de resumen se alimentan de los contadores que el SP devuelve en
 * la misma página (se pide una sola fila).
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/security`;

  list(query: SystemUserQuery): Observable<SystemUserPage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.role) params = params.set('role', query.role);

    return this.http.get<SystemUserPage>(`${this.endpoint}/users`, { params });
  }

  stats(): Observable<SystemUserStats> {
    return this.http
      .get<SystemUserPage>(`${this.endpoint}/users`, { params: { page: '1', pageSize: '1' } })
      .pipe(map((page) => page.stats ?? { total: 0, active: 0, roles: 0 }));
  }

  getById(userId: number): Observable<SystemUser> {
    return this.http.get<SystemUser>(`${this.endpoint}/users/${userId}`);
  }

  create(payload: SystemUserUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/users`, payload);
  }

  update(userId: number, payload: SystemUserUpsert): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/users/${userId}`, payload);
  }

  setActive(userId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/users/${userId}/set-active`, { isActive });
  }
}
