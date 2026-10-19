import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, of, switchMap, Observable } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { NetworkStatusService } from '../../../core/browser/network-status.service';
import { describeApiError } from '../../../core/http/api-error';
import { CashBoxCountGroup, CashBoxCountRow, CashBoxMonitorRow, CashBoxSessionSummary, DenominationDto } from '../../../core/models/finance/cashbox-operations.model';
import { CashBoxOperationsService } from '../../../core/services/finance/cashbox-operations.service';
import { dateKeyInTimeZone, formatInstantInTimeZone } from '../../../core/time/location-date';
import { CazoIconComponent, ComboboxComponent, ComboboxOption } from '../../../shared/ui';
import { FormsModule } from '@angular/forms';

type CashBoxAction = 'open' | 'pre-count' | 'close' | 'adjust';

@Component({
  selector: 'rms-motel-cashbox-page',
  imports: [DecimalPipe, CazoIconComponent, ComboboxComponent, FormsModule],
  templateUrl: './cashbox-operations-page.component.html',
  styleUrl: './cashbox-operations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashboxOperationsPageComponent implements OnInit {
  protected readonly adjustmentTypeOptions = computed<readonly ComboboxOption<string>[]>(() => [
    { value: '', label: 'Selecciona el tipo' },
    { value: 'IN', label: 'Entrada de dinero (IN)' },
    { value: 'OUT', label: 'Salida/Gasto (OUT)' },
  ]);
  /** Clasificación del ajuste: separa propinas y comisiones del resto en el reporte de cajeros. */
  protected readonly adjustmentSourceOptions = computed<readonly ComboboxOption<string>[]>(() => [
    { value: 'AjusteManual', label: 'Ajuste manual' },
    { value: 'Propina', label: 'Propina del cliente' },
    { value: 'Comision', label: 'Comisión a pagar' },
    { value: 'Otro', label: 'Otro' },
  ]);
  protected readonly currencyOptions = computed<readonly ComboboxOption<string>[]>(() =>
    this.currencyCodes().map((code) => ({ value: code, label: code })));
  private readonly service = inject(CashBoxOperationsService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly rows = signal<readonly CashBoxMonitorRow[]>([]);
  protected readonly denominations = signal<readonly DenominationDto[]>([]);
  protected readonly selectedCashBoxId = signal<number | null>(null);
  protected readonly selectedCashBox = computed(() => this.rows().find((row) => row.cashBoxId === this.selectedCashBoxId()) ?? null);
  protected readonly sessionSummary = signal<CashBoxSessionSummary | null>(null);
  protected readonly summaryLoading = signal(false);
  protected readonly summaryError = signal<string | null>(null);
  protected readonly detailTab = signal<'overview' | 'counts' | 'adjustments'>('overview');
  protected readonly sessionCounts = signal<readonly CashBoxCountGroup[]>([]);
  protected readonly pendingAction = signal<CashBoxAction | null>(null);
  protected readonly pendingCashBox = signal<CashBoxMonitorRow | null>(null);
  protected readonly counts = signal<Partial<Record<number, number>>>({});
  protected readonly invalidCountIds = signal<readonly number[]>([]);
  protected readonly notes = signal('');
  protected readonly shiftName = signal('');
  protected readonly adjustmentType = signal<'IN' | 'OUT' | ''>('');
  protected readonly adjustmentSource = signal('AjusteManual');
  protected readonly adjustmentCurrency = signal('');
  protected readonly adjustmentAmount = signal('');
  protected readonly closeReview = signal(false);
  protected readonly zeroCountConfirmed = signal(false);
  protected readonly reconciliationMessage = signal<string | null>(null);
  /** Sesión cuyo cierre devolvió una respuesta ambigua; se conserva hasta que el monitor confirme. */
  protected readonly pendingCloseSessionId = signal<number | null>(null);
  protected readonly canView = computed(() => this.session.hasPermission('finance:view-cashbox'));
  protected readonly canEdit = computed(() => this.session.hasPermission('finance:manage-cashbox'));
  protected readonly baseCode = computed(() => (this.session.session()?.tenant.currencyCode || 'NIO').trim().toUpperCase());
  protected readonly countedTotals = computed(() => {
    const rows = this.countRows();
    return [...new Set(rows.map((item) => item.currencyCode))].map((currencyCode) => ({
      currencyCode,
      amount: rows.filter((item) => item.currencyCode === currencyCode)
        .reduce((total, item) => total + item.value * (this.counts()[item.denominationId] ?? 0), 0),
    }));
  });
  protected readonly countIsZero = computed(() => this.countedTotals().every((total) => total.amount === 0));
  protected readonly currencyCodes = computed(() => [...new Set(this.denominations()
    .map((denomination) => denomination.currencyCode.toUpperCase()))]);
  protected readonly primaryCurrency = computed(() => 'NIO');
  protected readonly secondaryCurrencyCodes = computed(() =>
    this.currencyCodes().filter((code) => code !== this.primaryCurrency()));
  protected readonly missingExchangeRateCodes = computed(() => this.secondaryCurrencyCodes()
    .filter((code) => !this.exchangeRateFor(code)));
  protected readonly totalCountInBase = computed(() => {
    if (this.missingExchangeRateCodes().length) return null;
    return this.countedTotals().reduce((total, item) => total + item.amount * this.rateFor(item.currencyCode), 0);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!this.canView()) { this.loading.set(false); return; }
    this.loading.set(true); this.errorMessage.set(null);
    const pendingId = this.pendingCloseSessionId();
    forkJoin({
      rows: this.service.monitor(),
      denominations: this.service.denominations().pipe(catchError(() => of([] as readonly DenominationDto[]))),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ rows, denominations }) => {
        this.rows.set(rows); this.denominations.set(denominations);
        const selectedId = this.selectedCashBoxId();
        const selected = rows.find((row) => row.cashBoxId === selectedId) ?? rows[0] ?? null;
        this.selectedCashBoxId.set(selected?.cashBoxId ?? null);
        this.loadSessionSummary(selected);
        if (!this.adjustmentCurrency() && denominations.length) this.adjustmentCurrency.set(denominations[0].currencyCode);
        if (pendingId !== null) {
          this.pendingCloseSessionId.set(null);
          const stillOpen = rows.some((row) => row.sessionId === pendingId && row.isOpen);
          this.reconciliationMessage.set(stillOpen
            ? 'El monitor aún muestra la sesión abierta. Verifica su estado antes de repetir el cierre.'
            : null);
          if (!stillOpen) this.successMessage.set('El cierre fue confirmado en el monitor: la sesión ya no está abierta.');
        }
      },
      error: (error: unknown) => this.errorMessage.set(describeApiError(error)),
    });
  }

  protected selectCashBox(row: CashBoxMonitorRow): void {
    if (this.saving()) return;
    this.selectedCashBoxId.set(row.cashBoxId);
    this.cancelAction();
    this.detailTab.set('overview');
    this.loadSessionSummary(row);
  }

  private loadSessionSummary(row: CashBoxMonitorRow | null): void {
    this.sessionSummary.set(null);
    this.summaryError.set(null);
    this.sessionCounts.set([]);
    if (!row?.sessionId) { this.summaryLoading.set(false); return; }
    this.summaryLoading.set(true);
    this.service.sessionSummary(row.sessionId).pipe(finalize(() => this.summaryLoading.set(false))).subscribe({
      next: (summary) => {
        this.sessionSummary.set(summary);
        this.sessionCounts.set(this.toCountGroups(summary.counts));
      },
      error: (error: unknown) => this.summaryError.set(describeApiError(error)),
    });
  }

  /** Los conteos del resumen llegan planos: se agrupan por tipo (Apertura/Pre-Arqueo/Cierre). */
  private toCountGroups(counts: readonly CashBoxCountRow[]): readonly CashBoxCountGroup[] {
    const order = new Map<number, number>([[1, 0], [2, 1], [3, 2]]);
    const groups = new Map<number, { countTypeId: number; countType: string; recordedAt: string | null; counts: CashBoxCountGroup['counts'][number][] }>();
    for (const line of counts) {
      if (!groups.has(line.countTypeId)) {
        groups.set(line.countTypeId, { countTypeId: line.countTypeId, countType: line.countTypeName, recordedAt: null, counts: [] });
      }
      const group = groups.get(line.countTypeId)!;
      group.counts.push({
        currencyCode: line.currencyCode,
        denominationLabel: line.label,
        denominationValue: line.denominationValue,
        count: line.count,
        subtotal: line.subTotal,
        subTotalInBase: line.subTotalInBase,
        recordedAt: line.recordedAt,
      });
      if (line.recordedAt && (!group.recordedAt || line.recordedAt > group.recordedAt)) group.recordedAt = line.recordedAt;
    }
    return [...groups.values()].sort((left, right) => (order.get(left.countTypeId) ?? 99) - (order.get(right.countTypeId) ?? 99));
  }

  protected countCurrencyTotals(group: CashBoxCountGroup): readonly { currencyCode: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const line of group.counts) {
      totals.set(line.currencyCode, (totals.get(line.currencyCode) ?? 0) + line.subtotal);
    }
    return [...totals].map(([currencyCode, amount]) => ({ currencyCode, amount }));
  }

  protected showDetailTab(tab: 'overview' | 'counts' | 'adjustments'): void {
    this.detailTab.set(tab);
  }

  protected statusLabel(row: CashBoxMonitorRow): string {
    return row.isOpen ? 'Abierta' : 'Disponible';
  }

  protected statusTone(row: CashBoxMonitorRow): string {
    return row.isOpen ? 'open' : 'available';
  }

  protected requestAction(row: CashBoxMonitorRow, action: CashBoxAction): void {
    if (!this.canEdit() || !this.network.online()) return;
    if (action === 'close' && pendingCloseFor(this.pendingCloseSessionId(), row)) {
      this.reconciliationMessage.set('Este cierre sigue sin confirmarse. Usa «Verificar ahora» antes de repetir la operación.');
      return;
    }
    if (action === 'open' && row.isOpen) return;
    if (action !== 'open' && !row.sessionId) return;
    this.selectedCashBoxId.set(row.cashBoxId);
    this.pendingCashBox.set(row); this.pendingAction.set(action); this.counts.set({}); this.invalidCountIds.set([]);
    this.notes.set(''); this.zeroCountConfirmed.set(false); this.closeReview.set(false);
    this.reconciliationMessage.set(null); this.errorMessage.set(null);
    this.adjustmentAmount.set(''); this.adjustmentType.set(''); this.adjustmentSource.set('AjusteManual');
    if (!this.adjustmentCurrency() && this.denominations().length) this.adjustmentCurrency.set(this.denominations()[0].currencyCode);
  }

  protected retryMonitor(): void {
    this.load();
  }

  /** Tasa vigente hacia la moneda base, tal como la publica el catálogo de denominaciones. */
  protected exchangeRateFor(currencyCode: string): number | null {
    const normalized = currencyCode.trim().toUpperCase();
    if (normalized === this.primaryCurrency()) return null;
    const rate = this.denominations()
      .filter((denomination) => denomination.currencyCode.trim().toUpperCase() === normalized)
      .map((denomination) => denomination.exchangeRateToNIO)
      .find((rate) => typeof rate === 'number' && rate > 0);
    return typeof rate === 'number' && rate > 0 ? rate : null;
  }

  private rateFor(currencyCode: string): number {
    if (currencyCode.toUpperCase() === this.primaryCurrency()) return 1;
    return this.exchangeRateFor(currencyCode) ?? 0;
  }

  protected operationalDate(): string {
    return dateKeyInTimeZone(new Date(), this.session.session()?.tenant.timeZone);
  }

  protected formatLocationDate(value: string, style: 'short' | 'time' = 'short'): string {
    return formatInstantInTimeZone(value, this.session.session()?.tenant.timeZone, style);
  }

  protected cancelAction(): void {
    if (this.saving()) return;
    this.pendingCashBox.set(null); this.pendingAction.set(null); this.counts.set({}); this.invalidCountIds.set([]);
    this.notes.set(''); this.shiftName.set(''); this.closeReview.set(false); this.zeroCountConfirmed.set(false);
  }

  protected setCount(denominationId: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const value = raw === '' ? 0 : Number(raw);
    const invalid = !Number.isSafeInteger(value) || value < 0 || value > 1_000_000;
    this.invalidCountIds.update((ids) => invalid ? [...new Set([...ids, denominationId])] : ids.filter((id) => id !== denominationId));
    if (invalid) { this.errorMessage.set('Cada cantidad debe ser un entero entre 0 y 1 000 000.'); return; }
    this.counts.update((current) => ({ ...current, [denominationId]: value }));
    this.zeroCountConfirmed.set(false);
    if (this.invalidCountIds().length === 0 && this.errorMessage()?.startsWith('Cada cantidad')) this.errorMessage.set(null);
  }

  protected confirmZeroCount(event: Event): void { this.zeroCountConfirmed.set((event.target as HTMLInputElement).checked); }

  protected setNotes(event: Event): void { this.notes.set((event.target as HTMLInputElement | HTMLTextAreaElement).value); }
  protected setShiftName(event: Event): void { this.shiftName.set((event.target as HTMLInputElement).value); }
  protected setAdjustmentType(raw: string | null): void {
    const value = (raw ?? '');
    this.adjustmentType.set(value === 'IN' || value === 'OUT' ? value : '');
  }
  /** Clasificación del ajuste: Propina sugiere entrada y Comisión sugiere salida (no pisa una elección previa). */
  protected setAdjustmentSource(raw: string | null): void {
    const value = raw || 'AjusteManual';
    this.adjustmentSource.set(value);
    if (!this.adjustmentType()) {
      if (value === 'Propina') this.adjustmentType.set('IN');
      else if (value === 'Comision') this.adjustmentType.set('OUT');
    }
  }
  protected setAdjustmentCurrency(raw: string | null): void { this.adjustmentCurrency.set((raw ?? '')); }
  protected setAdjustmentAmount(event: Event): void { this.adjustmentAmount.set((event.target as HTMLInputElement).value); }

  protected adjustmentSourceLabel(): string {
    return this.adjustmentSourceOptions().find((option) => option.value === this.adjustmentSource())?.label ?? 'Ajuste manual';
  }

  protected actionTitle(): string {
    return ({ open: 'Abrir sesión de caja', 'pre-count': 'Registrar pre-arqueo', close: 'Cerrar sesión de caja', adjust: 'Registrar ajuste de caja' } as Record<CashBoxAction, string>)[this.pendingAction() as CashBoxAction] ?? 'Operar caja';
  }

  protected actionDescription(): string {
    return ({
      open: 'El conteo inicial abre una sola sesión en la caja y fija el importe de apertura.',
      'pre-count': 'Guarda un checkpoint del efectivo contado. El turno sigue abierto para venta y ajustes; el conteo no reemplaza el fondo inicial.',
      close: 'El conteo final cierra la sesión y el backend calcula esperado, diferencia y resultado del arqueo.',
      adjust: 'La entrada o salida modifica el esperado con su signo y queda asociada a esta sesión.',
    } as Record<CashBoxAction, string>)[this.pendingAction() as CashBoxAction] ?? '';
  }

  protected isCountAction(): boolean { return this.pendingAction() === 'open' || this.pendingAction() === 'pre-count' || this.pendingAction() === 'close'; }

  protected countRows(): readonly DenominationDto[] {
    return this.denominations();
  }

  protected confirmAction(): void {
    const row = this.pendingCashBox(); const action = this.pendingAction();
    if (!row || !action || this.saving() || !this.canEdit() || !this.network.online()) return;
    if (action !== 'open' && !row.sessionId) return;
    if (this.invalidCountIds().length) { this.errorMessage.set('Corrige las cantidades inválidas antes de continuar.'); return; }
    if (this.isCountAction()) {
      if (!this.countRows().length) { this.errorMessage.set('No hay denominaciones configuradas para operar la caja.'); return; }
      if (this.missingExchangeRateCodes().length) {
        this.errorMessage.set(`Sin tasa vigente hacia ${this.primaryCurrency()} para: ${this.missingExchangeRateCodes().join(', ')}. Solicita registrar el tipo de cambio antes de operar.`);
        return;
      }
      if (this.countIsZero() && !this.zeroCountConfirmed()) { this.errorMessage.set('Confirma explícitamente que el conteo de todas las monedas es cero.'); return; }
    }
    if (action === 'close' && !this.closeReview()) { this.closeReview.set(true); return; }
    const amount = Number(this.adjustmentAmount());
    if (action === 'adjust'
      && (this.adjustmentType() !== 'IN' && this.adjustmentType() !== 'OUT'
        || !this.adjustmentCurrency() || !Number.isFinite(amount) || amount <= 0)) {
      this.errorMessage.set('Selecciona entrada o salida, moneda y un monto mayor que cero.');
      return;
    }
    this.executeAction(row, action);
  }

  private saveCounts(sessionId: number, countTypeId: number) {
    const rows = this.countRows();
    if (!rows.length) return of([]);
    const positive = rows
      .map((denomination) => ({ denominationId: denomination.denominationId, count: this.counts()[denomination.denominationId] ?? 0 }))
      .filter((item) => item.count > 0);
    const zeroDenomination = rows.find((item) => item.currencyCode.toUpperCase() === this.primaryCurrency()) ?? rows[0];
    const calls = positive.length > 0 ? positive : [{ denominationId: zeroDenomination.denominationId, count: 0 }];
    return forkJoin(calls.map((item) => this.service.addCount(sessionId, countTypeId, item.denominationId, item.count)));
  }

  private executeAction(row: CashBoxMonitorRow, action: CashBoxAction): void {
    const countTypeId = action === 'open' ? 1 : action === 'pre-count' ? 2 : 3;
    const notes = this.notes().trim() || null;
    const request: Observable<unknown> = action === 'open'
      ? this.service.open({
          cashBoxId: row.cashBoxId,
          shiftName: this.shiftName().trim() || 'Turno general',
          openingBalanceBase: this.totalCountInBase() ?? 0,
          notes,
        }).pipe(switchMap((sessionId) => this.saveCounts(sessionId, countTypeId)))
        : action === 'pre-count'
          ? this.saveCounts(row.sessionId as number, countTypeId)
          : action === 'close'
            ? this.saveCounts(row.sessionId as number, countTypeId).pipe(switchMap(() => this.service.close(row.sessionId as number, this.totalCountInBase() ?? 0, notes)))
            : this.service.addAdjustment(row.sessionId as number, this.adjustmentType() as 'IN' | 'OUT', this.adjustmentCurrency(), Number(this.adjustmentAmount()), notes, this.adjustmentSource());
    this.saving.set(true); this.errorMessage.set(null);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.pendingCashBox.set(null); this.pendingAction.set(null); this.counts.set({}); this.notes.set(''); this.shiftName.set(''); this.closeReview.set(false); this.zeroCountConfirmed.set(false);
        this.successMessage.set(action === 'open' ? 'Sesión abierta.' : action === 'pre-count' ? 'Pre-arqueo registrado.' : action === 'close' ? 'Sesión cerrada y conciliada.' : 'Ajuste registrado.');
        this.load();
      },
      error: (error: unknown) => {
        if (action === 'open') {
          // La sesión ya quedó abierta aunque falle el guardado del conteo inicial: aviso claro, no error fatal.
          this.successMessage.set('Sesión abierta.');
          this.pendingCashBox.set(null); this.pendingAction.set(null); this.counts.set({}); this.closeReview.set(false); this.zeroCountConfirmed.set(false);
          this.errorMessage.set('La sesión quedó abierta, pero no se pudo guardar el conteo inicial. Verifícalo en el monitor y registra el conteo cuando sea posible.');
          this.load();
          return;
        }
        if (action === 'close' && this.isUncertainResult(error)) {
          this.pendingCloseSessionId.set(row.sessionId);
          this.pendingCashBox.set(null); this.pendingAction.set(null); this.closeReview.set(false);
          this.reconciliationMessage.set('La respuesta del cierre tardó demasiado; recarga el monitor antes de repetir el cierre.');
          this.load();
          return;
        }
        this.errorMessage.set(describeApiError(error));
      },
    });
  }

  protected isUncertainResult(error: unknown): boolean {
    const candidate = error as { status?: number; name?: string } | null;
    return candidate?.status === 0 || candidate?.status === 408 || candidate?.status === 429
      || candidate?.name === 'TimeoutError' || (candidate?.status ?? 0) >= 500;
  }

  protected reconcile(): void { this.load(); }
  protected editCloseReview(): void { this.closeReview.set(false); }

  protected dismissMessages(): void { this.successMessage.set(null); this.errorMessage.set(null); }
}

function pendingCloseFor(pendingId: number | null, row: CashBoxMonitorRow): boolean {
  return pendingId !== null && pendingId === row.sessionId;
}
