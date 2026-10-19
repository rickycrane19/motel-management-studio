import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import {
  CashBoxCountGroup,
  CashBoxCountRow,
  CashBoxDto,
  CashBoxSessionHistoryRow,
  CashBoxSessionSummary,
} from '../../../../core/models/finance/cashbox-operations.model';
import { CashBoxOperationsService } from '../../../../core/services/finance/cashbox-operations.service';
import { startOfLocalDayUtc, startOfNextLocalDayUtc } from '../../../../core/time/location-date';
import { csvDocument } from '../../../../shared/export/safe-csv';
import { PrintReportService } from '../../../../shared/print/print-report.service';
import {
  BadgeTone,
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DateFieldComponent,
  DrawerComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
} from '../../../../shared/ui';

/** Día del negocio (America/Managua), no el día UTC. */
const MANAGUA_ZONE = 'America/Managua';

interface QuickRange {
  readonly id: string;
  readonly label: string;
  readonly start: () => string;
  readonly end: () => string;
}

/** Rangos rápidos del día del negocio (America/Managua), iguales a Reportes y Pérdidas. */
const QUICK_RANGES: readonly QuickRange[] = [
  { id: 'today', label: 'Hoy', start: () => managuaDay(), end: () => managuaDay() },
  { id: 'week', label: '7 días', start: () => managuaDay(-6), end: () => managuaDay() },
  { id: 'last30', label: '30 días', start: () => managuaDay(-29), end: () => managuaDay() },
  { id: 'currentMonth', label: 'Mes', start: () => managuaMonthStart(), end: () => managuaDay() },
];

/** Día del negocio (America/Managua) con desplazamiento de días; nunca el día UTC. */
function managuaDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANAGUA_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function managuaMonthStart(): string {
  return `${managuaDay().slice(0, 7)}-01`;
}

/**
 * Historial de turnos/sesiones de caja con su reconciliación. Lista paginada con filtros de
 * rango (días del negocio en America/Managua) y caja, indicadores del rango y un panel de
 * detalle que reutiliza el resumen de la sesión (conteos por denominación y ajustes).
 */
