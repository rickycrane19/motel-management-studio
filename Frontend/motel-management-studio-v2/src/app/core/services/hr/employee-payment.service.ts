import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  EmployeePayment,
  EmployeePaymentPage,
  EmployeePaymentUpsert,
} from '../../models/hr/employee-payment.model';

/**
 * Servicio de pagos a empleados de El Rapidin contra el backend del motel.
 * El historial lo pagina el SP: el cliente pide la ventana y recibe el total.
 */
@Injectable({ providedIn: 'root' })
export class EmployeePaymentService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/hr/payments`;

  /** Historial de pagos, filtrado por empleado y paginado en el servidor. */
  list(employeeId: number | null = null, page = 1, pageSize = 20): Observable<EmployeePaymentPage> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (employeeId) params = params.set('employeeId', String(employeeId));
    return this.http.get<EmployeePaymentPage>(this.endpoint, { params });
  }

  /**
   * Registra el pago (periodo, modalidad, unidades, tarifa, bonos y deducciones detalladas).
   * Cuando va `cashBoxSessionId`, el backend descuenta de esa caja el **neto** a pagar y
   * deja el egreso 'Pago de nómina: <Nombre> (<modalidad> <unidades>)' en el arqueo.
   */
  create(payment: EmployeePaymentUpsert): Observable<number> {
    return this.http.post<number>(this.endpoint, {
      employeeId: payment.employeeId,
      paymentType: payment.paymentType,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      unitsWorked: payment.unitsWorked,
      rateApplied: payment.rateApplied,
      bonusAmount: payment.bonusAmount,
      deductionsAmount: payment.deductionsAmount,
      currencyCode: payment.currencyCode,
      isExtraShift: payment.isExtraShift,
      deductions: payment.deductions.map((deduction) => ({
        type: deduction.type,
        description: deduction.description?.trim() || null,
        amount: deduction.amount,
      })),
      cashBoxSessionId: payment.cashBoxSessionId ?? null,
      notes: payment.notes?.trim() || null,
    });
  }
}
