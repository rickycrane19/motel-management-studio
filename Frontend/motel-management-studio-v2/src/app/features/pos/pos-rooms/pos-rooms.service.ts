import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CashSessionSummary,
  FineTypeItem,
  RoomItem,
  RoomStayDetail,
  ServiceStayTypeItem,
} from '../../../core/models/models';

/** Cuerpo del check-in «carrito de servicio al cuarto» del POS. */
export interface StartRoomStayRequest {
  roomId: number;
  /** Cliente opcional: `null` = llegada anónima. */
  customerName: string | null;
  /** 1 = A pie, 2 = En vehículo. */
  arrivalType: 1 | 2;
  vehiclePlate: string | null;
  serviceStayTypeId: number;
  notes: string | null;
  /** Sesión de caja activa para casar el check-in con la apertura del turno (null si no hay). */
  cashBoxSessionId: number | null;
}

export interface CheckoutRequest {
  paidAmount: number;
  paymentMethod: string;
  cashBoxSessionId: number | null;
}

/**
 * HTTP del POS de habitaciones (El Rapidin). Base URL de environment; el JWT
 * lo añade el interceptor. Evita depender de ApiService (usado por el dashboard
 * legacy) para tipar bien el check-in: el backend responde 201 con el número.
 */
@Injectable({ providedIn: 'root' })
export class PosRoomsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ── Habitaciones ────────────────────────────────────────────────────────────
  rooms(): Observable<RoomItem[]> {
    return this.http.get<RoomItem[]>(`${this.baseUrl}/api/service/rooms`);
  }

  finishCleaning(roomId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/rooms/${roomId}/cleaning-finished`, {});
  }

  // ── Estancia ────────────────────────────────────────────────────────────────
  stayDetail(roomStayId: number): Observable<RoomStayDetail> {
    return this.http.get<RoomStayDetail>(`${this.baseUrl}/api/service/stays/${roomStayId}`);
  }

  /** 201 Created con el `roomStayId` en el cuerpo. */
  startStay(request: StartRoomStayRequest): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/api/service/stays`, request);
  }

  /** 201: extiende la estancia usando el stayType/tarifario indicado. */
  extendStay(roomStayId: number, serviceStayTypeId: number): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/api/service/stays/${roomStayId}/extend`, { serviceStayTypeId });
  }

  checkout(roomStayId: number, request: CheckoutRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/${roomStayId}/checkout`, request);
  }

  // ── Multas ──────────────────────────────────────────────────────────────────
  stayFines(roomStayId: number): Observable<RoomStayDetail['fines']> {
    return this.http.get<RoomStayDetail['fines']>(`${this.baseUrl}/api/service/stays/${roomStayId}/fines`);
  }

  addFine(
    roomStayId: number,
    data: { fineTypeId: number | null; description: string; amount: number; currencyCode: string },
  ): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/api/service/stays/${roomStayId}/fines`, data);
  }

  waiveFine(fineId: number, waivedReason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/fines/${fineId}/waive`, { waivedReason });
  }

  // ── Catálogos y caja ────────────────────────────────────────────────────────
  stayTypes(): Observable<ServiceStayTypeItem[]> {
    return this.http.get<ServiceStayTypeItem[]>(`${this.baseUrl}/api/service/stay-types`);
  }

  fineTypes(): Observable<FineTypeItem[]> {
    return this.http.get<FineTypeItem[]>(`${this.baseUrl}/api/service/fine-types`);
  }

  activeCashSession(): Observable<CashSessionSummary | null> {
    return this.http.get<CashSessionSummary | null>(`${this.baseUrl}/api/finance/sessions/active`);
  }
}
