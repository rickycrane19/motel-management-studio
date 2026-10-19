import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { FineType, FineTypeQuery, FineTypeStats, FineTypeUpsert } from '../../../core/models/service/catalog.model';
import { CatalogService } from '../../../core/services/service/catalog.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FineTypesState {
  readonly status: LoadStatus;
  readonly query: FineTypeQuery;
  readonly fineTypes: readonly FineType[];
  readonly totalRecords: number;
  readonly stats: FineTypeStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly busyFineTypeId: number | null;
}

const INITIAL_QUERY: FineTypeQuery = {
  pageNumber: 1,
  pageSize: 10,
  name: '',
  isActive: null,
};

const INITIAL_STATS: FineTypeStats = { total: 0, active: 0, inactive: 0, averageAmount: 0 };

@Injectable()
export class FineTypesStore {
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<FineTypesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    fineTypes: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
    busyFineTypeId: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly fineTypes = computed(() => this.state().fineTypes);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly busyFineTypeId = computed(() => this.state().busyFineTypeId);

  load(partialQuery: Partial<FineTypeQuery> = {}): void {
    const query: FineTypeQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.catalogService.listFineTypes(query),
      stats: this.catalogService.fineTypesStats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({ fineTypes: page.items, totalRecords: page.totalRecords, stats }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<FineTypeQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ name: '', isActive: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  setActive(fineType: FineType, isActive: boolean): Observable<boolean> {
    this.patch({ busyFineTypeId: fineType.fineTypeId, errorMessage: null });
    return this.catalogService.setFineTypeActive(fineType.fineTypeId, isActive).pipe(
      finalize(() => {
        this.catalogService.invalidateCache();
        this.patch({ busyFineTypeId: null });
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  save(fineType: FineTypeUpsert): Observable<unknown> {
    this.patch({ saving: true, errorMessage: null });
    const request: Observable<unknown> = fineType.id !== null && fineType.id !== undefined
      ? this.catalogService.updateFineType({ ...fineType, id: fineType.id })
      : this.catalogService.createFineType(fineType);
    return request.pipe(
      finalize(() => this.onSaveFinished()),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        throw error;
      }),
    );
  }

  private onSaveFinished(): void {
    this.catalogService.invalidateCache();
    this.patch({ saving: false });
  }

  private patch(partial: Partial<FineTypesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
