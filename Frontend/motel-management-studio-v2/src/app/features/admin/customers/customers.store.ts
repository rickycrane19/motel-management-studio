import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  Customer,
  CustomerQuery,
  CustomerStats,
  CustomerUpsert,
} from '../../../core/models/service/customer.model';
import { CustomerService } from '../../../core/services/service/customer.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CustomersState {
  readonly status: LoadStatus;
  readonly query: CustomerQuery;
  readonly customers: readonly Customer[];
  readonly totalRecords: number;
  readonly stats: CustomerStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
}

const INITIAL_QUERY: CustomerQuery = { pageNumber: 1, pageSize: 10, search: '', onlyActive: null };
const INITIAL_STATS: CustomerStats = { total: 0, active: 0, withContact: 0 };

/** Estado del listado de clientes, paginado y contado por el SP. */
@Injectable()
export class CustomersStore {
  private readonly service = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<CustomersState>({
    status: 'idle',
    query: INITIAL_QUERY,
    customers: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly customers = computed(() => this.state().customers);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.onlyActive !== null ? 1 : 0);
  });

  load(partialQuery: Partial<CustomerQuery> = {}): void {
    const query: CustomerQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.service.list(query),
      stats: this.service.stats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({ customers: page.items, totalRecords: page.totalRecords, stats }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<CustomerQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', onlyActive: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  save(customer: CustomerUpsert, customerId: number | null): Observable<boolean> {
    this.patch({ saving: true, errorMessage: null });
    const request$ = customerId === null
      ? this.service.create(customer).pipe(map(() => undefined))
      : this.service.update(customerId, customer);
    return request$.pipe(
      finalize(() => this.patch({ saving: false })),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  setActive(customer: Customer, isActive: boolean): Observable<boolean> {
    this.patch({ errorMessage: null });
    return this.service.setActive(customer.customerId, isActive).pipe(
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  private patch(partial: Partial<CustomersState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
