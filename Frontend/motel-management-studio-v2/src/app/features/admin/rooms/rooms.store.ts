import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { Room, RoomQuery, RoomStats, RoomUpsert } from '../../../core/models/service/room.model';
import { RoomService } from '../../../core/services/service/room.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface RoomsState {
  readonly status: LoadStatus;
  readonly query: RoomQuery;
  readonly rooms: readonly Room[];
  readonly totalRecords: number;
  readonly stats: RoomStats;
  readonly floors: readonly number[];
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly busyRoomId: number | null;
}

const INITIAL_QUERY: RoomQuery = {
  pageNumber: 1,
  pageSize: 10,
  search: '',
  roomTypeId: null,
  floor: null,
  physicalStatus: 'all',
  activity: 'all',
};

const INITIAL_STATS: RoomStats = { total: 0, active: 0, inactive: 0, available: 0, occupied: 0 };

@Injectable()
export class RoomsStore {
  private readonly roomsService = inject(RoomService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<RoomsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    rooms: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    floors: [],
    errorMessage: null,
    saving: false,
    busyRoomId: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly rooms = computed(() => this.state().rooms);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly floors = computed(() => this.state().floors);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly busyRoomId = computed(() => this.state().busyRoomId);

  load(partialQuery: Partial<RoomQuery> = {}): void {
    const query: RoomQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.roomsService.list(query),
      stats: this.roomsService.stats(),
      floors: this.roomsService.listFloors(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats, floors }) => this.patch({
          rooms: page.items,
          totalRecords: page.totalRecords,
          stats,
          floors,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<RoomQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({
      search: '', roomTypeId: null, floor: null, physicalStatus: 'all', activity: 'all', pageNumber: 1,
    });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  setActive(room: Room, isActive: boolean): Observable<boolean> {
    this.patch({ busyRoomId: room.roomId, errorMessage: null });
    return this.roomsService.setActive(room.roomId, isActive).pipe(
      finalize(() => {
        this.roomsService.invalidateCache();
        this.patch({ busyRoomId: null });
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  save(room: RoomUpsert): Observable<unknown> {
    this.patch({ saving: true, errorMessage: null });
    const request: Observable<unknown> = room.id !== null
      ? this.roomsService.update(room as RoomUpsert & { readonly id: number })
      : this.roomsService.create(room);
    return request.pipe(
      finalize(() => this.onSaveFinished()),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        throw error;
      }),
    );
  }

  private onSaveFinished(): void {
    this.roomsService.invalidateCache();
    this.patch({ saving: false });
  }

  private patch(partial: Partial<RoomsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
