import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { NetworkStatusService } from '../../../core/browser/network-status.service';
import {
  FinancialSummaryDto,
  InventoryReportRowDto,
  PayrollExpenseRowDto,
  ProductSalesRowDto,
  ServiceSalesRowDto,
  SummaryLine,
} from '../../../core/models/finance/finance-reports.model';
import { PrintReportService } from '../../../shared/print/print-report.service';
import { CazoIconComponent, DataTableColumn, DataTableComponent, DataTableCellDirective, DateFieldComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, StatCardComponent, TabsComponent, TabItem } from '../../../shared/ui';
import { QUICK_RANGES, REPORT_QUICK_RANGE_IDS, QuickRange, ReportQuickRange, ReportTab, ReportsStore } from './reports.store';

interface ReportTabItem extends TabItem {
  readonly id: ReportTab;
}

@Component({
  selector: 'rms-motel-reports-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, CazoIconComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, StatCardComponent, TabsComponent,
  ],
  providers: [ReportsStore],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  protected readonly store = inject(ReportsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly printReport = inject(PrintReportService);
  private readonly destroyRef = inject(DestroyRef);

  /** Contenedor del tab activo: es lo único que viaja al PDF. */
  protected readonly printArea = viewChild<ElementRef<HTMLElement>>('reportPrintArea');

  protected readonly currencyPrefix = `C$`;

  protected readonly startControl = new FormControl<string>(this.store.startDate(), { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.endDate(), { nonNullable: true });

  protected readonly quickRanges = QUICK_RANGES;
  protected readonly quickRangeIds = REPORT_QUICK_RANGE_IDS;

  protected readonly tabs: readonly ReportTabItem[] = [
    { id: 'summary', label: 'Resumen financiero', icon: 'wallet' },
    { id: 'service', label: 'Servicios', icon: 'bed' },
    { id: 'products', label: 'Productos', icon: 'package' },
    { id: 'inventory', label: 'Inventario', icon: 'layers' },
    { id: 'payroll', label: 'Nómina', icon: 'users' },
  ];

  protected readonly summaryLines = computed<readonly SummaryLine[]>(() => {
    const data = this.store.summary()?.data ?? null;
    if (!data) return [];
    return this.buildSummaryLines(data);
  });

  protected readonly summaryTotals = computed(() => {
    const lines = this.summaryLines();
    const income = lines.filter((line) => line.kind === 'income').reduce((sum, line) => sum + line.amount, 0);
    const expense = lines.filter((line) => line.kind === 'expense').reduce((sum, line) => sum + line.amount, 0);
    return { income, expense, net: income - expense };
  });

  protected readonly serviceSummary = computed(() => {
    const rows = this.store.serviceSales()?.rows ?? [];
    return {
      stays: rows.reduce((sum, row) => sum + row.stays, 0),
      total: rows.reduce((sum, row) => sum + row.totalRevenue, 0),
      avgHours: this.weightedAvgHours(rows),
    };
  });

  protected readonly productSummary = computed(() => {
    const rows = this.store.productSales()?.rows ?? [];
    return {
      units: rows.reduce((sum, row) => sum + row.soldQuantity, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      margin: rows.reduce((sum, row) => sum + row.margin, 0),
    };
  });

  protected readonly inventorySummary = computed(() => {
    const rows = this.store.inventory()?.rows ?? [];
    return {
      stockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
      underMin: rows.filter((row) => row.isUnderMinStock).length,
      purchases: rows.reduce((sum, row) => sum + row.purchaseCost, 0),
    };
  });

  protected readonly payrollSummary = computed(() => {
    const rows = (this.store.payroll()?.rows ?? []).filter((row) => row.employeeId !== 0);
    const grossPaid = rows.reduce((sum, row) => sum + row.grossPaid, 0);
    const deductions = rows.reduce((sum, row) => sum + row.deductionsAmount, 0);
    const netPaid = rows.reduce((sum, row) => sum + row.netPaid, 0);
    const extraPaid = rows.reduce((sum, row) => sum + row.extraPaid, 0);
    return { employees: rows.length, grossPaid, deductions, netPaid, extraPaid };
  });

  protected readonly columns: ReadonlyMap<ReportTab, readonly DataTableColumn[]> = new Map<ReportTab, readonly DataTableColumn[]>([
    ['service', [
      { key: 'stayTypeName', label: 'Tipo de tarifa' },
      { key: 'arrivalName', label: 'Llegada', width: '120px' },
      { key: 'stays', label: 'Estancias', width: '100px', align: 'end' },
      { key: 'mainRevenue', label: 'Tarifa+Ext', width: '130px', align: 'end' },
      { key: 'productsRevenue', label: 'Minibar', width: '120px', align: 'end' },
      { key: 'finesRevenue', label: 'Multas', width: '120px', align: 'end' },
      { key: 'totalRevenue', label: 'Total C$', width: '130px', align: 'end' },
      { key: 'avgHours', label: 'Horas prom.', width: '110px', align: 'end' },
      { key: 'avgStayTotal', label: 'Cobro prom.', width: '120px', align: 'end' },
    ]],
    ['products', [
      { key: 'productName', label: 'Producto' },
      { key: 'categoryName', label: 'Categoría', width: '160px' },
      { key: 'soldQuantity', label: 'Vendido', width: '110px', align: 'end' },
      { key: 'unitOfMeasure', label: 'Unidad', width: '80px' },
      { key: 'revenue', label: 'Ingreso C$', width: '130px', align: 'end' },
      { key: 'cost', label: 'Costo C$', width: '120px', align: 'end' },
      { key: 'margin', label: 'Margen C$', width: '120px', align: 'end' },
      { key: 'staysWithSale', label: 'Cuentas', width: '90px', align: 'end' },
    ]],
    ['inventory', [
      { key: 'productName', label: 'Producto' },
      { key: 'categoryName', label: 'Categoría', width: '160px' },
      { key: 'stock', label: 'Stock', width: '110px', align: 'end' },
      { key: 'minStock', label: 'Mínimo', width: '100px', align: 'end' },
      { key: 'costPrice', label: 'Costo unit.', width: '120px', align: 'end' },
      { key: 'stockValue', label: 'Valor stock C$', width: '140px', align: 'end' },
      { key: 'purchaseCost', label: 'Compras C$', width: '130px', align: 'end' },
      { key: 'soldQuantity', label: 'Vendidos', width: '110px', align: 'end' },
    ]],
    ['payroll', [
      { key: 'fullName', label: 'Empleado' },
      { key: 'position', label: 'Puesto', width: '150px' },
      { key: 'contractPaymentType', label: 'Modalidad', width: '120px' },
      { key: 'paymentsCount', label: 'Pagos', width: '80px', align: 'end' },
      { key: 'grossPaid', label: 'Bruto C$', width: '120px', align: 'end' },
      { key: 'deductionsAmount', label: 'Deducciones C$', width: '140px', align: 'end' },
      { key: 'netPaid', label: 'Neto C$', width: '120px', align: 'end' },
      { key: 'extraPaid', label: 'Extra C$', width: '120px', align: 'end' },
      { key: 'lastPaidAtUtc', label: 'Último pago', width: '150px' },
    ]],
    ['summary', [
      { key: 'label', label: 'Concepto' },
      { key: 'kind', label: 'Tipo', width: '110px' },
      { key: 'amount', label: 'Monto C$', width: '160px', align: 'end' },
    ]],
  ]);

  protected readonly trackLine = (row: SummaryLine, _index: number): string => `${row.kind}-${row.label}`;
  protected readonly trackServiceRow = (row: ServiceSalesRowDto, _index: number): string =>
    `${row.serviceStayTypeId}-${row.arrivalType}`;
  protected readonly trackProductRow = (row: ProductSalesRowDto, _index: number): number => row.productId;
  protected readonly trackInventoryRow = (row: InventoryReportRowDto, _index: number): number => row.productId;
  protected readonly trackPayrollRow = (row: PayrollExpenseRowDto, _index: number): number => row.employeeId;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDateControls());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDateControls());
    if (!this.canView()) return;
    this.store.setTab(this.store.tab());
  }

  protected readonly canView = computed(() => this.session.hasPermission('finance:view-cashbox') || this.session.hasPermission('finance.reports'));

  protected showTab(tab: string): void {
    const next = tab as ReportTab;
    if (this.store.tab() === next) return;
    this.store.setTab(next);
  }

  /** Rango rápido activo (comparación contra el rango que ya aplicó el store). */
  protected isQuickActive(range: QuickRange): boolean {
    return this.store.startDate() === range.start() && this.store.endDate() === range.end();
  }

  /** Media de horas ponderada por estancias (los cortes del reporte traen promedios por grupo). */
  protected weightedAvgHours(rows: readonly ServiceSalesRowDto[]): number {
    const stays = rows.reduce((sum, row) => sum + row.stays, 0);
    if (!stays) return 0;
    return rows.reduce((sum, row) => sum + row.avgHours * row.stays, 0) / stays;
  }

  protected applyQuickRange(id: ReportQuickRange): void {
    this.store.applyQuickRange(id);
    this.startControl.setValue(this.store.startDate(), { emitEvent: false });
    this.endControl.setValue(this.store.endDate(), { emitEvent: false });
  }

  protected applyDateControls(): void {
    const startDate = this.startControl.value;
    const endDate = this.endControl.value;
    if (!startDate || !endDate || startDate > endDate) return;
    this.store.applyDateRange(startDate, endDate);
  }

  protected clearFilters(): void {
    this.store.resetFilters();
    this.startControl.setValue(this.store.startDate(), { emitEvent: false });
    this.endControl.setValue(this.store.endDate(), { emitEvent: false });
  }

  protected csv(tab: ReportTab): void {
    const rows = this.reportRows(tab);
    if (!rows.length) return;
    const csv = toCsv(rows);
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reportes-${tab}-${this.store.startDate()}-${this.store.endDate()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Genera el PDF del tab activo: encabezado con el tab y el rango aplicado, indicadores y tabla. */
  protected print(): void {
    const tab = this.store.tab();
    this.printReport.printReport({
      title: `Reportes consolidados · ${this.tabTitle(tab)}`,
      subtitle: 'Ganancias, pérdidas, servicios, productos, inventario y nómina del motel, leídos directo por su fuente.',
      meta: [
        { label: 'Pestaña', value: this.tabTitle(tab) },
        { label: 'Período', value: `${this.store.startDate()} al ${this.store.endDate()}` },
        { label: 'Zona horaria', value: 'America/Managua' },
        { label: 'Moneda', value: 'C$ (NIO)' },
      ],
      element: this.printArea()?.nativeElement ?? null,
      // El resumen cabe en vertical; los reportes de detalle tienen muchas columnas y piden horizontal.
      orientation: tab === 'summary' ? 'portrait' : 'landscape',
    });
  }

  private tabTitle(tab: ReportTab): string {
    return this.tabs.find((item) => item.id === tab)?.label ?? 'Reportes';
  }

  protected money = (value: number | null | undefined): string =>
    value === null || value === undefined ? '—' : `${this.currencyPrefix} ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value)}`;

  protected hours(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${value.toFixed(1)} h`;
  }

  protected dayKey(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-NI', { timeZone: 'America/Managua', dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  private reportRows(tab: ReportTab): readonly Record<string, unknown>[] {
    switch (tab) {
      case 'summary': return this.summaryLines().map((line) => ({ concepto: line.label, tipo: line.kind === 'income' ? 'Ingreso' : 'Egreso', 'monto (C$)': line.amount.toFixed(2) }));
      case 'service': return (this.store.serviceSales()?.rows ?? []).map((row) => ({ ...row }));
      case 'products': return (this.store.productSales()?.rows ?? []).map((row) => ({ ...row }));
      case 'inventory': return (this.store.inventory()?.rows ?? []).map((row) => ({ ...row }));
      case 'payroll': return (this.store.payroll()?.rows ?? []).map((row) => ({ ...row }));
      default: return [];
    }
  }

  private buildSummaryLines(data: FinancialSummaryDto): readonly SummaryLine[] {
    const lines: readonly SummaryLine[] = [
      { label: 'Tarifa y extensiones de estancias', amount: data.revenueStays, kind: 'income' },
      { label: 'Minibar vendido en estancias', amount: data.revenueProducts, kind: 'income' },
      { label: 'Multas cobradas', amount: data.revenueFines, kind: 'income' },
      { label: 'Ajustes manuales de caja (entradas)', amount: data.otherIncomeManualAdjustments, kind: 'income' },
      { label: 'Devoluciones de proveedor (recuperos)', amount: data.recoverySupplierReturns, kind: 'income' },
      { label: 'Compras de inventario', amount: data.expensePurchases, kind: 'expense' },
      { label: 'Devoluciones a cliente', amount: data.expenseCustomerReturns, kind: 'expense' },
      { label: 'Pagos de nómina', amount: data.expensePayroll, kind: 'expense' },
      { label: 'Pérdidas registradas', amount: data.expenseLosses, kind: 'expense' },
      { label: 'Ajustes manuales de caja (salidas)', amount: data.expenseManualAdjustments, kind: 'expense' },
    ];
    return lines.filter((line) => line.amount !== 0 || line.kind === 'income');
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
