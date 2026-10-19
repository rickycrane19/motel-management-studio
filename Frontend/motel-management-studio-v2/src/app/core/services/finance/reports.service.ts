import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ActiveLossCashSession,
  FinancialLossPage,
  LossListFilter,
  RecordFinancialLossInput,
} from '../../models/finance/losses.model';
import {
  FinancialSummaryReport,
  InventoryReport,
  PayrollExpenseReport,
  ProductSalesReport,
  ServiceSalesReport,
  CashierPerformanceReport,
} from '../../models/finance/finance-reports.model';

/**
 * Reportes consolidados y pérdidas de El Rapidin contra el backend de Finance.
 * El JWT lo agrega el interceptor; montos del negocio en moneda base C$ (NIO).
 *
 * Los rangos se mandan como instantes UTC (yyyy-MM-ddTHH:mm:ssZ); si no se mandan,
 * el backend aplica el mes actual en Managua y SIEMPRE responde con el rango real
 * aplicado (fromUtc/toUtc), que es el que muestra el UI.
 */
@Injectable({ providedIn: 'root' })
export class FinanceReportsService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/finance`;

  summary(fromUtc: string | null, toUtc: string | null): Observable<FinancialSummaryReport> {
    return this.http.get<FinancialSummaryReport>(`${this.endpoint}/reports/summary`, { params: this.range(fromUtc, toUtc) });
  }

  serviceSales(fromUtc: string | null, toUtc: string | null): Observable<ServiceSalesReport> {
    return this.http.get<ServiceSalesReport>(`${this.endpoint}/reports/sales/service`, { params: this.range(fromUtc, toUtc) });
  }

  productSales(fromUtc: string | null, toUtc: string | null): Observable<ProductSalesReport> {
    return this.http.get<ProductSalesReport>(`${this.endpoint}/reports/sales/products`, { params: this.range(fromUtc, toUtc) });
  }

  inventory(fromUtc: string | null, toUtc: string | null): Observable<InventoryReport> {
    return this.http.get<InventoryReport>(`${this.endpoint}/reports/inventory`, { params: this.range(fromUtc, toUtc) });
  }

  payroll(fromUtc: string | null, toUtc: string | null): Observable<PayrollExpenseReport> {
    return this.http.get<PayrollExpenseReport>(`${this.endpoint}/reports/payroll`, { params: this.range(fromUtc, toUtc) });
  }

  /** Rendimiento por cajero con propinas y comisiones; `userId` opcional filtra un solo usuario. */
  cashiers(fromUtc: string | null, toUtc: string | null, userId: number | null = null): Observable<CashierPerformanceReport> {
    let params = this.range(fromUtc, toUtc);
    if (userId !== null && userId !== undefined) params = params.set('userId', userId);
    return this.http.get<CashierPerformanceReport>(`${this.endpoint}/reports/cashiers`, { params });
  }

  private range(fromUtc: string | null, toUtc: string | null): HttpParams {
    let params = new HttpParams();
    if (fromUtc) params = params.set('from', fromUtc);
    if (toUtc) params = params.set('to', toUtc);
    return params;
  }
}

/** Cliente de pérdidas registrables (registro inmutable, solo listado paginado + alta). */
@Injectable({ providedIn: 'root' })
export class LossesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/finance`;

  list(filters: LossListFilter = {}): Observable<FinancialLossPage> {
    let params = new HttpParams();
    if (filters.fromUtc) params = params.set('from', filters.fromUtc);
    if (filters.toUtc) params = params.set('to', filters.toUtc);
    if (filters.category) params = params.set('category', filters.category);
    params = params.set('page', filters.page ?? 1);
    params = params.set('pageSize', filters.pageSize ?? 50);
    return this.http.get<FinancialLossPage>(`${this.endpoint}/losses`, { params });
  }

  record(input: RecordFinancialLossInput): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/losses`, {
      categoryCode: input.categoryCode,
      description: input.description,
      amount: input.amount,
      currencyCode: input.currencyCode ?? 'NIO',
      roomId: input.roomId ?? null,
      roomStayId: input.roomStayId ?? null,
      cashBoxSessionId: input.cashBoxSessionId ?? null,
    });
  }

  /** Sesión activa del usuario (para el check «descontar de caja del turno»). */
  activeSession(): Observable<ActiveLossCashSession | null> {
    return this.http.get<ActiveLossCashSession | null>(`${this.endpoint}/sessions/active`);
  }
}
