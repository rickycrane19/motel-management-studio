import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, forkJoin, map, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ActiveCashSessionDto, CashBoxDto, CashBoxMonitorRow, CashBoxSessionSummary, CashBoxSessionsHistoryFilter, CashBoxSessionsHistoryPage, DenominationDto } from '../../models/finance/cashbox-operations.model';

/**
 * Cliente de caja de El Rapidin contra el backend del motel.
 * El JWT lo agrega el interceptor; el efectivo se cuenta en moneda base (NIO).
 */
@Injectable({ providedIn: 'root' })
export class CashBoxOperationsService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/finance`;

  cashBoxes(): Observable<readonly CashBoxDto[]> {
    return this.http.get<readonly CashBoxDto[]>(`${this.endpoint}/cashboxes`);
  }

  denominations(): Observable<readonly DenominationDto[]> {
    return this.http.get<readonly DenominationDto[]>(`${this.endpoint}/denominations`);
  }

  /** Sesión abierta; sin cashBoxId devuelve la del usuario actual (GET /sessions/active). */
  activeSession(cashBoxId?: number): Observable<ActiveCashSessionDto | null> {
    const params = cashBoxId ? new HttpParams().set('cashBoxId', cashBoxId) : new HttpParams();
    return this.http.get<ActiveCashSessionDto | null>(`${this.endpoint}/sessions/active`, { params });
  }

  sessionSummary(sessionId: number): Observable<CashBoxSessionSummary> {
    return this.http.get<CashBoxSessionSummary>(`${this.endpoint}/sessions/${sessionId}/summary`);
  }

  /**
   * Historial paginado de turnos con su reconciliación (GET /sessions).
   * Los rango se mandan como instantes UTC; si no llegan, el backend usa los últimos
   * 30 días del negocio (America/Managua) y responde el rango efectivo (fromUtc/toUtc).
   */
  sessions(filters: CashBoxSessionsHistoryFilter = {}): Observable<CashBoxSessionsHistoryPage> {
    let params = new HttpParams();
    if (filters.fromUtc) params = params.set('from', filters.fromUtc);
    if (filters.toUtc) params = params.set('to', filters.toUtc);
    if (filters.cashBoxId !== null && filters.cashBoxId !== undefined) params = params.set('cashBoxId', filters.cashBoxId);
    params = params.set('page', filters.page ?? 1);
    params = params.set('pageSize', filters.pageSize ?? 20);
    return this.http.get<CashBoxSessionsHistoryPage>(`${this.endpoint}/sessions`, { params });
  }

  /** Devuelve el identificador de la nueva sesión (201 con el id en el cuerpo). */
  open(input: OpenCashSessionInput): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/sessions/open`, input);
  }

  /** El backend calcula diferencia y resultado del arqueo (204). */
  close(sessionId: number, closingActualBase: number, notes: string | null = null): Observable<void> {
    return this.http.post<void>(`${this.endpoint}/sessions/${sessionId}/close`, { closingActualBase, notes });
  }

  /**
   * El motivo se envía en `reason`; el backend no acepta un campo de notas aparte.
   * `sourceCode` clasifica el movimiento (AjusteManual, Propina, Comision u Otro) para los reportes.
   */
  addAdjustment(
    sessionId: number,
    adjustmentType: 'IN' | 'OUT',
    currencyCode: string,
    amount: number,
    reason: string | null = null,
    sourceCode: string = 'AjusteManual',
  ): Observable<void> {
    return this.http.post<void>(`${this.endpoint}/sessions/${sessionId}/adjustments`, {
      adjustmentType,
      currencyCode,
      amount,
      reason,
      sourceCode,
    });
  }

  addCount(sessionId: number, countTypeId: number, denominationId: number, count: number): Observable<void> {
    return this.http.post<void>(`${this.endpoint}/sessions/${sessionId}/counts`, { countTypeId, denominationId, count });
  }

  /**
   * El monitor del motel existe como consulta por caja: combina las cajas con su
   * sesión activa (en paralelo). Una caja sin sesión o con fallo queda disponible.
   */
  monitor(): Observable<readonly CashBoxMonitorRow[]> {
    return this.cashBoxes().pipe(
      switchMap((cashBoxes) => {
        if (!cashBoxes.length) return of<readonly CashBoxMonitorRow[]>([]);
        return forkJoin(cashBoxes.map((cashBox) =>
          this.activeSession(cashBox.cashBoxId).pipe(catchError(() => of(null))),
        )).pipe(map((sessions) => cashBoxes.map((cashBox, index) => toMonitorRow(cashBox, sessions[index] ?? null))));
      }),
    );
  }
}

export interface OpenCashSessionInput {
  readonly cashBoxId: number;
  readonly shiftName: string;
  readonly openingBalanceBase: number;
  readonly notes: string | null;
}

function toMonitorRow(cashBox: CashBoxDto, session: ActiveCashSessionDto | null): CashBoxMonitorRow {
  return {
    cashBoxId: cashBox.cashBoxId,
    name: cashBox.name,
    code: cashBox.code,
    isActive: cashBox.isActive,
    sessionId: session?.cashBoxSessionId ?? null,
    shiftName: session?.shiftName ?? null,
    userName: session?.userName ?? null,
    openedAtUtc: session?.openedAtUtc ?? null,
    openingBalanceBase: session?.openingBalanceBase ?? 0,
    totalSalesBase: session?.totalSalesBase ?? 0,
    inAdjustBase: session?.totalInAdjustmentsBase ?? 0,
    outAdjustBase: session?.totalOutAdjustmentsBase ?? 0,
    currentCalculatedBase: session?.currentCalculatedBase ?? 0,
    isOpen: !!session,
  };
}
