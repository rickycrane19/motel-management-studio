import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import type { ActiveCashSessionDto } from '../../../../core/models/finance/cashbox-operations.model';
import type { EmployeeContract } from '../../../../core/models/hr/contract.model';
import { Employee } from '../../../../core/models/hr/employee.model';
import { EmployeeDeductionInput, EmployeePayment, EmployeePaymentUpsert } from '../../../../core/models/hr/employee-payment.model';
import { CashBoxOperationsService } from '../../../../core/services/finance/cashbox-operations.service';
import { ContractService } from '../../../../core/services/hr/contract.service';
import { EmployeePaymentService } from '../../../../core/services/hr/employee-payment.service';
import {
  CazoIconComponent,
  ComboboxComponent,
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
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { EmployeesStore } from '../employees.store';

type StatusFilter = 'all' | 'active' | 'inactive';
/** El pago es el normal del contrato vigente o el de un turno extra pagado aparte. */
type PaymentKind = 'contract' | 'extra';

export const PAYMENT_TYPE_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'Hourly', label: 'Por hora' },
  { value: 'Daily', label: 'Por día' },
  { value: 'PerShift', label: 'Por turno' },
  { value: 'Weekly', label: 'Semanal' },
  { value: 'Monthly', label: 'Mensual' },
];

/** Modalidades con las que se paga un turno extra fuera de horario. */
const EXTRA_PAYMENT_TYPE_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'Daily', label: 'Por día' },
  { value: 'Hourly', label: 'Por hora' },
  { value: 'PerShift', label: 'Por turno' },
];

/** Tipos de deducción que acepta el backend (INSS, IR, préstamo, adelanto u otro). */
export const DEDUCTION_TYPE_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'INSS', label: 'INSS' },
  { value: 'IR', label: 'IR (sobre la renta)' },
  { value: 'Prestamo', label: 'Préstamo' },
  { value: 'Adelanto', label: 'Adelanto de salario' },
  { value: 'Otro', label: 'Otra' },
];

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Redondeo a centavos para las tarifas sugeridas. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Directorio del personal del motel (diseño portado del HR de restaurant v2),
 * con la ficha en el drawer. Desde ahí se registran los pagos: el normal según
 * el contrato vigente o el de un turno extra fuera de horario, que puede salir
 * del efectivo de la caja del turno y queda como egreso en el arqueo.
 */
