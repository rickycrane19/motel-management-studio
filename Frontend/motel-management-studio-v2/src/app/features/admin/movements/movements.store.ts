import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, finalize } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { InventoryMovement, InventoryMovementQuery, InventoryMovementStats } from '../../../core/models/inventory/movement.model';
import { MovementService } from '../../../core/services/inventory/movement.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MovementsState {
  readonly status: LoadStatus;
  readonly query: InventoryMovementQuery;
  readonly movements: readonly InventoryMovement[];
  readonly totalRecords: number;
  readonly stats: InventoryMovementStats;
  readonly errorMessage: string | null;
}

function dayOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const INITIAL_QUERY: InventoryMovementQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  movementType: null,
  productId: null,
  startDate: dayOffset(-7),
  endDate: dayOffset(0),
};

const INITIAL_STATS: InventoryMovementStats = { total: 0, entries: 0, exits: 0 };

@Injectable()
export class MovementsStore {
  private readonly movementsService = inject(MovementService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<MovementsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    movements: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly movements = computed(() => this.state().movements);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.movementType !== null ? 1 : 0) + (query.productId !== null ? 1 : 0)
      + (query.startDate !== INITIAL_QUERY.startDate ? 1 : 0) + (query.endDate !== INITIAL_QUERY.endDate ? 1 : 0);
  });

  load(partialQuery: Partial<InventoryMovementQuery> = {}): void {
    const query: InventoryMovementQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.movementsService.list(query),
      stats: this.movementsService.stats({ startDate: query.startDate, endDate: query.endDate }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({
          movements: page.items,
          totalRecords: page.totalRecords,
          query: { ...query, pageNumber: page.page, pageSize: page.pageSize },
          stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<InventoryMovementQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', movementType: null, productId: null, startDate: INITIAL_QUERY.startDate, endDate: INITIAL_QUERY.endDate, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  private patch(partial: Partial<MovementsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
