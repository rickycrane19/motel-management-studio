import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  SystemUser,
  SystemUserQuery,
  SystemUserStats,
  SystemUserUpsert,
} from '../../../core/models/security/user.model';
import { UserService } from '../../../core/services/security/user.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UsersState {
  readonly status: LoadStatus;
  readonly query: SystemUserQuery;
  readonly users: readonly SystemUser[];
  readonly totalRecords: number;
  readonly stats: SystemUserStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
}

const INITIAL_QUERY: SystemUserQuery = { pageNumber: 1, pageSize: 10, search: '', role: null };

const INITIAL_STATS: SystemUserStats = { total: 0, active: 0, roles: 0 };

/** Store del listado de usuarios del sistema, paginado en el servidor. */
@Injectable()
export class UsersStore {
  private readonly usersService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<UsersState>({
    status: 'idle',
    query: INITIAL_QUERY,
    users: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly users = computed(() => this.state().users);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.role ? 1 : 0);
  });

  load(partialQuery: Partial<SystemUserQuery> = {}): void {
    const query: SystemUserQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.usersService.list(query),
      stats: this.usersService.stats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({ users: page.items, totalRecords: page.totalRecords, stats }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<SystemUserQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', role: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  save(user: SystemUserUpsert, userId: number | null): Observable<boolean> {
    this.patch({ saving: true, errorMessage: null });
    const request$ = userId === null
      ? this.usersService.create(user).pipe(map(() => undefined))
      : this.usersService.update(userId, user);
    return request$.pipe(
      finalize(() => this.patch({ saving: false })),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  setActive(user: SystemUser, isActive: boolean): Observable<boolean> {
    this.patch({ errorMessage: null });
    return this.usersService.setActive(user.userId, isActive).pipe(
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  private patch(partial: Partial<UsersState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
