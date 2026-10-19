import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map, Observable, of, switchMap } from 'rxjs';

import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { EmployeeContractUpsert } from '../../../../core/models/hr/contract.model';
import { EmployeeService } from '../../../../core/services/hr/employee.service';
import { ContractService } from '../../../../core/services/hr/contract.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxLoader,
  ComboboxOption,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  StepItem,
  ToastService,
} from '../../../../shared/ui';
import { DateFieldComponent } from '../../../../shared/ui/date-field/date-field.component';

const CURRENCIES: readonly ComboboxOption<string>[] = [
  { value: 'NIO', label: 'Córdobas (NIO)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

/** Hoy en Managua: clave AAAA-MM-DD sin depender del reloj del navegador. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/**
 * Registro, renovación y edición de un contrato laboral en dos pasos
 * (quién y puesto · modalidad y salario). El contrato puede tener un puesto
 * distinto al de la ficha: se congela lo acordado al firmar. Diseño portado
 * de restaurant v2 (rms-form-page + tarjetas hr-choice).
 */
@Component({
  selector: 'rms-contract-form-page',
  imports: [
    DateFieldComponent, ReactiveFormsModule, RouterLink, DecimalPipe, CazoIconComponent, ComboboxComponent,
    EmptyStateComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './contract-form-page.component.html',
  styleUrl: './contract-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly employeesService = inject(EmployeeService);
  private readonly contractsService = inject(ContractService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly contractId = Number(this.route.snapshot.paramMap.get('id')) || null;
  private readonly queryEmployeeId = Number(this.route.snapshot.queryParamMap.get('employeeId')) || null;
  protected readonly isEdit = this.contractId !== null;
  protected readonly backLink = '/admin/contracts';
  protected readonly network = inject(NetworkStatusService);

  protected readonly loading = signal(this.isEdit || this.queryEmployeeId !== null);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly dirty = signal(false);
  protected readonly selectedEmployee = signal<ComboboxOption<number>[]>([]);
  private readonly tick = signal(0);

  protected readonly currencies = CURRENCIES;
  protected readonly paymentTypes: readonly { value: string; label: string; hint: string }[] = [
    { value: 'Monthly', label: 'Mensual', hint: 'Salario fijo por mes; el contrato formal más común.' },
    { value: 'Daily', label: 'Por día', hint: 'Se paga por los días trabajados, ideal para extras.' },
    { value: 'Hourly', label: 'Por hora', hint: 'La tarifa se multiplica por las horas del periodo.' },
    { value: 'PerShift', label: 'Por turno', hint: 'La tarifa se multiplica por los turnos cubiertos.' },
    { value: 'Weekly', label: 'Semanal', hint: 'Pago fijo por semana.' },
  ];
  protected readonly steps: readonly StepItem[] = [
    { id: 'who', label: 'Empleado y puesto', description: 'A quién y en qué puesto' },
    { id: 'terms', label: 'Modalidad y salario', description: 'Cuánto, cómo y hasta cuándo' },
  ];

  protected readonly form = this.formBuilder.group({
    employeeId: this.formBuilder.control<number | null>(null, Validators.required),
    position: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    paymentType: this.formBuilder.nonNullable.control('Monthly', Validators.required),
    baseAmount: this.formBuilder.control<number | null>(null, [Validators.required, Validators.min(0)]),
    currencyCode: this.formBuilder.nonNullable.control('NIO'),
    startDate: this.formBuilder.nonNullable.control(today(), Validators.required),
    endDate: this.formBuilder.nonNullable.control(''),
    scheduleNotes: this.formBuilder.control('', Validators.maxLength(300)),
    notes: this.formBuilder.control('', Validators.maxLength(500)),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  /** Estado del contrato al abrirlo, para saber si el switch «activo» cambió. */
  private readonly loadedIsActive = signal<boolean | null>(null);

  /** Busca en el directorio de empleados del EmployeeService (backend del motel). */
  protected readonly searchEmployees: ComboboxLoader<number> = (term) => this.employeesService
    .list({ pageNumber: 1, pageSize: 20, search: term ?? '', paymentType: null, isActive: true })
    .pipe(map((page) => page.items.map((employee) => ({
      value: employee.employeeId,
      label: employee.fullName,
      hint: `${employee.position} · ${this.paymentTypes.find((option) => option.value === employee.paymentType)?.label ?? employee.paymentType}`,
    }))));

  protected readonly paymentTypeValue = computed(() => { this.tick(); return this.form.controls.paymentType.value; });
  protected readonly summary = computed(() => {
    this.tick();
    const value = this.form.getRawValue();
    const currency = this.currencies.find((option) => option.value === value.currencyCode)?.label ?? value.currencyCode;
    return {
      employee: this.selectedEmployee()[0]?.label ?? '—',
      position: value.position.trim() || '—',
      paymentType: this.paymentTypes.find((option) => option.value === value.paymentType)?.label ?? value.paymentType,
      amount: value.baseAmount,
      currency: value.currencyCode,
      currencyLabel: currency,
      start: value.startDate,
      end: value.endDate || 'Sin fecha de fin',
      schedule: value.scheduleNotes?.trim() || '—',
      isActive: value.isActive,
      status: value.isActive ? 'Vigente' : 'Terminado',
    };
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.tick.update((value) => value + 1);
      this.dirty.set(true);
    });
    if (this.isEdit) this.loadContract(this.contractId!);
    else if (this.queryEmployeeId) this.prefillEmployee(this.queryEmployeeId);
  }

  /** Edición: trae el histórico del empleado y prende las condiciones del contrato. */
  private loadContract(contractId: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.contractsService
      .list({ pageNumber: 1, pageSize: 200, search: '', paymentType: null, status: 'all' })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const contract = page.items.find((row) => row.contractId === contractId);
          if (!contract) { this.loadError.set('No encontramos este contrato en el historial. Vuelve al listado y revisa.'); return; }
          this.applyContract(contract);
        },
        error: (error: unknown) => this.loadError.set(describeApiError(error)),
      });
  }

  private applyContract(contract: {
    contractId: number; employeeId: number; employeeName: string; position: string; paymentType: string;
    baseAmount: number; currencyCode: string; startDate: string; endDate: string | null;
    scheduleNotes: string | null; notes: string | null; isActive: boolean;
  }): void {
    this.selectedEmployee.set([{ value: contract.employeeId, label: contract.employeeName }]);
    this.form.reset({
      employeeId: contract.employeeId,
      position: contract.position,
      paymentType: contract.paymentType,
      baseAmount: contract.baseAmount,
      currencyCode: contract.currencyCode,
      startDate: contract.startDate.slice(0, 10),
      endDate: contract.endDate?.slice(0, 10) ?? '',
      scheduleNotes: contract.scheduleNotes ?? '',
      notes: contract.notes ?? '',
      isActive: contract.isActive,
    }, { emitEvent: false });
    this.loadedIsActive.set(contract.isActive);
    this.form.markAsPristine();
    this.dirty.set(false);
    this.reached.set(1);
    this.tick.update((value) => value + 1);
  }

  /** Semilla desde la ficha del empleado: renueva las condiciones del contrato vigente. */
  private prefillEmployee(employeeId: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.employeesService.getById(employeeId)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (employee) => {
          if (!employee) { this.loadError.set('No encontramos este empleado en el directorio. Vuelve al listado y revisa.'); return; }
          this.selectedEmployee.set([{ value: employee.employeeId, label: employee.fullName }]);
          this.form.patchValue({
            employeeId: employee.employeeId,
            paymentType: employee.paymentType,
            baseAmount: employee.rate,
            currencyCode: employee.currencyCode,
            startDate: today(),
          }, { emitEvent: false });
          this.tick.update((value) => value + 1);
          this.dirty.set(false);
        },
        error: (error: unknown) => this.loadError.set(describeApiError(error)),
      });
  }

  protected selectPaymentType(value: string): void {
    this.form.controls.paymentType.setValue(value);
    this.form.controls.paymentType.markAsTouched();
  }

  protected onEmployeePicked(option: ComboboxOption<number> | null): void {
    this.selectedEmployee.set(option ? [option as ComboboxOption<number>] : []);
  }

  protected goTo(index: number): void {
    if (index <= this.reached()) this.step.set(index);
  }

  protected next(): void {
    if (this.step() === 0) {
      this.form.controls.employeeId.markAsTouched();
      this.form.controls.position.markAsTouched();
      if (this.form.controls.employeeId.invalid) return;
      if (this.form.controls.position.invalid) return;
    }
    this.step.set(1);
    this.reached.update((value) => Math.max(value, 1));
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected async cancel(): Promise<void> {
    if (this.dirty() && !this.saving()) {
      const leave = await this.confirm.ask({
        title: 'Salir sin guardar',
        message: 'Hiciste cambios que todavía no se guardaron. Si sales, se pierden.',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Seguir editando',
        tone: 'warning',
      });
      if (!leave) return;
    }
    void this.router.navigateByUrl(this.backLink);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    const raw = this.form.getRawValue();
    if (!raw.employeeId || raw.employeeId <= 0) { this.step.set(0); return; }
    if (!raw.position.trim()) { this.step.set(0); return; }
    if (raw.baseAmount === null || raw.baseAmount < 0) { this.step.set(1); return; }
    if (raw.endDate && raw.endDate < raw.startDate) {
      this.saveError.set('La fecha de fin no puede ser anterior a la fecha de inicio.');
      this.step.set(1);
      return;
    }
    if (this.saving() || !this.network.online()) return;
    const payload: EmployeeContractUpsert = {
      employeeId: raw.employeeId,
      position: raw.position.trim(),
      paymentType: raw.paymentType,
      baseAmount: Number(raw.baseAmount) || 0,
      currencyCode: raw.currencyCode || 'NIO',
      startDate: raw.startDate,
      endDate: raw.endDate || null,
      scheduleNotes: raw.scheduleNotes?.trim() || null,
      notes: raw.notes?.trim() || null,
    };
    this.saving.set(true);
    this.saveError.set(null);
    const request$: Observable<unknown> = this.contractId
      ? this.contractsService.update(this.contractId, payload).pipe(switchMap(() => this.syncActive(this.contractId!, false)))
      : this.contractsService.create(payload).pipe(switchMap((id) => this.syncActive(id, true)), map(() => undefined));
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.success(
          this.isEdit ? 'Contrato actualizado' : 'Contrato registrado',
          `${this.selectedEmployee()[0]?.label ?? ''} · ${this.paymentTypes.find((option) => option.value === raw.paymentType)?.label ?? raw.paymentType}`,
        );
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => this.saveError.set(describeApiError(error)),
    });
  }

  /**
   * Aplica el switch «activo» con el endpoint de terminar/reabrir. El alta nace
   * vigente, así que solo se llama en la edición (o al desactivar un contrato nuevo).
   */
  private syncActive(contractId: number, created: boolean): Observable<void> {
    const desired = this.form.controls.isActive.value;
    if (desired === this.loadedIsActive()) return of(undefined);
    if (created && desired) return of(undefined);
    return this.contractsService.setActive(contractId, desired);
  }

  protected positionError(): string | null {
    const control = this.form.controls.position;
    if (!(control.touched && control.invalid)) return null;
    return 'Describe el puesto congelado en el contrato, por ejemplo «Recepción de noche».';
  }

  protected amountError(): string | null {
    const control = this.form.controls.baseAmount;
    if (!(control.touched && control.invalid)) return null;
    return 'Escribe el salario o la tarifa base con números, por ejemplo 18000.';
  }
}
