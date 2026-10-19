import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map, Observable } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { Employee } from '../../../../core/models/hr/employee.model';
import { EmployeeService } from '../../../../core/services/hr/employee.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  ToastService,
} from '../../../../shared/ui';

const CURRENCIES: readonly ComboboxOption<string>[] = [
  { value: 'NIO', label: 'Córdobas (NIO)' },
  { value: 'USD', label: 'Dólares (USD)' },
];

/**
 * Alta y edición de la ficha de un empleado, en dos pasos (persona · pago),
 * pintada con el patrón rms-form-page del HR de restaurant v2.
 */
@Component({
  selector: 'rms-employee-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, DecimalPipe, CazoIconComponent, ComboboxComponent, EmptyStateComponent, FieldComponent,
    FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './employee-form-page.component.html',
  styleUrl: './employee-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly employeesService = inject(EmployeeService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly employeeId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.employeeId !== null;
  protected readonly backLink = '/admin/employees';

  protected readonly loading = signal(this.isEdit);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly dirty = signal(false);
  private readonly tick = signal(0);

  protected readonly currencies = CURRENCIES;
  protected readonly paymentTypes: readonly ComboboxOption<string>[] = [
    { value: 'Hourly', label: 'Por hora', hint: 'La tarifa se multiplica por las horas del periodo.' },
    { value: 'Daily', label: 'Por día', hint: 'La tarifa se multiplica por los días trabajados.' },
    { value: 'PerShift', label: 'Por turno', hint: 'La tarifa se multiplica por los turnos cubiertos.' },
    { value: 'Weekly', label: 'Semanal', hint: 'Pago fijo por semana.' },
    { value: 'Monthly', label: 'Mensual', hint: 'Pago fijo por mes; el más común.' },
  ];

  protected readonly form = this.formBuilder.group({
    fullName: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(60)]),
    phone: this.formBuilder.nonNullable.control('', Validators.maxLength(20)),
    position: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    paymentType: this.formBuilder.nonNullable.control('Monthly', Validators.required),
    rate: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    commissionRatePercent: this.formBuilder.nonNullable.control(0, [Validators.min(0), Validators.max(100)]),
    currencyCode: this.formBuilder.nonNullable.control(this.session.session()?.tenant.currencyCode || 'NIO'),
  });

  protected readonly steps = computed(() => {
    this.tick();
    return [
      { id: 'person', label: 'Persona', description: 'Quién es y cómo contactarlo', invalid: this.stepInvalid(0) },
      { id: 'pay', label: 'Puesto y pago', description: 'En qué trabaja y cuánto gana', invalid: this.stepInvalid(1) },
    ];
  });
  protected readonly lastStep = computed(() => this.steps().length - 1);
  protected readonly paymentTypeValue = computed(() => { this.tick(); return this.form.controls.paymentType.value; });

  protected readonly summary = computed(() => {
    this.tick();
    const value = this.form.getRawValue();
    const currency = this.currencies.find((option) => option.value === value.currencyCode)?.label ?? value.currencyCode;
    return {
      name: (value.fullName ?? '').trim(),
      phone: (value.phone ?? '').trim(),
      position: (value.position ?? '').trim(),
      paymentType: this.paymentTypes.find((option) => option.value === value.paymentType)?.label ?? value.paymentType,
      rate: value.rate,
      commissionRatePercent: value.commissionRatePercent,
      currency: value.currencyCode,
      currencyLabel: currency,
    };
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.tick.update((value) => value + 1);
      this.dirty.set(true);
    });
    if (this.employeeId) this.loadProfile(this.employeeId);
  }

  protected loadProfile(employeeId: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.employeesService.getById(employeeId)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (employee) => {
          if (!employee) { this.loadError.set('No encontramos este empleado en el directorio. Vuelve al listado y revisa.'); return; }
          this.applyEmployee(employee);
        },
        error: (error: unknown) => this.loadError.set(describeApiError(error)),
      });
  }

  private applyEmployee(employee: Employee): void {
    this.form.reset({
      fullName: employee.fullName,
      phone: employee.phone ?? '',
      position: employee.position,
      paymentType: employee.paymentType,
      rate: employee.rate,
      commissionRatePercent: employee.commissionRatePercent ?? 0,
      currencyCode: employee.currencyCode,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
    this.reached.set(this.lastStep());
    this.tick.update((value) => value + 1);
  }

  protected stepInvalid(index: number): boolean {
    if (index !== 0) return false;
    const controls = this.form.controls;
    return controls.fullName.touched && controls.fullName.invalid;
  }

  protected error(name: 'fullName' | 'position'): string | null {
    const control = this.form.controls[name];
    if (!(control.touched && control.invalid)) return null;
    return name === 'fullName'
      ? 'Escribe el nombre completo del empleado.'
      : 'Describe el puesto del empleado, por ejemplo «Recepción de noche».';
  }

  protected rateError(): string | null {
    const control = this.form.controls.rate;
    if (!(control.touched && control.invalid)) return null;
    return 'Escribe la tarifa con números, por ejemplo 18500. Usa 0 si se paga solo por comisión.';
  }

  protected commissionError(): string | null {
    const control = this.form.controls.commissionRatePercent;
    if (!(control.touched && control.invalid)) return null;
    return 'La comisión debe ser un porcentaje entre 0 y 100. Deja 0 si no se le paga comisión.';
  }

  protected goTo(index: number): void {
    if (index <= this.reached()) this.step.set(index);
  }

  protected next(): void {
    if (this.step() === 0) {
      const controls = this.form.controls;
      controls.fullName.markAsTouched();
      if (controls.fullName.invalid) return;
    }
    const target = Math.min(this.step() + 1, this.lastStep());
    this.step.set(target);
    this.reached.update((value) => Math.max(value, target));
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
    if (this.form.controls.fullName.invalid) { this.step.set(0); return; }
    if (this.form.controls.position.invalid) { this.step.set(1); return; }
    if (this.form.controls.commissionRatePercent.invalid) { this.step.set(1); return; }
    if (this.form.controls.rate.invalid || !this.network.online() || this.saving()) return;
    const raw = this.form.getRawValue();
    const payload = {
      fullName: raw.fullName.trim(),
      position: raw.position.trim(),
      paymentType: raw.paymentType,
      rate: Number(raw.rate) || 0,
      commissionRatePercent: Number(raw.commissionRatePercent) || 0,
      currencyCode: raw.currencyCode || 'NIO',
      phone: raw.phone?.trim() || null,
    };
    this.saving.set(true);
    this.saveError.set(null);
    const request$: Observable<unknown> = this.employeeId
      ? this.employeesService.update({ ...payload, employeeId: this.employeeId })
      : this.employeesService.create(payload).pipe(map(() => undefined));
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.employeesService.invalidateCache();
        this.dirty.set(false);
        this.toast.success(this.isEdit ? 'Ficha actualizada' : 'Empleado registrado', `${payload.fullName} ya está en el directorio.`);
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => this.saveError.set(describeApiError(error)),
    });
  }
}
