import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CommissionRule,
  CommissionRulePage,
  CommissionRuleQuery,
  CommissionRuleUpsert,
} from '../../models/hr/commission-rule.model';

/**
 * Servicio de reglas de comisión de El Rapidin.
 *
 * La paginación, la búsqueda y los filtros los resuelve el SP: el cliente pide
 * solo la ventana visible. Una regla se aplica por empleado, por puesto o a
 * todos, sobre una métrica (ventas, estancias, minibar o propinas) y un tramo
 * de monto con vigencia.
 */
@Injectable({ providedIn: 'root' })
export class CommissionRuleService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/hr/commission-rules`;

  list(query: CommissionRuleQuery): Observable<CommissionRulePage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.onlyActive !== null) params = params.set('onlyActive', String(query.onlyActive));
    if (query.scopeType) params = params.set('scopeType', query.scopeType);
    if (query.metricType) params = params.set('metricType', query.metricType);

    return this.http.get<CommissionRulePage>(this.endpoint, { params });
  }

  create(rule: CommissionRuleUpsert): Observable<number> {
    return this.http.post<number>(this.endpoint, this.toBody(rule));
  }

  update(ruleId: number, rule: CommissionRuleUpsert): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${ruleId}`, this.toBody(rule));
  }

  setActive(ruleId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${ruleId}/set-active`, { isActive });
  }

  private toBody(rule: CommissionRuleUpsert) {
    return {
      name: rule.name.trim(),
      scopeType: rule.scopeType,
      metricType: rule.metricType,
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount,
      ratePercent: rule.ratePercent,
      startDate: rule.startDate,
      endDate: rule.endDate,
      employeeId: rule.scopeType === 'Employee' ? rule.employeeId : null,
      position: rule.scopeType === 'Position' ? rule.position?.trim() || null : null,
      notes: rule.notes?.trim() || null,
    };
  }
}

export type { CommissionRule };
