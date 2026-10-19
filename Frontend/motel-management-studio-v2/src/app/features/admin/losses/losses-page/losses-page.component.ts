import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import {
  FinancialLossDto,
  LOSS_CATEGORY_LABELS,
  LossCategoryCode,
} from '../../../../core/models/finance/losses.model';
import { PrintReportService } from '../../../../shared/print/print-report.service';
import {
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
  PanelComponent,
  StatCardComponent,
  StatusBadgeComponent,
} from '../../../../shared/ui';
import { QuickRange, LOSS_CATEGORIES, LossesStore, QUICK_LOSS_RANGES } from '../losses.store';

@Component({
  selector: 'rms-losses-page',
  imports: [
    ReactiveFormsModule, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent,
    DataTableCellDirective, DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent,
    PageHeaderComponent, PagerComponent, PanelComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [LossesStore],
  templateUrl: './losses-page.component.html',
  styleUrl: './losses-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LossesPageComponent implements OnInit {
  protected readonly store = inject(LossesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly printReport = inject(PrintReportService);
  private readonly destroyRef = inject(DestroyRef);

  /** Contenedor del listado (indicadores, desglose y tabla): es lo único que viaja al PDF. */
  protected readonly printArea = viewChild<ElementRef<HTMLElement>>('reportPrintArea');

  protected readonly selected = signal<FinancialLossDto | null>(null);
  protected readonly pageSizes = [20, 50, 100, 200] as const;
  protected readonly quickRanges = QUICK_LOSS_RANGES;

  protected readonly startControl = new FormControl<string>(this.store.query().startDate, { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.query().endDate, { nonNullable: true });
  protected readonly categoryControl = new FormControl<LossCategoryCode | null>(this.store.query().category);

  protected readonly categoryOptions: readonly ComboboxOption<LossCategoryCode>[] = LOSS_CATEGORIES.map((code) => ({
    value: code,
    label: LOSS_CATEGORY_LABELS[code],
  }));

  protected readonly canView = computed(
    () => this.session.hasPermission('finance:view-cashbox') || this.session.hasPermission('finance.reports'),
  );
  protected readonly canRegister = computed(
    () => this.session.hasPermission('finance:manage-cashbox') || this.session.hasPermission('finance.reports'),
  );

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'when', label: 'Cuándo', width: '160px' },
    { key: 'category', label: 'Categoría', width: '150px' },
    { key: 'description', label: 'Qué pasó' },
    { key: 'room', label: 'Cuarto', width: '110px' },
    { key: 'amount', label: 'Monto C$', width: '140px', align: 'end' },
    { key: 'cash', label: 'Caja del turno', width: '150px' },
  ];

  protected readonly trackLoss = (row: FinancialLossDto, _index: number): number => row.lossId;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDates());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyDates());
    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((category) => this.store.applyFilters({ category: category ?? null }));
    if (!this.canView()) return;
    this.store.load();
  }

  protected categoryLabel(code: LossCategoryCode): string {
    return LOSS_CATEGORY_LABELS[code] ?? code;
  }

  /** Hora del negocio tal como la devuelve el backend (wall clock de Managua, sin reconvertir). */
  protected when(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }

  protected money(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : `C$ ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value)}`;
  }

  protected isQuickActive(range: QuickRange): boolean {
    return this.store.query().startDate === range.start() && this.store.query().endDate === range.end();
  }

  protected applyQuickRange(range: QuickRange): void {
    this.startControl.setValue(range.start(), { emitEvent: false });
    this.endControl.setValue(range.end(), { emitEvent: false });
    this.store.applyFilters({ startDate: range.start(), endDate: range.end() });
  }

  protected applyDates(): void {
    const startDate = this.startControl.value;
    const endDate = this.endControl.value;
    if (!startDate || !endDate || startDate > endDate) return;
    this.store.applyFilters({ startDate, endDate });
  }

  protected clearFilters(): void {
    this.store.resetFilters();
    this.categoryControl.setValue(null, { emitEvent: false });
    this.startControl.setValue(this.store.query().startDate, { emitEvent: false });
    this.endControl.setValue(this.store.query().endDate, { emitEvent: false });
  }

  /** Genera el PDF del listado con su rango y categoría aplicados. */
  protected print(): void {
    const category = this.store.query().category;
    this.printReport.printReport({
      title: 'Pérdidas del negocio',
      subtitle: 'Daños, faltantes y mermas registrados por categoría. Cada pérdida es un registro inmutable.',
      meta: [
        { label: 'Período', value: `${this.startControl.value} al ${this.endControl.value}` },
        { label: 'Categoría', value: category ? this.categoryLabel(category) : 'Todas las categorías' },
        { label: 'Pérdidas listadas', value: `${this.store.items().length} de ${this.store.totalRecords()}` },
        { label: 'Página', value: `${this.store.query().page}` },
        { label: 'Zona horaria', value: 'America/Managua' },
        { label: 'Moneda', value: 'C$ (NIO)' },
      ],
      element: this.printArea()?.nativeElement ?? null,
      orientation: 'landscape', // Cuándo, categoría, descripción, cuarto, monto y caja: cabe mejor en horizontal
    });
  }

  protected open(loss: FinancialLossDto): void {
    this.selected.set(loss);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }
}
