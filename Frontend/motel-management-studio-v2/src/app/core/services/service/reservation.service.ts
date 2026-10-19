import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  RoomReservationPage,
  RoomReservationQuery,
  RoomReservationUpsert,
} from '../../models/service/reservation.model';

/** Día siguiente a una clave AAAA-MM-DD, sin depender de la zona del navegador. */
function nextDayKey(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Inicio del día en Managua (UTC-6, sin horario de verano) a ISO UTC. */
function managuaStartOfDay(key: string): string {
  return new Date(`${key}T00:00:00-06:00`).toISOString();
}

/** Servicio de reservaciones: el SP pagina, filtra y devuelve los contadores. */
@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/service/reservations`;

  list(query: RoomReservationQuery): Observable<RoomReservationPage> {
    let params = new HttpParams()
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));

    const search = query.search.trim();
    if (search) params = params.set('search', search);
    if (query.status !== null) params = params.set('status', String(query.status));
    if (query.fromDate) params = params.set('from', managuaStartOfDay(query.fromDate));
    if (query.toDate) params = params.set('to', managuaStartOfDay(nextDayKey(query.toDate)));

    return this.http.get<RoomReservationPage>(this.endpoint, { params });
  }

  create(payload: RoomReservationUpsert): Observable<number> {
    return this.http.post<number>(this.endpoint, payload);
  }

  setStatus(reservationId: number, status: number): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/${reservationId}/status`, { status });
  }
}
