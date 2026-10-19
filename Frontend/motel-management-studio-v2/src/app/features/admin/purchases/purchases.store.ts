import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { Purchase, PurchaseQuery, PurchaseStats } from '../../../core/models/inventory/purchase.model';
import { PurchaseService } from '../../../core/services/inventory/purchase.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PurchasesState {
  readonly status: LoadStatus;
  readonly query: PurchaseQuery;
  readonly purchases: readonly Purchase[];
  readonly totalRecords: number;
  readonly stats: PurchaseStats;
  readonly errorMessage: string | null;
}

function dayOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const INITIAL_QUERY: PurchaseQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  purchaseType: null,
  startDate: dayOffset(-7),
  endDate: dayOffset(0),
};

const INITIAL_STATS: PurchaseStats = { documents: 0, boughtAmount: 0, returnedAmount: 0 };

/**
 * Estado del histórico de compras. La ventana, la búsqueda, el tipo y el rango de
 * fechas los resuelve el SP; aquí solo se guardan las filas y los contadores.
 */
@Injectable()
export class PurchasesStore {
  private readonly purchasesService = inject(PurchaseService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<PurchasesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    purchases: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly purchases = computed(() => this.state().purchases);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.purchaseType !== null ? 1 : 0)
      + (query.startDate !== INITIAL_QUERY.startDate ? 1 : 0) + (query.endDate !== INITIAL_QUERY.endDate ? 1 : 0);
  });

  load(partialQuery: Partial<PurchaseQuery> = {}): void {
    const query: PurchaseQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    this.purchasesService
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({
          purchases: page.items,
          totalRecords: page.totalRecords,
          stats: page.stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<PurchaseQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', purchaseType: null, startDate: INITIAL_QUERY.startDate, endDate: INITIAL_QUERY.endDate, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  invalidate(): void {
    this.purchasesService.invalidateCache();
  }

  private patch(partial: Partial<PurchasesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
