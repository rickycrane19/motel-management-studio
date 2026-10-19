import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, of, switchMap } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { Supplier, SupplierUpsert } from '../../../../core/models/inventory/supplier.model';
import { SupplierService } from '../../../../core/services/inventory/supplier.service';
import {
  CazoIconComponent,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  ToastService,
} from '../../../../shared/ui';

@Component({
  selector: 'rms-supplier-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, EmptyStateComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './supplier-form-page.component.html',
  styleUrl: './supplier-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly suppliersService = inject(SupplierService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly supplierId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.supplierId !== null;
  protected readonly backLink = '/admin/suppliers';

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly dirty = signal(false);
  private readonly tick = signal(0);

  protected readonly nameValue = signal('');
  protected readonly contactValue = signal('');
  protected readonly isActiveValue = signal(true);
  private readonly initialIsActive = signal(true);

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    contactName: this.formBuilder.nonNullable.control('', Validators.maxLength(150)),
    phone: this.formBuilder.nonNullable.control('', Validators.maxLength(50)),
    email: this.formBuilder.nonNullable.control('', [Validators.maxLength(150), Validators.email]),
    address: this.formBuilder.nonNullable.control('', Validators.maxLength(250)),
    taxId: this.formBuilder.nonNullable.control('', Validators.maxLength(50)),
    notes: this.formBuilder.nonNullable.control('', Validators.maxLength(500)),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  protected readonly canManage = computed(
    () => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:update'),
  );

  protected readonly contactSummary = computed(() => {
    this.tick();
    return [this.form.controls.contactName.value.trim(), this.form.controls.phone.value.trim()]
      .filter((value) => value.length > 0)
      .join(' · ');
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncSignals(true));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    if (this.supplierId === null) {
      this.form.reset({ isActive: true }, { emitEvent: false });
      this.syncSignals(false);
      this.loading.set(false);
      return;
    }
    // El detalle llega como envoltura { supplier, recentPurchases }.
    this.suppliersService.getById(this.supplierId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detail) => {
          const supplier = detail?.supplier ?? null;
          if (!supplier) {
            if (!this.loadError()) this.loadError.set('No encontramos este proveedor. Vuelve al listado y revisa.');
            return;
          }
          this.applySupplier(supplier);
          this.syncSignals(false);
        },
        error: (error: unknown) => this.loadError.set(describeApiError(error)),
      });
  }

  private applySupplier(supplier: Supplier): void {
    this.form.reset({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      taxId: supplier.taxId ?? '',
      notes: supplier.notes ?? '',
      isActive: supplier.isActive,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.initialIsActive.set(supplier.isActive);
    this.dirty.set(false);
  }

  private syncSignals(markDirty: boolean): void {
    this.tick.update((value) => value + 1);
    const controls = this.form.controls;
    this.nameValue.set(controls.name.value);
    this.contactValue.set(controls.contactName.value);
    this.isActiveValue.set(controls.isActive.value);
    if (markDirty) this.dirty.set(true);
  }

  // ── Textos de ayuda y errores ────────────────────────────────────────────────────────────
  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe cómo se llama el proveedor.';
    if (control.hasError('maxlength')) return 'Usa 150 letras o menos.';
    return null;
  }

  protected contactError(): string | null {
    const control = this.form.controls.contactName;
    if (!control.touched && !control.dirty) return null;
    return control.hasError('maxlength') ? 'Usa 150 letras o menos.' : null;
  }

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    if (!control.touched && !control.dirty) return null;
    return control.hasError('maxlength') ? 'Usa 50 caracteres o menos.' : null;
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('email')) return 'Escribe un correo válido, por ejemplo ventas@proveedor.com.';
    if (control.hasError('maxlength')) return 'Usa 150 caracteres o menos.';
    return null;
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized.length ? normalized : null;
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

  // ── Guardar ──────────────────────────────────────────────────────────────────────────────
  protected save(): void {
    if (this.saving() || !this.network.online() || !this.canManage()) return;
    this.saveError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload: SupplierUpsert = {
      name: value.name.trim(),
      contactName: this.nullIfEmpty(value.contactName),
      phone: this.nullIfEmpty(value.phone),
      email: this.nullIfEmpty(value.email),
      address: this.nullIfEmpty(value.address),
      taxId: this.nullIfEmpty(value.taxId),
      notes: this.nullIfEmpty(value.notes),
      isActive: value.isActive,
    };
    this.saving.set(true);
    const supplierId = this.supplierId;
    let request$: Observable<unknown>;
    if (supplierId !== null) {
      // El endpoint de edición cambia solo los datos de contacto; el estado se
      // ajusta aparte para no tocar el maestro cuando el switch no cambió.
      const activeChanged = value.isActive !== this.initialIsActive();
      request$ = this.suppliersService.update(supplierId, payload).pipe(
        switchMap(() => (activeChanged ? this.suppliersService.setActive(supplierId, value.isActive) : of(undefined))),
      );
    } else {
      request$ = this.suppliersService.create(payload);
    }
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.success(this.isEdit ? 'Proveedor actualizado' : 'Proveedor creado', payload.name);
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => this.saveError.set(describeApiError(error)),
    });
  }
}
