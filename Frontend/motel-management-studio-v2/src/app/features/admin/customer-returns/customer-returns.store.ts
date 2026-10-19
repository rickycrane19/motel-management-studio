import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { CustomerReturn, CustomerReturnQuery, CustomerReturnStats } from '../../../core/models/inventory/purchase.model';
import { CustomerReturnService } from '../../../core/services/inventory/customer-return.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CustomerReturnsState {
  readonly status: LoadStatus;
  readonly query: CustomerReturnQuery;
  readonly customerReturns: readonly CustomerReturn[];
  readonly totalRecords: number;
  readonly stats: CustomerReturnStats;
  readonly errorMessage: string | null;
}

function dayOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const INITIAL_QUERY: CustomerReturnQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  startDate: dayOffset(-7),
  endDate: dayOffset(0),
};

const INITIAL_STATS: CustomerReturnStats = { documents: 0, refundedAmount: 0 };

/**
 * Estado del histórico de devoluciones de cliente. La ventana, la búsqueda y el
 * rango de fechas los resuelve el SP; aquí solo se guardan las filas y contadores.
 */
@Injectable()
export class CustomerReturnsStore {
  private readonly customerReturnsService = inject(CustomerReturnService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<CustomerReturnsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    customerReturns: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly customerReturns = computed(() => this.state().customerReturns);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0)
      + (query.startDate !== INITIAL_QUERY.startDate ? 1 : 0) + (query.endDate !== INITIAL_QUERY.endDate ? 1 : 0);
  });

  load(partialQuery: Partial<CustomerReturnQuery> = {}): void {
    const query: CustomerReturnQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    this.customerReturnsService
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({
          customerReturns: page.items,
          totalRecords: page.totalRecords,
          stats: page.stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<CustomerReturnQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', startDate: INITIAL_QUERY.startDate, endDate: INITIAL_QUERY.endDate, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  invalidate(): void {
    this.customerReturnsService.invalidateCache();
  }

  private patch(partial: Partial<CustomerReturnsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
