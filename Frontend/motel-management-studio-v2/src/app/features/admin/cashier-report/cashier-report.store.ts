import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { CashierPerformanceReport, CashierPerformanceRowDto } from '../../../core/models/finance/finance-reports.model';
import { FinanceReportsService } from '../../../core/services/finance/reports.service';
import { UserService } from '../../../core/services/security/user.service';
import { ComboboxOption } from '../../../shared/ui';
import { startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../../core/time/location-date';

export type CashierLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type CashierQuickRange = 'today' | 'week' | 'last30' | 'currentMonth';

/** Día del negocio (America/Managua) con desplazamiento de días; nunca el día UTC. */
export function managuaDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

export function managuaMonthStart(): string {
  return `${managuaDay().slice(0, 7)}-01`;
}

export interface CashierQuickRangeOption {
  readonly id: CashierQuickRange;
  readonly label: string;
  readonly start: () => string;
  readonly end: () => string;
  readonly hint: string;
}

const MANAGUA_ZONE = 'America/Managua';

export const CASHIER_QUICK_RANGES: readonly CashierQuickRangeOption[] = [
  { id: 'today', label: 'Hoy', start: () => managuaDay(), end: () => managuaDay(), hint: 'El día del negocio en Managua' },
  { id: 'week', label: '7 días', start: () => managuaDay(-6), end: () => managuaDay(), hint: 'Semana móvil' },
  { id: 'last30', label: '30 días', start: () => managuaDay(-29), end: () => managuaDay(), hint: 'Últimos 30 días' },
  { id: 'currentMonth', label: 'Mes', start: () => managuaMonthStart(), end: () => managuaDay(), hint: 'Mes actual del negocio' },
];

export const CASHIER_QUICK_RANGE_IDS: readonly CashierQuickRange[] = CASHIER_QUICK_RANGES.map((range) => range.id);

/** Totales del período; se calculan sumando las filas de usuario (userId !== 0). */
export interface CashierTotals {
  readonly users: number;
  readonly sessionsCount: number;
  readonly openSessionsCount: number;
  readonly hoursOnShift: number;
  readonly staysCount: number;
  readonly staysRevenue: number;
  readonly productsRevenue: number;
  readonly finesRevenue: number;
  readonly salesCollected: number;
  readonly tipsInBase: number;
  readonly tiesCount: number;
  readonly commissionAmount: number;
  readonly differenceBase: number;
}

interface CashierState {
  readonly status: CashierLoadStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly userId: number | null;
  readonly report: CashierPerformanceReport | null;
  readonly users: readonly ComboboxOption<number>[];
  readonly errorMessage: string | null;
}

@Injectable()
export class CashierReportStore {
  private readonly reportsService = inject(FinanceReportsService);
  private readonly usersService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<CashierState>({
    status: 'idle',
    startDate: managuaMonthStart(),
    endDate: managuaDay(),
    userId: null,
    report: null,
    users: [],
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly startDate = computed(() => this.state().startDate);
  readonly endDate = computed(() => this.state().endDate);
  readonly userId = computed(() => this.state().userId);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly userOptions = computed(() => this.state().users);

  /** Filas por usuario (la fila TOTAL del SP se separa para los totales). */
  readonly rows = computed<readonly CashierPerformanceRowDto[]>(() =>
    (this.state().report?.rows ?? []).filter((row) => row.userId !== 0));

  readonly totals = computed<CashierTotals>(() => {
    const rows = this.rows();
    const sum = (pick: (row: CashierPerformanceRowDto) => number): number =>
      rows.reduce((total, row) => total + (pick(row) || 0), 0);
    return {
      users: rows.length,
      sessionsCount: sum((row) => row.sessionsCount),
      openSessionsCount: sum((row) => row.openSessionsCount),
      hoursOnShift: sum((row) => row.hoursOnShift),
      staysCount: sum((row) => row.staysCount),
      staysRevenue: sum((row) => row.staysRevenue),
      productsRevenue: sum((row) => row.productsRevenue),
      finesRevenue: sum((row) => row.finesRevenue),
      salesCollected: sum((row) => row.salesCollected),
      tipsInBase: sum((row) => row.tipsInBase),
      tiesCount: sum((row) => row.tiesCount),
      commissionAmount: sum((row) => row.commissionAmount),
      differenceBase: sum((row) => row.differenceBase),
    };
  });

  /** Rango efectivo que informa el backend (o el elegido, si aún no hay respuesta). */
  readonly appliedRangeLabel = computed(() => `${this.state().startDate} al ${this.state().endDate}`);

  readonly activeFilterCount = computed(() => {
    const state = this.state();
    return (state.userId !== null ? 1 : 0)
      + (state.startDate !== managuaMonthStart() ? 1 : 0)
      + (state.endDate !== managuaDay() ? 1 : 0);
  });

  /** Carga usuarios del tenant para el filtro (lista en caché del servicio de seguridad). */
  loadUsers(): void {
    this.usersService.list({ pageNumber: 1, pageSize: 500, search: '', role: null })
      .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of({ totalRecords: 0, items: [] })))
      .subscribe({
        next: (page) => this.patch({
          users: page.items
            .map((user) => ({ value: user.userId, label: user.fullName, hint: `${user.username} · ${user.role}` }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        }),
      });
  }

  load(): void {
    // Los días elegidos son días del negocio (Managua): [inicio del día, inicio del día siguiente).
    const fromUtc = startOfLocalDayUtc(this.state().startDate, MANAGUA_ZONE).toISOString();
    const toUtc = startOfNextLocalDayUtc(this.state().endDate, MANAGUA_ZONE).toISOString();

    this.patch({ status: 'loading', errorMessage: null });
    this.reportsService.cashiers(fromUtc, toUtc, this.state().userId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (report) => this.patch({ report }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyQuickRange(id: CashierQuickRange): void {
    const range = CASHIER_QUICK_RANGES.find((item) => item.id === id);
    if (!range) return;
    this.applyDateRange(range.start(), range.end());
  }

  applyDateRange(startDate?: string, endDate?: string): void {
    const nextStart = startDate ?? this.state().startDate;
    const nextEnd = endDate ?? this.state().endDate;
    if (nextStart > nextEnd) {
      this.patch({ errorMessage: 'El rango por fechas no puede terminar antes de empezar.' });
      return;
    }
    this.patch({ startDate: nextStart, endDate: nextEnd });
    this.load();
  }

  applyUser(userId: number | null): void {
    this.patch({ userId });
    this.load();
  }

  resetFilters(): void {
    this.patch({ userId: null, startDate: managuaMonthStart(), endDate: managuaDay() });
    this.load();
  }

  private patch(partial: Partial<CashierState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
