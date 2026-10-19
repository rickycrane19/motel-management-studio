import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { NetworkStatusService } from '../../../core/browser/network-status.service';
import { CashierPerformanceRowDto } from '../../../core/models/finance/finance-reports.model';
import { PrintReportService } from '../../../shared/print/print-report.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DateFieldComponent,
  DrawerComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent,
} from '../../../shared/ui';
import { CASHIER_QUICK_RANGES, CashierQuickRangeOption, CashierReportStore } from './cashier-report.store';

/**
 * Rendimiento por cajero/usuario: ventas cobradas, turnos, propinas y comisiones a pagar.
 * Solo consulta: el detalle de cada usuario se abre en un panel lateral.
 */
@Component({
  selector: 'rms-cashier-report-page',
  imports: [
    ReactiveFormsModule, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent,
    StatCardComponent, StatusBadgeComponent,
  ],
  providers: [CashierReportStore],
  templateUrl: './cashier-report-page.component.html',
  styleUrl: './cashier-report-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierReportPageComponent implements OnInit {
  protected readonly store = inject(CashierReportStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly printReport = inject(PrintReportService);
  private readonly destroyRef = inject(DestroyRef);

  /** Contenedor imprimible: encabezado, indicadores y tabla del reporte. */
  protected readonly printArea = viewChild<ElementRef<HTMLElement>>('reportPrintArea');

  protected readonly selected = signal<CashierPerformanceRowDto | null>(null);
  protected readonly quickRanges = CASHIER_QUICK_RANGES;

  protected readonly startControl = new FormControl<string>(this.store.startDate(), { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.endDate(), { nonNullable: true });
  protected readonly userControl = new FormControl<number | null>(this.store.userId());

  protected readonly canView = computed(
    () => this.session.hasPermission('finance:view-cashbox') || this.session.hasPermission('finance.reports'),
  );

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'user', label: 'Usuario' },
    { key: 'role', label: 'Perfil', width: '130px' },
    { key: 'sessions', label: 'Turnos', width: '100px', align: 'end' },
    { key: 'hours', label: 'Horas', width: '90px', align: 'end' },
    { key: 'stays', label: 'Estancias', width: '100px', align: 'end' },
    { key: 'sales', label: 'Ventas C$', width: '130px', align: 'end' },
    { key: 'avgTicket', label: 'Ticket prom.', width: '120px', align: 'end' },
    { key: 'tips', label: 'Propinas C$', width: '120px', align: 'end' },
    { key: 'commission', label: 'Comisión C$', width: '130px', align: 'end' },
    { key: 'difference', label: 'Diferencia C$', width: '140px', align: 'end' },
  ];

  protected readonly trackRow = (row: CashierPerformanceRowDto, _index: number): number => row.userId;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDates());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDates());
    this.userControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((userId) => this.store.applyUser(userId ?? null));
    if (!this.canView()) return;
    this.store.loadUsers();
    this.store.load();
  }

  protected isQuickActive(range: CashierQuickRangeOption): boolean {
    return this.store.startDate() === range.start() && this.store.endDate() === range.end();
  }

  protected applyQuickRange(range: CashierQuickRangeOption): void {
    this.startControl.setValue(range.start(), { emitEvent: false });
    this.endControl.setValue(range.end(), { emitEvent: false });
    this.store.applyQuickRange(range.id);
  }

  protected applyDates(): void {
    const startDate = this.startControl.value;
    const endDate = this.endControl.value;
    if (!startDate || !endDate || startDate > endDate) return;
    this.store.applyDateRange(startDate, endDate);
  }

  protected clearFilters(): void {
    this.store.resetFilters();
    this.startControl.setValue(this.store.startDate(), { emitEvent: false });
    this.endControl.setValue(this.store.endDate(), { emitEvent: false });
    this.userControl.setValue(null, { emitEvent: false });
  }

  protected open(row: CashierPerformanceRowDto): void {
    this.selected.set(row);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected money(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : `C$ ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value)}`;
  }

  protected hours(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${value.toFixed(2)} h`;
  }

  protected percent(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : `${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value)} %`;
  }

  /** Nombre legible de la métrica de la regla de comisión aplicada. */
  protected metricLabel(metric: string | null | undefined): string {
    switch (metric) {
      case 'Stays': return 'estancias';
      case 'Products': return 'minibar';
      case 'Tips': return 'propinas';
      case 'Sales': return 'ventas';
      default: return 'ventas';
    }
  }

  /** Genera el PDF del reporte: encabezado, rango aplicado, indicadores y tabla por usuario. */
  protected print(): void {
    const user = this.store.userId();
    const userLabel = user === null
      ? 'Todos los usuarios'
      : (this.store.userOptions().find((option) => option.value === user)?.label ?? 'Todos los usuarios');
    this.printReport.printReport({
      title: 'Rendimiento por cajero',
      subtitle: 'Ventas cobradas, turnos, propinas y comisiones a pagar por cada usuario o cajero en el período.',
      meta: [
        { label: 'Período', value: `${this.store.startDate()} al ${this.store.endDate()}` },
        { label: 'Usuario', value: userLabel },
        { label: 'Zona horaria', value: 'America/Managua' },
        { label: 'Moneda', value: 'C$ (NIO)' },
      ],
      element: this.printArea()?.nativeElement ?? null,
      orientation: 'landscape',
    });
  }

  /** Descarga el listado por usuario del período aplicado (sin la fila TOTAL del SP). */
  protected exportCsv(): void {
    const rows = this.store.rows();
    if (!rows.length) return;
    const totals = this.store.totals();
    const data = rows.map((row) => ({
      'usuario': row.userFullName,
      'cuenta': row.userName,
      'perfil': row.role ?? '',
      'turnos': row.sessionsCount,
      'turnos abiertos': row.openSessionsCount,
      'horas en turno': row.hoursOnShift.toFixed(2),
      'estancias': row.staysCount,
      'ventas cobradas (C$)': row.salesCollected.toFixed(2),
      'ticket promedio (C$)': row.avgTicket.toFixed(2),
      'propinas (C$)': row.tipsInBase.toFixed(2),
      'comision (%)': row.commissionRatePercent.toFixed(2),
      'comision a pagar (C$)': row.commissionAmount.toFixed(2),
      'diferencia de caja (C$)': row.differenceBase.toFixed(2),
    }));
    data.push({
      'usuario': 'TOTAL',
      'cuenta': '',
      'perfil': '',
      'turnos': totals.sessionsCount,
      'turnos abiertos': totals.openSessionsCount,
      'horas en turno': totals.hoursOnShift.toFixed(2),
      'estancias': totals.staysCount,
      'ventas cobradas (C$)': totals.salesCollected.toFixed(2),
      'ticket promedio (C$)': '',
      'propinas (C$)': totals.tipsInBase.toFixed(2),
      'comision (%)': '',
      'comision a pagar (C$)': totals.commissionAmount.toFixed(2),
      'diferencia de caja (C$)': totals.differenceBase.toFixed(2),
    });
    const csv = toCsv(data);
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rendimiento-cajeros-${this.store.startDate()}-${this.store.endDate()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(';'), ...rows.map((row) => headers.map((header) => escape(row[header])).join(';'))].join('\n');
}
