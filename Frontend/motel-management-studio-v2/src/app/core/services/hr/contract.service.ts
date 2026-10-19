import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  EmployeeContract,
  EmployeeContractPage,
  EmployeeContractQuery,
  EmployeeContractUpsert,
} from '../../models/hr/contract.model';

/**
 * Servicio de contratos laborales de El Rapidin contra el backend del motel.
 *
 * El SP pagina el histórico: búsqueda, modalidad, estado de vigencia y página
 * viajan al servidor. Los contadores de las tarjetas vienen en la misma página.
 */
@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/hr/contracts`;

  /** Histórico de contratos del tenant (opcionalmente de un solo empleado o solo vigentes). */
  list(query: EmployeeContractQuery, employeeId: number | null = null, onlyActive = false): Observable<EmployeeContractPage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (employeeId !== null) params = params.set('employeeId', String(employeeId));
    if (onlyActive) params = params.set('active', 'true');
    if (query.paymentType) params = params.set('paymentType', query.paymentType);
    if (query.status !== 'all') params = params.set('status', query.status);

    return this.http.get<EmployeeContractPage>(this.endpoint, { params });
  }

  /** Contrato vivo de un empleado (el último activo), o null si no tiene. */
  getActiveContract(employeeId: number): Observable<EmployeeContract | null> {
    return this.list(
      { pageNumber: 1, pageSize: 20, search: '', paymentType: null, status: 'active' },
      employeeId,
      true,
    ).pipe(
      map((page) => page.items.find((contract) => contract.isActive) ?? null),
    );
  }

  create(contract: EmployeeContractUpsert): Observable<number> {
    return this.http.post<number>(this.endpoint, this.toBody(contract));
  }

  update(contractId: number, contract: EmployeeContractUpsert): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${contractId}`, this.toBody(contract));
  }

  setActive(contractId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${contractId}/set-active`, { contractId, isActive });
  }

  private toBody(contract: EmployeeContractUpsert) {
    return {
      employeeId: contract.employeeId,
      position: contract.position.trim(),
      paymentType: contract.paymentType,
      baseAmount: contract.baseAmount,
      currencyCode: contract.currencyCode,
      startDate: contract.startDate,
      endDate: contract.endDate || null,
      scheduleNotes: contract.scheduleNotes?.trim() || null,
      notes: contract.notes?.trim() || null,
    };
  }
}