@Component({
  selector: 'rms-motel-cashbox-history-page',
  imports: [
    ReactiveFormsModule, CazoIconComponent, ComboboxComponent, DataTableComponent,
    DataTableCellDirective, DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent,
    PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  templateUrl: './cashbox-history-page.component.html',
  styleUrl: './cashbox-history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashboxHistoryPageComponent implements OnInit {
  private readonly service = inject(CashBoxOperationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly printReport = inject(PrintReportService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  /** Contenedor del listado (indicadores + tabla): es lo único que viaja al PDF. */
  protected readonly printArea = viewChild<ElementRef<HTMLElement>>('reportPrintArea');

  protected readonly canView = computed(() => this.session.hasPermission('finance:view-cashbox'));

  protected readonly pageSizes = [10, 20, 50, 100] as const;
  protected readonly quickRanges = QUICK_RANGES;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly rows = signal<readonly CashBoxSessionHistoryRow[]>([]);
  protected readonly totalRecords = signal(0);
  protected readonly cashBoxes = signal<readonly CashBoxDto[]>([]);
  protected readonly selectedCashBoxId = signal<number | null>(null);

  /** Rango por defecto: últimos 30 días del negocio (coincide con el default del backend). */
  protected readonly startControl = new FormControl<string>(managuaDay(-29), { nonNullable: true });
  protected readonly endControl = new FormControl<string>(managuaDay(), { nonNullable: true });
  protected readonly cashBoxControl = new FormControl<number | null>(null);

  protected readonly selected = signal<CashBoxSessionHistoryRow | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly detailSummary = signal<CashBoxSessionSummary | null>(null);
  protected readonly detailCounts = signal<readonly CashBoxCountGroup[]>([]);
  protected readonly detailAdjustments = computed(() => this.detailSummary()?.adjustments ?? []);

  protected readonly cashBoxOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.cashBoxes().map((box) => ({ value: box.cashBoxId, label: box.code ? `${box.name} · ${box.code}` : box.name })));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'shift', label: 'Turno' },
    { key: 'cashBox', label: 'Caja', width: '150px' },
    { key: 'opened', label: 'Apertura', width: '150px' },
    { key: 'closed', label: 'Cierre', width: '150px' },
    { key: 'opening', label: 'Saldo inicial', width: '130px', align: 'end' },
    { key: 'sales', label: 'Ventas', width: '130px', align: 'end' },
    { key: 'adjustments', label: 'Ajustes', width: '150px', align: 'end' },
    { key: 'closing', label: 'Calculado vs contado', width: '170px', align: 'end' },
    { key: 'difference', label: 'Diferencia', width: '150px', align: 'end' },
  ];

  /** Indicadores del rango construidos con lo listado (no de todo el rango si hay más páginas). */
  protected readonly stats = computed(() => {
    const items = this.rows();
    return {
      sales: items.reduce((sum, row) => sum + row.totalSalesBase, 0),
      difference: items.reduce((sum, row) => sum + row.differenceBase, 0),
      faltantes: items.filter((row) => row.differenceBase < 0).length,
      sobrantes: items.filter((row) => row.differenceBase > 0).length,
      complete: items.length >= this.totalRecords(),
    };
  });

  protected readonly activeFilterCount = computed(() =>
    (this.selectedCashBoxId() !== null ? 1 : 0)
    + (this.startControl.value !== managuaDay(-29) ? 1 : 0)
    + (this.endControl.value !== managuaDay() ? 1 : 0));

  protected readonly trackSession = (row: CashBoxSessionHistoryRow): number => row.cashBoxSessionId;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.cashBoxControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cashBoxId) => {
      this.selectedCashBoxId.set(cashBoxId ?? null);
      this.applyFilters();
    });
    if (!this.canView()) return;
    this.loadCashBoxes();
    this.load();
  }

  /** Consulta solo la página pedida, manteniendo los filtros actuales. */
  protected load(): void {
    if (!this.canView()) return;
    const start = this.startControl.value;
    const end = this.endControl.value;
    if (!start || !end || start > end) {
      this.error.set('Elige un rango de fechas válido para consultar el historial.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    // Los días elegidos son días del negocio (Managua): [inicio del día, inicio del día siguiente).
    const fromUtc = startOfLocalDayUtc(start, MANAGUA_ZONE).toISOString();
    const toUtc = startOfNextLocalDayUtc(end, MANAGUA_ZONE).toISOString();
    this.service.sessions({
      fromUtc,
      toUtc,
      cashBoxId: this.selectedCashBoxId(),
      page: this.page(),
      pageSize: this.pageSize(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        // Si la página quedó vacía pero hay turnos, vuelve a la última página con datos.
        if (result.items.length === 0 && result.totalRecords > 0 && this.page() > 1) {
          this.page.set(Math.max(1, Math.ceil(result.totalRecords / this.pageSize())));
          this.load();
          return;
        }
        this.rows.set(result.items);
        this.totalRecords.set(result.totalRecords);
        this.page.set(result.page);
        this.pageSize.set(result.pageSize);
        const current = this.selected();
        if (current && !result.items.some((row) => row.cashBoxSessionId === current.cashBoxSessionId)) this.closeDetail();
      },
      error: (error: unknown) => this.error.set(describeApiError(error)),
    });
  }

  private loadCashBoxes(): void {
    this.service.cashBoxes()
      .pipe(catchError(() => of([] as readonly CashBoxDto[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((boxes) => this.cashBoxes.set(boxes));
  }

  /** Cambió un filtro: vuelve a la primera página y consulta. */
  private applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  protected setPageSize(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  protected isQuickActive(range: QuickRange): boolean {
    return this.startControl.value === range.start() && this.endControl.value === range.end();
  }

  protected applyQuickRange(range: QuickRange): void {
    this.startControl.setValue(range.start(), { emitEvent: false });
    this.endControl.setValue(range.end(), { emitEvent: false });
    this.page.set(1);
    this.load();
  }

  protected clearFilters(): void {
    this.startControl.setValue(managuaDay(-29), { emitEvent: false });
    this.endControl.setValue(managuaDay(), { emitEvent: false });
    this.cashBoxControl.setValue(null, { emitEvent: false });
    this.selectedCashBoxId.set(null);
    this.page.set(1);
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected exportCsv(): void {
    const rows = this.rows();
    if (!rows.length) return;
    const header = [
      'Sesión', 'Turno', 'Operador', 'Caja', 'Apertura (Managua)', 'Cierre (Managua)',
      'Saldo inicial (C$)', 'Ventas (C$)', 'Entradas (C$)', 'Salidas (C$)',
      'Calculado (C$)', 'Contado (C$)', 'Diferencia (C$)', 'Resultado', 'Ajustes OUT', 'Conteos', 'Notas',
    ];
    const body = rows.map((row) => [
      row.cashBoxSessionId, row.shiftName ?? '', row.userName ?? '', row.cashBoxName,
      this.formatManagua(row.openedAtManagua), this.formatManagua(row.closedAtManagua),
      row.openingBalanceBase, row.totalSalesBase, row.totalInAdjustmentsBase, row.totalOutAdjustmentsBase,
      row.closingCalculatedBase, row.closingActualBase, row.differenceBase, row.differenceKind,
      row.outAdjustmentsCount, row.countsCount, row.notes ?? '',
    ]);
    const url = URL.createObjectURL(new Blob([csvDocument([header, ...body])], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `caja-historial-${this.startControl.value}-${this.endControl.value}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Genera el PDF del listado con su rango y filtros aplicados. */
  protected print(): void {
    this.printReport.printReport({
      title: 'Historial de caja · Turnos',
      subtitle: 'Turnos abiertos y cerrados de tu sucursal con su reconciliación: fondo inicial, ventas, ajustes y resultado del arqueo.',
      meta: [
        { label: 'Período', value: `${this.startControl.value} al ${this.endControl.value}` },
        { label: 'Caja', value: this.cashBoxLabel() },
        { label: 'Turnos listados', value: `${this.rows().length} de ${this.totalRecords()}` },
        { label: 'Página', value: `${this.page()}` },
        { label: 'Zona horaria', value: 'America/Managua' },
        { label: 'Moneda', value: 'C$ (NIO)' },
      ],
      element: this.printArea()?.nativeElement ?? null,
      orientation: 'landscape', // 9 columnas de importes: caben mejor en horizontal
    });
  }

  /** Caja filtrada, tal como la conoce el usuario (nunca un id suelto). */
  private cashBoxLabel(): string {
    const cashBoxId = this.selectedCashBoxId();
    if (cashBoxId === null) return 'Todas las cajas';
    return this.cashBoxes().find((box) => box.cashBoxId === cashBoxId)?.name ?? `Caja #${cashBoxId}`;
  }

  protected open(row: CashBoxSessionHistoryRow): void {
    this.selected.set(row);
    this.detailSummary.set(null);
    this.detailCounts.set([]);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.service.sessionSummary(row.cashBoxSessionId).pipe(finalize(() => this.detailLoading.set(false))).subscribe({
      next: (summary) => {
        this.detailSummary.set(summary);
        this.detailCounts.set(this.toCountGroups(summary.counts));
      },
      error: (error: unknown) => this.detailError.set(describeApiError(error)),
    });
  }

  protected closeDetail(): void {
    this.selected.set(null);
    this.detailSummary.set(null);
    this.detailCounts.set([]);
    this.detailError.set(null);
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
        recordedAt: line.recordedAtManagua,
      });
      const stamp = line.recordedAtManagua ?? line.recordedAt;
      if (stamp && (!group.recordedAt || stamp > group.recordedAt)) group.recordedAt = stamp;
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

  /** Monto en moneda base con el prefijo C$ (nunca un dato inventado). */
  protected money(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : `C$ ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  }

  /** Monto con signo explícito: sobrante (+) / faltante (−). */
  protected signedMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+ ' : value < 0 ? '− ' : '';
    return `${sign}C$ ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))}`;
  }

  /** Hora del negocio ya convertida por el backend (wall clock de Managua, sin reconvertir). */
  protected formatManagua(value: string | null): string {
    if (!value) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
    if (!match) return value;
    return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
  }

  protected differenceTone(row: CashBoxSessionHistoryRow): BadgeTone {
    if (row.differenceBase > 0) return 'warning';
    if (row.differenceBase < 0) return 'danger';
    return 'success';
  }

  protected differenceLabel(row: CashBoxSessionHistoryRow): string {
    return row.differenceKind || 'Sin resultado';
  }

  protected statusTone(row: CashBoxSessionHistoryRow): BadgeTone {
    return row.statusCode === 1 ? 'warning' : 'success';
  }
}