@Component({
  selector: 'rms-employees-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, DrawerComponent, FieldComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [EmployeesStore],
  templateUrl: './employees-page.component.html',
  styleUrl: './employees-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly paymentsService = inject(EmployeePaymentService);
  private readonly contractsService = inject(ContractService);
  private readonly cashBoxService = inject(CashBoxOperationsService);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(EmployeesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly selected = signal<Employee | null>(null);
  protected readonly payments = signal<readonly EmployeePayment[]>([]);
  protected readonly paymentsTotal = signal(0);
  protected readonly paymentsLoading = signal(false);
  protected readonly paymentsError = signal<string | null>(null);
  protected readonly paymentFormOpen = signal(false);
  protected readonly paymentSaving = signal(false);
  protected readonly contracts = signal<readonly EmployeeContract[]>([]);
  protected readonly contractsLoading = signal(false);
  protected readonly activeSession = signal<ActiveCashSessionDto | null>(null);
  protected readonly sessionLoading = signal(false);
  protected readonly sessionError = signal(false);
  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly paymentTypeControl = new FormControl<string | null>(null);
  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Vigentes' },
    { value: 'inactive', label: 'Inactivos' },
  ];
  protected readonly paymentTypeOptions: readonly ComboboxOption<string>[] = PAYMENT_TYPE_OPTIONS;
  protected readonly extraPaymentTypes = EXTRA_PAYMENT_TYPE_OPTIONS;
  protected readonly paymentKinds: readonly { value: PaymentKind; label: string; hint: string }[] = [
    { value: 'contract', label: 'Pago normal', hint: 'Lo acordado en su contrato vigente: modalidad, monto y periodo.' },
    { value: 'extra', label: 'Turno extra', hint: 'Un turno fuera de horario que se paga aparte, por día, hora o turno.' },
  ];

  protected readonly canManage = computed(() => this.session.hasPermission('hr:manage'));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'person', label: 'Empleado' },
    { key: 'job', label: 'Puesto' },
    { key: 'pay', label: 'Pago' },
    { key: 'since', label: 'Registrado', width: '140px' },
    { key: 'status', label: 'Estado', width: '120px' },
  ];
  protected readonly trackEmployee = (row: Employee, _index: number): number => row.employeeId;

  protected readonly deductionTypes = DEDUCTION_TYPE_OPTIONS;

  /**
   * Deducciones detalladas del pago (INSS, IR, préstamo, adelanto u otra). Cada
   * renglón se guarda en HR.EmployeeDeduction y el SP calcula el total deducido.
   */
  protected readonly deductions = this.formBuilder.nonNullable.array([
    this.newDeductionRow(),
  ]);

  /** Formulario de registrar pago dentro de la ficha (patrón hr-inline-form de restaurant v2). */
  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    paymentKind: ['contract' as PaymentKind, Validators.required],
    extraType: ['Daily', Validators.required],
    fromCashBox: [false],
    periodStart: [todayKey(), Validators.required],
    periodEnd: [todayKey(), Validators.required],
    unitsWorked: [1, [Validators.required, Validators.min(0.01)]],
    rateApplied: [0, [Validators.required, Validators.min(0)]],
    bonusAmount: [0, Validators.min(0)],
    deductions: this.deductions,
    notes: ['', Validators.maxLength(250)],
  });

  /** Fuerza el recálculo de los computed cuando cambia el formulario de pago. */
  private readonly paymentTick = signal(0);

  /** Contrato vigente del empleado abierto (el más reciente), si lo tiene. */
  protected readonly activeContract = computed(() => this.contracts().find((contract) => contract.isActive) ?? null);
  protected readonly paymentKindValue = computed<PaymentKind>(() => { this.paymentTick(); return this.paymentForm.controls.paymentKind.value; });
  protected readonly extraTypeValue = computed(() => { this.paymentTick(); return this.paymentForm.controls.extraType.value; });
  /** Modalidad que se enviará al API: la del contrato o la del turno extra elegido. */
  protected readonly effectivePaymentType = computed(() => {
    const employee = this.selected();
    if (!employee) return 'Monthly';
    if (this.paymentKindValue() === 'extra') return this.extraTypeValue();
    return this.activeContract()?.paymentType ?? employee.paymentType;
  });
  protected readonly effectivePaymentTypeLabel = computed(() => this.paymentLabel(this.effectivePaymentType()));
  protected readonly paymentUnitsHint = computed(() => this.unitsHint(this.effectivePaymentType()));
  protected readonly paymentCurrency = computed(() => this.activeContract()?.currencyCode ?? this.selected()?.currencyCode ?? 'NIO');
  protected readonly paymentTotal = computed(() => {
    this.paymentTick();
    const value = this.paymentForm.getRawValue();
    const base = (Number(value.unitsWorked) || 0) * (Number(value.rateApplied) || 0);
    return round2(base + (Number(value.bonusAmount) || 0) - this.deductionsTotal());
  });
  /** Suma de las deducciones detalladas del formulario. */
  protected readonly deductionsTotal = computed(() => {
    this.paymentTick();
    return round2(
      this.deductions.controls.reduce((total, row) => total + (Number(row.controls.amount.value) || 0), 0),
    );
  });
  /** Sugerencia de tarifa del turno extra: si el contrato es mensual, el día sale de BaseAmount / 30. */
  protected readonly suggestedRate = computed(() => {
    const contract = this.activeContract();
    const employee = this.selected();
    return this.suggestExtraRate(contract, employee?.rate ?? 0, this.extraTypeValue());
  });

  ngOnInit(): void {
    this.paymentTypeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((paymentType) => this.store.applyFilters({ paymentType }));
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.store.applyFilters({ isActive: status === 'all' ? null : status === 'active' });
    });
    this.paymentForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.paymentTick.update((value) => value + 1));
    this.paymentForm.controls.extraType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.paymentForm.controls.paymentKind.value === 'extra') this.applySuggestedRate();
      });
    this.store.load();
  }

  protected paymentLabel(type: string): string {
    return PAYMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
  }

  protected paidLabel(row: Employee): string {
    return this.paymentLabel(row.paymentType);
  }

  /** Cambia la unidad según la modalidad con la que se pagará el periodo. */
  protected unitsHint(type: string): string {
    switch (type) {
      case 'Hourly': return 'Horas trabajadas en el periodo. Para un turno extra escribe las horas cubiertas.';
      case 'Daily': return 'Días trabajados en el periodo. Un turno extra por día se registra con 1.';
      case 'PerShift': return 'Turnos cubiertos en el periodo. Un turno extra se registra con 1.';
      case 'Weekly': return 'Semanas completas del periodo.';
      default: return 'En meses; para el mes completo escribe 1.';
    }
  }

  /** Modalidad del turno extra sugerida a partir del contrato vigente. */
  protected selectPaymentKind(kind: PaymentKind): void {
    this.paymentForm.controls.paymentKind.setValue(kind);
    this.paymentForm.controls.paymentKind.markAsTouched();
    this.applySuggestedRate();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.paymentTypeControl.setValue(null, { emitEvent: false });
    this.statusControl.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  protected initials(row: Employee): string {
    return row.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'E';
  }

  protected open(employee: Employee): void {
    this.selected.set(employee);
    this.payments.set([]);
    this.paymentsTotal.set(0);
    this.paymentsError.set(null);
    this.paymentFormOpen.set(false);
    this.resetPaymentForm(employee);
    this.loadContracts(employee);
    this.loadActiveSession();
    this.loadPayments(employee);
  }

  protected closeDetail(): void {
    this.selected.set(null);
    this.payments.set([]);
    this.paymentsTotal.set(0);
    this.paymentsError.set(null);
    this.paymentFormOpen.set(false);
    this.contracts.set([]);
  }

  protected togglePaymentForm(): void {
    if (!this.selected()) return;
    const open = !this.paymentFormOpen();
    this.paymentFormOpen.set(open);
    if (open) {
      const employee = this.selected()!;
      this.paymentForm.patchValue({ periodStart: todayKey(), periodEnd: todayKey() }, { emitEvent: false });
      this.applySuggestedRate();
    }
  }

  /** Deja el formulario en «pago normal del contrato» con las fechas de hoy. */
  private resetPaymentForm(employee: Employee): void {
    this.deductions.clear();
    this.deductions.push(this.newDeductionRow());
    this.paymentForm.reset({
      paymentKind: 'contract',
      extraType: 'Daily',
      fromCashBox: false,
      periodStart: todayKey(),
      periodEnd: todayKey(),
      unitsWorked: 1,
      rateApplied: employee.rate,
      bonusAmount: 0,
      notes: '',
    }, { emitEvent: false });
    this.paymentTick.update((value) => value + 1);
  }

  /** Renglón vacío de deducción (tipo, detalle y monto). */
  private newDeductionRow() {
    return this.formBuilder.nonNullable.group({
      type: ['INSS', Validators.required],
      description: [''],
      amount: [0, [Validators.min(0)]],
    });
  }

  protected addDeduction(): void {
    this.deductions.push(this.newDeductionRow());
    this.paymentTick.update((value) => value + 1);
  }

  protected removeDeduction(index: number): void {
    this.deductions.removeAt(index);
    if (this.deductions.length === 0) this.deductions.push(this.newDeductionRow());
    this.paymentTick.update((value) => value + 1);
  }

  /** Re-siembra la tarifa y las unidades al cambiar de modalidad (siempre editable después). */
  private applySuggestedRate(): void {
    const employee = this.selected();
    if (!employee) return;
    const kind = this.paymentForm.controls.paymentKind.value;
    const rateApplied = kind === 'extra'
      ? this.suggestExtraRate(this.activeContract(), employee.rate, this.paymentForm.controls.extraType.value)
      : this.activeContract()?.baseAmount ?? employee.rate;
    this.paymentForm.patchValue({ rateApplied, unitsWorked: 1 }, { emitEvent: false });
    this.paymentTick.update((value) => value + 1);
  }

  /** Mensual ÷ 30 para un día extra; sobre esa base, la hora; el turno extra equivale a un día. */
  private suggestExtraRate(contract: EmployeeContract | null, fallbackRate: number, extraType: string): number {
    const base = contract ? contract.baseAmount : fallbackRate;
    const contractType = contract ? contract.paymentType : 'Monthly';
    const daily = contractType === 'Monthly' ? base / 30 : contractType === 'Weekly' ? base / 7 : base;
    const hourly = contractType === 'Hourly' ? base : daily / 8;
    return round2(extraType === 'Hourly' ? hourly : daily);
  }

  /** Contratos vigentes del empleado (la ficha muestra sus condiciones). */
  private loadContracts(employee: Employee): void {
    this.contractsLoading.set(true);
    this.contracts.set([]);
    this.contractsService
      .list({ pageNumber: 1, pageSize: 20, search: '', paymentType: null, status: 'active' }, employee.employeeId, true)
      .pipe(finalize(() => this.contractsLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.contracts.set(page.items.filter((contract) => contract.isActive));
          // Si el formulario ya está abierto, la tarifa sugerida parte del contrato recién traído.
          if (this.paymentFormOpen()) this.applySuggestedRate();
        },
        error: () => this.contracts.set([]),
      });
  }

  /** Caja abierta del turno: es la que puede pagar el efectivo del turno extra. */
  private loadActiveSession(): void {
    this.sessionLoading.set(true);
    this.sessionError.set(false);
    this.cashBoxService.activeSession()
      .pipe(
        catchError(() => {
          this.sessionError.set(true);
          return of<ActiveCashSessionDto | null>(null);
        }),
        finalize(() => this.sessionLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((session) => {
        this.activeSession.set(session);
        if (!session) this.paymentForm.controls.fromCashBox.setValue(false, { emitEvent: false });
      });
  }

  private loadPayments(employee: Employee, page = 1, append = false): void {
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.paymentsService.list(employee.employeeId, page, 20)
      .pipe(finalize(() => this.paymentsLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.paymentsTotal.set(result.totalRecords);
          this.payments.set(append ? [...this.payments(), ...result.items] : result.items);
        },
        error: (error: unknown) => this.paymentsError.set(describeApiError(error)),
      });
  }

  /** Pide la siguiente ventana de pagos (el historial lo pagina el SP). */
  protected loadMorePayments(): void {
    const employee = this.selected();
    if (!employee || this.paymentsLoading()) return;
    const nextPage = Math.floor(this.payments().length / 20) + 1;
    this.loadPayments(employee, nextPage, true);
  }

  protected savePayment(): void {
    const employee = this.selected();
    if (!employee || this.paymentSaving()) return;
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) return;
    const value = this.paymentForm.getRawValue();
    if (value.periodEnd < value.periodStart) {
      this.paymentsError.set('La fecha de fin del periodo no puede ser anterior a la de inicio.');
      return;
    }
    const cashBoxSessionId = value.fromCashBox ? this.activeSession()?.cashBoxSessionId ?? null : null;
    if (value.fromCashBox && cashBoxSessionId === null) {
      this.paymentsError.set('No hay una caja abierta en este turno: abre una para pagar el turno extra con efectivo de caja.');
      return;
    }
    const deductions: EmployeeDeductionInput[] = this.deductions.getRawValue()
      .filter((row) => Number(row.amount) > 0)
      .map((row) => ({
        type: row.type,
        description: row.description.trim() || null,
        amount: round2(Number(row.amount)),
      }));
    if (this.paymentTotal() <= 0) {
      this.paymentsError.set('El neto a pagar debe ser mayor que cero: revisa las unidades, la tarifa y las deducciones.');
      return;
    }
    const payload: EmployeePaymentUpsert = {
      employeeId: employee.employeeId,
      paymentType: this.effectivePaymentType(),
      periodStart: value.periodStart,
      periodEnd: value.periodEnd,
      unitsWorked: value.unitsWorked,
      rateApplied: value.rateApplied,
      bonusAmount: value.bonusAmount,
      deductionsAmount: this.deductionsTotal(),
      currencyCode: this.paymentCurrency(),
      notes: value.notes.trim() || null,
      isExtraShift: value.paymentKind === 'extra',
      deductions,
      cashBoxSessionId,
    };
    this.paymentSaving.set(true);
    this.paymentsError.set(null);
    this.paymentsService.create(payload)
      .pipe(finalize(() => this.paymentSaving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(
            'Pago registrado',
            cashBoxSessionId === null
              ? `${employee.fullName} · ${value.periodStart} al ${value.periodEnd}`
              : `${employee.fullName} · salió de la caja del turno.`,
          );
          this.paymentFormOpen.set(false);
          this.loadPayments(employee);
        },
        error: (error: unknown) => this.paymentsError.set(describeApiError(error)),
      });
  }

  protected money(amount: number, currency = 'NIO'): string {
    return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
  }

  protected reload(): void {
    if (this.selected()) {
      this.loadPayments(this.selected()!);
      this.loadContracts(this.selected()!);
      this.loadActiveSession();
    }
    this.store.load(this.store.query());
  }
}
