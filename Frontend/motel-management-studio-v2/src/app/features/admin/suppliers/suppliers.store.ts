import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { Supplier, SupplierQuery, SupplierStats, SupplierUpsert } from '../../../core/models/inventory/supplier.model';
import { SupplierService } from '../../../core/services/inventory/supplier.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SuppliersState {
  readonly status: LoadStatus;
  readonly query: SupplierQuery;
  readonly suppliers: readonly Supplier[];
  readonly totalRecords: number;
  readonly stats: SupplierStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly busySupplierId: number | null;
}

const INITIAL_QUERY: SupplierQuery = {
  pageNumber: 1,
  pageSize: 10,
  search: '',
  isActive: null,
};

const INITIAL_STATS: SupplierStats = { total: 0, active: 0, withPurchases: 0 };

@Injectable()
export class SuppliersStore {
  private readonly suppliersService = inject(SupplierService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<SuppliersState>({
    status: 'idle',
    query: INITIAL_QUERY,
    suppliers: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
    busySupplierId: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly suppliers = computed(() => this.state().suppliers);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly busySupplierId = computed(() => this.state().busySupplierId);

  load(partialQuery: Partial<SupplierQuery> = {}): void {
    const query: SupplierQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.suppliersService.list(query),
      stats: this.suppliersService.stats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({
          suppliers: page.items,
          totalRecords: page.totalRecords,
          query: { ...query, pageNumber: page.page, pageSize: page.pageSize },
          stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<SupplierQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', isActive: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  setActive(supplier: Supplier, isActive: boolean): Observable<boolean> {
    this.patch({ busySupplierId: supplier.supplierId, errorMessage: null });
    return this.suppliersService.setActive(supplier.supplierId, isActive).pipe(
      finalize(() => this.patch({ busySupplierId: null })),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  save(supplier: SupplierUpsert): Observable<unknown> {
    this.patch({ saving: true, errorMessage: null });
    const request: Observable<unknown> = supplier.id !== null && supplier.id !== undefined
      ? this.suppliersService.update(supplier.id, supplier)
      : this.suppliersService.create(supplier);
    return request.pipe(
      finalize(() => this.patch({ saving: false })),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        throw error;
      }),
    );
  }

  private patch(partial: Partial<SuppliersState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
