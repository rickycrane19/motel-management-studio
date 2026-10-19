import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  FinancialSummaryReport,
  InventoryReport,
  PayrollExpenseReport,
  ProductSalesReport,
  ServiceSalesReport,
} from '../../../core/models/finance/finance-reports.model';
import { FinanceReportsService } from '../../../core/services/finance/reports.service';
import { startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../../core/time/location-date';

export type ReportTab = 'summary' | 'service' | 'products' | 'inventory' | 'payroll';
export type ReportQuickRange = 'today' | 'week' | 'last30' | 'currentMonth';

/** Unión de las respuestas de los cinco reportes (todos traen el rango efectivo from/to). */
export type ReportPayload =
  | FinancialSummaryReport
  | ServiceSalesReport
  | ProductSalesReport
  | InventoryReport
  | PayrollExpenseReport;

/** Día del negocio (America/Managua) con desplazamiento de días; nunca el día UTC. */
export function managuaDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** Primer día del mes en curso del negocio en Managua. */
export function managuaMonthStart(): string {
  return `${managuaDay().slice(0, 7)}-01`;
}

export interface QuickRange {
  readonly id: ReportQuickRange;
  readonly label: string;
  readonly start: () => string;
  readonly end: () => string;
  readonly hint: string;
}

const MANAGUA_ZONE = 'America/Managua';

export const QUICK_RANGES: readonly QuickRange[] = [
  { id: 'today', label: 'Hoy', start: () => managuaDay(), end: () => managuaDay(), hint: 'El día del negocio en Managua' },
  { id: 'week', label: '7 días', start: () => managuaDay(-6), end: () => managuaDay(), hint: 'Semana móvil' },
  { id: 'last30', label: '30 días', start: () => managuaDay(-29), end: () => managuaDay(), hint: 'Últimos 30 días' },
  { id: 'currentMonth', label: 'Mes', start: () => managuaMonthStart(), end: () => managuaDay(), hint: 'Mes actual del negocio' },
];

export const REPORT_QUICK_RANGE_IDS: readonly ReportQuickRange[] = QUICK_RANGES.map((range) => range.id);

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ReportsState {
  readonly status: LoadStatus;
  readonly tab: ReportTab;
  readonly startDate: string;
  readonly endDate: string;
  readonly summary: FinancialSummaryReport | null;
  readonly serviceSales: ServiceSalesReport | null;
  readonly productSales: ProductSalesReport | null;
  readonly inventory: InventoryReport | null;
  readonly payroll: PayrollExpenseReport | null;
  readonly errorMessage: string | null;
}

@Injectable()
export class ReportsStore {
  private readonly reportsService = inject(FinanceReportsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ReportsState>({
    status: 'idle',
    tab: 'summary',
    startDate: managuaMonthStart(),
    endDate: managuaDay(),
    summary: null,
    serviceSales: null,
    productSales: null,
    inventory: null,
    payroll: null,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly tab = computed(() => this.state().tab);
  readonly startDate = computed(() => this.state().startDate);
  readonly endDate = computed(() => this.state().endDate);
  readonly summary = computed(() => this.state().summary);
  readonly serviceSales = computed(() => this.state().serviceSales);
  readonly productSales = computed(() => this.state().productSales);
  readonly inventory = computed(() => this.state().inventory);
  readonly payroll = computed(() => this.state().payroll);
  readonly errorMessage = computed(() => this.state().errorMessage);

  /** Siempre se informa el rango del período (con defaults del mes en Managua). */
  readonly appliedRangeLabel = computed(() => `${this.state().startDate} al ${this.state().endDate}`);

  /** Filtros activos (trailing-mount: rango distinto del inicial del mes). */
  readonly activeFilterCount = computed(() => {
    const state = this.state();
    return (state.startDate !== managuaMonthStart() ? 1 : 0) + (state.endDate !== managuaDay() ? 1 : 0);
  });

  setTab(tab: ReportTab): void {
    this.patch({ tab });
    this.loadForTab(tab);
  }

  /** Rango rápido por id (hoy/semana/30 días/mes actual en Managua). */
  applyQuickRange(id: ReportQuickRange): void {
    const range = QUICK_RANGES.find((item) => item.id === id);
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
    this.loadForTab(this.state().tab);
  }

  resetFilters(): void {
    this.applyDateRange(managuaMonthStart(), managuaDay());
  }

  private loadForTab(tab: ReportTab): void {
    // Los días elegidos son días del negocio (Managua): [inicio del día, inicio del día siguiente).
    const fromUtc = startOfLocalDayUtc(this.state().startDate, MANAGUA_ZONE).toISOString();
    const toUtc = startOfNextLocalDayUtc(this.state().endDate, MANAGUA_ZONE).toISOString();

    this.patch({ status: 'loading', errorMessage: null });

    const source$: Observable<ReportPayload> = {
      summary: () => this.reportsService.summary(fromUtc, toUtc),
      service: () => this.reportsService.serviceSales(fromUtc, toUtc),
      products: () => this.reportsService.productSales(fromUtc, toUtc),
      inventory: () => this.reportsService.inventory(fromUtc, toUtc),
      payroll: () => this.reportsService.payroll(fromUtc, toUtc),
    }[tab]();

    source$
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (report) => {
          switch (tab) {
            case 'summary': this.patch({ summary: report as FinancialSummaryReport }); break;
            case 'service': this.patch({ serviceSales: report as ServiceSalesReport }); break;
            case 'products': this.patch({ productSales: report as ProductSalesReport }); break;
            case 'inventory': this.patch({ inventory: report as InventoryReport }); break;
            case 'payroll': this.patch({ payroll: report as PayrollExpenseReport }); break;
          }
        },
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  private patch(partial: Partial<ReportsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
