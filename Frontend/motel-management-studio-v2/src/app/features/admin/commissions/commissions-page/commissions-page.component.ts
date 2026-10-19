import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import {
  CommissionMetric,
  CommissionRule,
  CommissionRuleUpsert,
  CommissionScope,
} from '../../../../core/models/hr/commission-rule.model';
import { EmployeeService } from '../../../../core/services/hr/employee.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxLoader,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DateFieldComponent,
  DrawerComponent,
  FieldComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { CommissionRulesStore } from '../commissions.store';

const SCOPE_OPTIONS: readonly ComboboxOption<CommissionScope>[] = [
  { value: 'Employee', label: 'Por empleado', hint: 'Se aplica solo a una persona.' },
  { value: 'Position', label: 'Por puesto', hint: 'Se aplica a todos los que tienen ese puesto.' },
  { value: 'All', label: 'General', hint: 'Se aplica a todo el equipo.' },
];

const METRIC_OPTIONS: readonly { readonly value: CommissionMetric; readonly label: string }[] = [
  { value: 'Sales', label: 'Ventas cobradas' },
  { value: 'Stays', label: 'Estancias' },
  { value: 'Products', label: 'Minibar' },
  { value: 'Tips', label: 'Propinas' },
];

const STATUS_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Vigentes' },
  { value: 'inactive', label: 'Inactivas' },
];

/** Hoy en Managua: clave AAAA-MM-DD sin depender del reloj del navegador. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Comisiones del equipo: reglas por empleado, por puesto o generales, con
 * tramos de monto (desde/hasta), métrica y vigencia. La regla más específica
 * (empleado > puesto > general) es la que resuelve el reporte de cajeros.
 */
