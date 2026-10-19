import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Employee, EmployeePage, EmployeeQuery, EmployeeStats, EmployeeUpsert } from '../../models/hr/employee.model';

/**
 * Servicio de empleados de El Rapidin contra el backend del motel.
 *
 * La paginación, la búsqueda y los filtros se resuelven en el SP (servidor):
 * el cliente solo pide la ventana que muestra. Las tarjetas de resumen usan el
 * endpoint ligero de contadores.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/hr`;

  list(query: EmployeeQuery): Observable<EmployeePage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.paymentType) params = params.set('paymentType', query.paymentType);
    if (query.isActive !== null) params = params.set('onlyActive', String(query.isActive));

    return this.http.get<EmployeePage>(`${this.endpoint}/employees`, { params });
  }

  stats(): Observable<EmployeeStats> {
    return this.http
      .get<{ totalEmployees: number; activeEmployees: number; inactiveEmployees: number }>(
        `${this.endpoint}/employees/stats`,
      )
      .pipe(
        map((stats) => ({
          total: stats.totalEmployees ?? 0,
          active: stats.activeEmployees ?? 0,
          inactive: stats.inactiveEmployees ?? 0,
        })),
      );
  }

  getById(employeeId: number): Observable<Employee | null> {
    return this.http.get<Employee>(`${this.endpoint}/employees/${employeeId}`);
  }

  /** Alta de empleado (201 con el identificador en el cuerpo). */
  create(employee: EmployeeUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/employees`, this.toBody(employee));
  }

  update(employee: EmployeeUpsert & { readonly employeeId: number }): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/employees/${employee.employeeId}`, this.toBody(employee));
  }

  /** Compatibilidad: ya no hay caché local porque la paginación vive en el servidor. */
  invalidateCache(): void {
    // Intencionalmente vacío.
  }

  private toBody(employee: EmployeeUpsert) {
    return {
      fullName: employee.fullName.trim(),
      position: employee.position.trim(),
      paymentType: employee.paymentType,
      rate: employee.rate,
      commissionRatePercent: employee.commissionRatePercent ?? 0,
      currencyCode: employee.currencyCode,
      phone: employee.phone?.trim() || null,
    };
  }
}
