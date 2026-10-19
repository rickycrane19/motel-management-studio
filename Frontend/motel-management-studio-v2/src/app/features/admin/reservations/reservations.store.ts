import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, Observable, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  RoomReservation,
  RoomReservationQuery,
  RoomReservationStats,
  RoomReservationUpsert,
} from '../../../core/models/service/reservation.model';
import { ReservationService } from '../../../core/services/service/reservation.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ReservationsState {
  readonly status: LoadStatus;
  readonly query: RoomReservationQuery;
  readonly reservations: readonly RoomReservation[];
  readonly totalRecords: number;
  readonly stats: RoomReservationStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
}

const INITIAL_QUERY: RoomReservationQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  status: null,
  fromDate: null,
  toDate: null,
};

const INITIAL_STATS: RoomReservationStats = { confirmed: 0, today: 0, cancelled: 0, noShow: 0 };

/** Estado del listado de reservaciones, paginado y contado por el SP. */
@Injectable()
export class ReservationsStore {
  private readonly service = inject(ReservationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ReservationsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    reservations: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly reservations = computed(() => this.state().reservations);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.status !== null ? 1 : 0) + (query.fromDate ? 1 : 0) + (query.toDate ? 1 : 0);
  });

  load(partialQuery: Partial<RoomReservationQuery> = {}): void {
    const query: RoomReservationQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    this.service
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({
          reservations: page.items,
          totalRecords: page.totalRecords,
          stats: page.stats ?? INITIAL_STATS,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<RoomReservationQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ search: '', status: null, fromDate: null, toDate: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  create(reservation: RoomReservationUpsert): Observable<boolean> {
    this.patch({ saving: true, errorMessage: null });
    return this.service.create(reservation).pipe(
      finalize(() => this.patch({ saving: false })),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  setStatus(reservation: RoomReservation, status: number): Observable<boolean> {
    this.patch({ errorMessage: null });
    return this.service.setStatus(reservation.reservationId, status).pipe(
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  private patch(partial: Partial<ReservationsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
