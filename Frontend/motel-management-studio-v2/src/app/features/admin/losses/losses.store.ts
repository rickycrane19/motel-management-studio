import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  FinancialLossDto,
  LOSS_CATEGORY_LABELS,
  LossCategoryCode,
} from '../../../core/models/finance/losses.model';
import { LossesService } from '../../../core/services/finance/reports.service';
import { startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../../core/time/location-date';

export type LossesLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LossesQuery {
  readonly startDate: string;
  readonly endDate: string;
  readonly category: LossCategoryCode | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface LossCategoryBreakdown {
  readonly code: LossCategoryCode;
  readonly label: string;
  readonly count: number;
  readonly amount: number;
}

export interface LossesStats {
  readonly count: number;
  readonly total: number;
  readonly byCategory: readonly LossCategoryBreakdown[];
  /** true cuando el rango completo cabe en lo cargado (los totales son del rango, no de la página). */
  readonly complete: boolean;
}

interface LossesState {
  readonly status: LossesLoadStatus;
  readonly query: LossesQuery;
  readonly items: readonly FinancialLossDto[];
  readonly totalRecords: number;
  readonly errorMessage: string | null;
}

const MANAGUA_ZONE = 'America/Managua';
export const LOSS_CATEGORIES: readonly LossCategoryCode[] = ['Habitacion', 'Minibar', 'Caja', 'Otro'];

export type LossQuickRangeId = 'today' | 'week' | 'last30' | 'currentMonth';

export interface QuickRange {
  readonly id: LossQuickRangeId;
  readonly label: string;
  readonly start: () => string;
  readonly end: () => string;
}

/** Rangos rápidos del día del negocio (America/Managua), como en Reportes. */
export const QUICK_LOSS_RANGES: readonly QuickRange[] = [
  { id: 'today', label: 'Hoy', start: () => managuaDay(), end: () => managuaDay() },
  { id: 'week', label: '7 días', start: () => managuaDay(-6), end: () => managuaDay() },
  { id: 'last30', label: '30 días', start: () => managuaDay(-29), end: () => managuaDay() },
  { id: 'currentMonth', label: 'Mes', start: () => managuaMonthStart(), end: () => managuaDay() },
];

/** Día del negocio (America/Managua) con desplazamiento de días; nunca el día UTC. */
function managuaDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANAGUA_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function managuaMonthStart(): string {
  return `${managuaDay().slice(0, 7)}-01`;
}

const INITIAL_QUERY: LossesQuery = {
  startDate: managuaMonthStart(),
  endDate: managuaDay(),
  category: null,
  page: 1,
  pageSize: 50,
};

@Injectable()
export class LossesStore {
  private readonly lossesService = inject(LossesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<LossesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    items: [],
    totalRecords: 0,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly items = computed(() => this.state().items);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly errorMessage = computed(() => this.state().errorMessage);

  /** Pérdidas del filtro. Con la primera página se muestran totales del rango hasta el tope pedido. */
  readonly stats = computed<LossesStats>(() => {
    const items = this.state().items;
    const byCategory = LOSS_CATEGORIES.map((code) => {
      const rows = items.filter((item) => item.categoryCode === code);
      return {
        code,
        label: LOSS_CATEGORY_LABELS[code],
        count: rows.length,
        amount: rows.reduce((sum, item) => sum + item.amountInBase, 0),
      };
    }).filter((entry) => entry.count > 0);

    return {
      count: items.length,
      total: items.reduce((sum, item) => sum + item.amountInBase, 0),
      byCategory,
      complete: items.length >= this.state().totalRecords,
    };
  });

  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.category !== null ? 1 : 0)
      + (query.startDate !== INITIAL_QUERY.startDate ? 1 : 0)
      + (query.endDate !== INITIAL_QUERY.endDate ? 1 : 0);
  });

  load(partialQuery: Partial<LossesQuery> = {}): void {
    const query: LossesQuery = { ...this.state().query, ...partialQuery };
    this.patch({ query, status: 'loading', errorMessage: null });

    // Los días elegidos son días del negocio (Managua): [inicio del día, inicio del día siguiente).
    const fromUtc = startOfLocalDayUtc(query.startDate, MANAGUA_ZONE).toISOString();
    const toUtc = startOfNextLocalDayUtc(query.endDate, MANAGUA_ZONE).toISOString();

    this.lossesService.list({
      fromUtc,
      toUtc,
      category: query.category,
      page: query.page,
      pageSize: query.pageSize,
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({
          items: page.items,
          totalRecords: page.totalRecords,
          query: { ...query, page: page.page, pageSize: page.pageSize },
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<LossesQuery>): void {
    this.load({ ...filters, page: 1 });
  }

  resetFilters(): void {
    this.load({ ...INITIAL_QUERY });
  }

  goToPage(page: number): void {
    if (page < 1) return;
    this.load({ page });
  }

  private patch(partial: Partial<LossesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
