import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { Employee, EmployeeQuery, EmployeeStats, EmployeeUpsert } from '../../../core/models/hr/employee.model';
import { EmployeeService } from '../../../core/services/hr/employee.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EmployeesState {
  readonly status: LoadStatus;
  readonly query: EmployeeQuery;
  readonly employees: readonly Employee[];
  readonly totalRecords: number;
  readonly stats: EmployeeStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
}

const INITIAL_QUERY: EmployeeQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  paymentType: null,
  isActive: null,
};

const INITIAL_STATS: EmployeeStats = { total: 0, active: 0, inactive: 0 };

@Injectable()
export class EmployeesStore {
  private readonly employeesService = inject(EmployeeService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<EmployeesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    employees: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly employees = computed(() => this.state().employees);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.paymentType !== null ? 1 : 0) + (query.isActive !== null ? 1 : 0);
  });

  load(partialQuery: Partial<EmployeeQuery> = {}): void {
    const query: EmployeeQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.employeesService.list(query),
      stats: this.employeesService.stats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({ employees: page.items, totalRecords: page.totalRecords, stats }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<EmployeeQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', paymentType: null, isActive: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  /** Guardar desde la ficha del drawer u otro sitio central conserva el cache del directorio al día. */
  save(employee: EmployeeUpsert | (EmployeeUpsert & { readonly employeeId: number })): Observable<boolean> {
    this.patch({ saving: true, errorMessage: null });
    const request$ = 'employeeId' in employee
      ? this.employeesService.update(employee)
      : this.employeesService.create(employee).pipe(map(() => undefined));
    return request$.pipe(
      finalize(() => {
        this.employeesService.invalidateCache();
        this.patch({ saving: false });
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  private patch(partial: Partial<EmployeesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