@Component({
  selector: 'rms-commissions-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, CazoIconComponent, ComboboxComponent, DataTableComponent,
    DataTableCellDirective, DateFieldComponent, DrawerComponent, FieldComponent, FilterBarComponent,
    NoticeComponent, PageHeaderComponent, PagerComponent, StatusBadgeComponent,
  ],
  providers: [CommissionRulesStore],
  templateUrl: './commissions-page.component.html',
  styleUrl: './commissions-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommissionsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly employeesService = inject(EmployeeService);
  protected readonly store = inject(CommissionRulesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly canManage = computed(() => this.session.hasPermission('hr:manage'));
  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly selectedEmployee = signal<ComboboxOption<number>[]>([]);

  protected readonly scopeOptions = SCOPE_OPTIONS;
  protected readonly metricOptions = METRIC_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly scopeControl = new FormControl<CommissionScope | null>(null);
  protected readonly metricControl = new FormControl<CommissionMetric | null>(null);
  protected readonly statusControl = new FormControl<string>('all', { nonNullable: true });

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'rule', label: 'Regla' },
    { key: 'metric', label: 'Métrica', width: '150px' },
    { key: 'range', label: 'Tramo', width: '180px' },
    { key: 'rate', label: '%', width: '90px', align: 'end' },
    { key: 'validity', label: 'Vigencia', width: '190px' },
    { key: 'status', label: 'Estado', width: '120px' },
    { key: 'actions', label: '', width: '120px' },
  ];
  protected readonly trackRule = (row: CommissionRule, _index: number): number => row.ruleId;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    scopeType: ['All' as CommissionScope, Validators.required],
    employeeId: this.formBuilder.control<number | null>(null),
    position: ['', Validators.maxLength(100)],
    metricType: ['Sales' as CommissionMetric, Validators.required],
    minAmount: [0, [Validators.required, Validators.min(0)]],
    maxAmount: this.formBuilder.control<number | null>(null),
    ratePercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    startDate: [todayKey(), Validators.required],
    endDate: [''],
    notes: ['', Validators.maxLength(300)],
  });

  private readonly tick = signal(0);
  protected readonly scopeValue = computed<CommissionScope>(() => { this.tick(); return this.form.controls.scopeType.value; });

  /** Busca empleados activos en el servidor para el alcance por empleado. */
  protected readonly searchEmployees: ComboboxLoader<number> = (term) => this.employeesService
    .list({ pageNumber: 1, pageSize: 20, search: term ?? '', paymentType: null, isActive: true })
    .pipe(map((page) => page.items.map((employee) => ({
      value: employee.employeeId,
      label: employee.fullName,
      hint: employee.position,
    }))));

  ngOnInit(): void {
    this.scopeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((scopeType) => {
      this.store.applyFilters({ scopeType });
    });
    this.metricControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((metricType) => {
      this.store.applyFilters({ metricType });
    });
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.store.applyFilters({ onlyActive: status === 'all' ? null : status === 'active' });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.tick.update((value) => value + 1));
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.scopeControl.setValue(null, { emitEvent: false });
    this.metricControl.setValue(null, { emitEvent: false });
    this.statusControl.setValue('all', { emitEvent: false });
    this.store.load({ search: '', scopeType: null, metricType: null, onlyActive: null, pageNumber: 1 });
  }

  protected metricLabel(metric: CommissionMetric | string): string {
    return METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? metric;
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.saveError.set(null);
    this.selectedEmployee.set([]);
    this.form.reset({
      name: '',
      scopeType: 'All',
      employeeId: null,
      position: '',
      metricType: 'Sales',
      minAmount: 0,
      maxAmount: null,
      ratePercent: 0,
      startDate: todayKey(),
      endDate: '',
      notes: '',
    });
    this.tick.update((value) => value + 1);
    this.drawerOpen.set(true);
  }

  protected openEdit(rule: CommissionRule): void {
    this.editingId.set(rule.ruleId);
    this.saveError.set(null);
    this.selectedEmployee.set(
      rule.employeeId !== null
        ? [{ value: rule.employeeId, label: rule.employeeName ?? `Empleado #${rule.employeeId}` }]
        : [],
    );
    this.form.reset({
      name: rule.name,
      scopeType: rule.scopeType,
      employeeId: rule.employeeId,
      position: rule.position ?? '',
      metricType: rule.metricType,
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount,
      ratePercent: rule.ratePercent,
      startDate: rule.startDate.slice(0, 10),
      endDate: rule.endDate ? rule.endDate.slice(0, 10) : '',
      notes: rule.notes ?? '',
    });
    this.tick.update((value) => value + 1);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    if (this.store.saving()) return;
    this.drawerOpen.set(false);
    this.saveError.set(null);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.saving()) return;
    const value = this.form.getRawValue();
    const employeeId = value.scopeType === 'Employee' ? value.employeeId : null;
    const position = value.scopeType === 'Position' ? value.position.trim() : null;
    if (value.scopeType === 'Employee' && employeeId === null) {
      this.saveError.set('Elige el empleado al que se le aplica la regla.');
      return;
    }
    if (value.scopeType === 'Position' && !position) {
      this.saveError.set('Escribe el puesto al que se le aplica la regla.');
      return;
    }
    if (value.maxAmount !== null && value.maxAmount <= value.minAmount) {
      this.saveError.set('El monto máximo del tramo debe ser mayor que el mínimo.');
      return;
    }
    if (value.endDate && value.endDate < value.startDate) {
      this.saveError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    const payload: CommissionRuleUpsert = {
      name: value.name.trim(),
      scopeType: value.scopeType,
      metricType: value.metricType,
      minAmount: round2(Number(value.minAmount) || 0),
      maxAmount: value.maxAmount === null ? null : round2(Number(value.maxAmount)),
      ratePercent: round2(Number(value.ratePercent) || 0),
      startDate: value.startDate,
      endDate: value.endDate || null,
      employeeId,
      position,
      notes: value.notes.trim() || null,
    };
    this.saveError.set(null);
    this.store.save(payload, this.editingId()).subscribe((saved) => {
      if (!saved) {
        this.saveError.set(this.store.errorMessage() ?? 'No pudimos guardar la regla.');
        return;
      }
      this.toast.success('Regla guardada', payload.name);
      this.drawerOpen.set(false);
      this.store.load({ pageNumber: this.editingId() === null ? 1 : this.store.query().pageNumber });
    });
  }

  protected toggleActive(rule: CommissionRule): void {
    this.store.toggleActive(rule);
  }

  protected money(amount: number | null): string {
    if (amount === null || amount === undefined) return '—';
    return `C$ ${Number(amount).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  protected rangeLabel(rule: CommissionRule): string {
    return rule.maxAmount === null
      ? `${this.money(rule.minAmount)} o más`
      : `${this.money(rule.minAmount)} – ${this.money(rule.maxAmount)}`;
  }
}
