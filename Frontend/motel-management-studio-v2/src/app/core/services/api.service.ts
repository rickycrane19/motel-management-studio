import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  RoomItem,
  RoomStayDetail,
  ProductItem,
  CategoryItem,
  ServiceStayTypeItem,
  FineTypeItem,
  DenominationItem,
  CashSessionSummary
} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ── Habitaciones ─────────────────────────────────────────────────────────────
  getRooms(): Observable<RoomItem[]> {
    // El SP pagina en servidor: el POS pide una ventana amplia y se queda con las filas.
    return this.http
      .get<{ items: RoomItem[] }>(`${this.baseUrl}/api/service/rooms?page=1&pageSize=200`)
      .pipe(map((page) => page.items ?? []));
  }

  setCleaningFinished(roomId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/rooms/${roomId}/cleaning-finished`, {});
  }

  // ── Estancias / Servicios ───────────────────────────────────────────────────
  startRoomStay(data: {
    roomId: number;
    customerId?: number | null;
    customerName?: string;
    arrivalType: number; // 1 = A pie, 2 = En vehiculo
    vehiclePlate?: string;
    serviceStayTypeId: number;
    notes?: string;
  }): Observable<{ value: number }> {
    return this.http.post<{ value: number }>(`${this.baseUrl}/api/service/stays`, data);
  }

  getRoomStayDetail(roomStayId: number): Observable<RoomStayDetail> {
    return this.http.get<RoomStayDetail>(`${this.baseUrl}/api/service/stays/${roomStayId}`);
  }

  extendRoomStay(roomStayId: number, serviceStayTypeId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/${roomStayId}/extend`, { serviceStayTypeId });
  }

  addStayConsumption(roomStayId: number, data: { productId: number; quantity: number; notes?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/${roomStayId}/consumptions`, data);
  }

  addStayFine(roomStayId: number, data: { fineTypeId?: number | null; description: string; amount: number; currencyCode: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/${roomStayId}/fines`, data);
  }

  waiveStayFine(fineId: number, waivedReason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/fines/${fineId}/waive`, { waivedReason });
  }

  checkoutRoomStay(roomStayId: number, data: { paidAmount: number; paymentMethod: string; cashBoxSessionId?: number | null; notes?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/service/stays/${roomStayId}/checkout`, data);
  }

  // ── Catálogos de Servicio ───────────────────────────────────────────────────
  getStayTypes(): Observable<ServiceStayTypeItem[]> {
    return this.http
      .get<{ items: ServiceStayTypeItem[] }>(`${this.baseUrl}/api/service/stay-types?page=1&pageSize=200`)
      .pipe(map((page) => page.items ?? []));
  }

  getFineTypes(): Observable<FineTypeItem[]> {
    return this.http
      .get<{ items: FineTypeItem[] }>(`${this.baseUrl}/api/service/fine-types?page=1&pageSize=200`)
      .pipe(map((page) => page.items ?? []));
  }

  // ── Inventario y Kardex ─────────────────────────────────────────────────────
  getProducts(): Observable<ProductItem[]> {
    return this.http
      .get<{ items: ProductItem[] }>(`${this.baseUrl}/api/inventory/products?page=1&pageSize=200`)
      .pipe(map((page) => page.items ?? []));
  }

  getCategories(): Observable<CategoryItem[]> {
    return this.http
      .get<{ items: CategoryItem[] }>(`${this.baseUrl}/api/inventory/categories?page=1&pageSize=200`)
      .pipe(map((page) => page.items ?? []));
  }

  recordInventoryMovement(data: {
    productId: number;
    movementType: string;
    quantity: number;
    unitCost?: number | null;
    reason?: string;
    referenceDoc?: string;
  }): Observable<{ value: number }> {
    return this.http.post<{ value: number }>(`${this.baseUrl}/api/inventory/movements`, data);
  }

  // ── Finanzas y Cajas ────────────────────────────────────────────────────────
  getCashBoxes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/finance/cashboxes`);
  }

  getDenominations(): Observable<DenominationItem[]> {
    return this.http.get<DenominationItem[]>(`${this.baseUrl}/api/finance/denominations`);
  }

  getActiveCashSession(cashBoxId?: number): Observable<CashSessionSummary | null> {
    const params: any = {};
    if (cashBoxId) params.cashBoxId = cashBoxId;
    return this.http.get<CashSessionSummary | null>(`${this.baseUrl}/api/finance/sessions/active`, { params });
  }

  getCashSessionSummary(sessionId: number): Observable<CashSessionSummary> {
    return this.http.get<CashSessionSummary>(`${this.baseUrl}/api/finance/sessions/${sessionId}/summary`);
  }

  openCashSession(data: { cashBoxId: number; shiftName: string; openingBalanceBase: number; notes?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/finance/sessions/open`, data);
  }

  closeCashSession(sessionId: number, data: { closingActualBase: number; notes?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/finance/sessions/${sessionId}/close`, data);
  }

  addCashAdjustment(sessionId: number, data: { adjustmentType: string; currencyCode: string; amount: number; reason: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/finance/sessions/${sessionId}/adjustments`, data);
  }

  saveCashBoxCount(sessionId: number, data: { countTypeId: number; denominationId: number; count: number }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/finance/sessions/${sessionId}/counts`, data);
  }
}
