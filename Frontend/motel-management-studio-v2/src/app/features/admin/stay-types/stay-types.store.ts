import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { ServiceStayType, ServiceStayTypeQuery, ServiceStayTypeStats, ServiceStayTypeUpsert } from '../../../core/models/service/catalog.model';
import { CatalogService } from '../../../core/services/service/catalog.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface StayTypesState {
  readonly status: LoadStatus;
  readonly query: ServiceStayTypeQuery;
  readonly stayTypes: readonly ServiceStayType[];
  readonly totalRecords: number;
  readonly stats: ServiceStayTypeStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly busyStayTypeId: number | null;
}

const INITIAL_QUERY: ServiceStayTypeQuery = {
  pageNumber: 1,
  pageSize: 10,
  name: '',
  isActive: null,
  isExtension: null,
};

const INITIAL_STATS: ServiceStayTypeStats = { total: 0, active: 0, inactive: 0, extensions: 0 };

@Injectable()
export class StayTypesStore {
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<StayTypesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    stayTypes: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
    busyStayTypeId: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly stayTypes = computed(() => this.state().stayTypes);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly busyStayTypeId = computed(() => this.state().busyStayTypeId);

  load(partialQuery: Partial<ServiceStayTypeQuery> = {}): void {
    const query: ServiceStayTypeQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.catalogService.listStayTypes(query),
      stats: this.catalogService.stayTypesStats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({ stayTypes: page.items, totalRecords: page.totalRecords, stats }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<ServiceStayTypeQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ name: '', isActive: null, isExtension: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  setActive(stayType: ServiceStayType, isActive: boolean): Observable<boolean> {
    this.patch({ busyStayTypeId: stayType.serviceStayTypeId, errorMessage: null });
    return this.catalogService.setStayTypeActive(stayType.serviceStayTypeId, isActive).pipe(
      finalize(() => {
        this.catalogService.invalidateCache();
        this.patch({ busyStayTypeId: null });
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  save(stayType: ServiceStayTypeUpsert): Observable<unknown> {
    this.patch({ saving: true, errorMessage: null });
    const request: Observable<unknown> = stayType.id !== null && stayType.id !== undefined
      ? this.catalogService.updateStayType({ ...stayType, id: stayType.id })
      : this.catalogService.createStayType(stayType);
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

  private patch(partial: Partial<StayTypesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
