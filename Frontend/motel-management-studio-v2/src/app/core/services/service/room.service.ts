import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, shareReplay } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  Room,
  RoomPage,
  RoomQuery,
  RoomStats,
  ROOM_STATUS_CODES,
  RoomUpsert,
} from '../../models/service/room.model';

export interface RoomType {
  roomTypeId: number;
  name: string;
  description: string | null;
  basePrice: number;
  hasGarage: boolean;
  hasJacuzzi: boolean;
  capacity: number;
  isActive: boolean;
}

/** Código de estado físico del cuarto para el SP (0 disponible … 3 mantenimiento). */
const STATUS_CODES: Readonly<Record<string, number>> = {
  available: 0,
  occupied: 1,
  cleaning: 2,
  maintenance: 3,
};

/**
 * Servicio de habitaciones de El Rapidin.
 *
 * El listado lo pagina el SP: la búsqueda, el tipo, el piso, el estado y la
 * página viajan al servidor. Los contadores y los pisos se calculan sobre una
 * ventana amplia (200) para no traer el catálogo completo en cada cambio.
 */
@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/service`;
  private roomsCache: Room[] | null = null;

  list(query: RoomQuery): Observable<RoomPage> {
    let params = new HttpParams()
      .set('includeInactive', 'true')
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.roomTypeId !== null) params = params.set('roomTypeId', String(query.roomTypeId));
    if (query.floor !== null) params = params.set('floor', String(query.floor));
    if (STATUS_CODES[query.physicalStatus] !== undefined) {
      params = params.set('status', String(STATUS_CODES[query.physicalStatus]));
    }
    if (query.activity !== 'all') params = params.set('onlyActive', String(query.activity === 'active'));

    return this.http.get<RoomPage>(`${this.endpoint}/rooms`, { params });
  }

  stats(): Observable<RoomStats> {
    // El SP devuelve los contadores en la misma página; basta pedir una fila.
    return this.http
      .get<RoomPage>(`${this.endpoint}/rooms`, {
        params: { includeInactive: 'true', page: '1', pageSize: '1' },
      })
      .pipe(map((page) => {
        const stats = page.stats ?? { active: 0, inactive: 0, available: 0, occupied: 0 };
        return {
          total: stats.active + stats.inactive,
          active: stats.active,
          inactive: stats.inactive,
          available: stats.available,
          occupied: stats.occupied,
        };
      }));
  }

  getById(roomId: number): Observable<Room | null> {
    return this.fetchRooms().pipe(
      map((rooms) => rooms.find((room) => room.roomId === roomId) ?? null),
    );
  }

  create(room: RoomUpsert): Observable<number> {
    return this.http.post<number>(`${this.endpoint}/rooms`, this.toBody(room));
  }

  update(room: RoomUpsert & { readonly id: number }): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/rooms/${room.id}`, this.toBody(room));
  }

  setActive(roomId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/rooms/${roomId}/set-active`, { roomId, isActive });
  }

  listRoomTypes(): Observable<readonly RoomType[]> {
    return this.http
      .get<{ items: RoomType[] }>(`${this.endpoint}/room-types`, {
        params: { onlyActive: 'true', page: '1', pageSize: '200' },
      })
      .pipe(map((page) => (page.items ?? []).filter((type) => type.isActive)));
  }

  listFloors(): Observable<readonly number[]> {
    return this.fetchRooms().pipe(
      map((rooms) => [...new Set(rooms.map((room) => room.floorNumber))].sort((a, b) => a - b)),
    );
  }

  /** Ventana amplia (máximo del SP) para contadores, pisos y la ficha puntual. */
  private fetchRooms(): Observable<Room[]> {
    if (this.roomsCache) return of(this.roomsCache);
    return this.http
      .get<{ items: Room[] }>(`${this.endpoint}/rooms`, {
        params: { includeInactive: 'true', page: '1', pageSize: '200' },
      })
      .pipe(
        map((page) => (this.roomsCache = (page.items ?? []).map((room) => ({
          ...room,
          statusName: room.statusName || ROOM_STATUS_CODES[room.statusCode] || 'Desconocido',
        })))),
        shareReplay(1),
      );
  }

  invalidateCache(): void {
    this.roomsCache = null;
  }

  private toBody(room: RoomUpsert) {
    return {
      roomNumber: room.roomNumber.trim(),
      roomTypeId: room.roomTypeId,
      floorNumber: room.floorNumber,
      notes: room.notes?.trim() || null,
    };
  }
}
